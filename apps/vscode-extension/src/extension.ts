import * as vscode from 'vscode';
import { AiggApi } from './api';
import { Session } from './session';
import { AiggTreeProvider } from './tree';
import { buildCurl, writeRoutingArtifacts } from './routing';

function getApi(): AiggApi {
  const baseUrl = vscode.workspace.getConfiguration('aigg').get<string>('baseUrl', 'http://localhost:3900');
  return new AiggApi(baseUrl);
}

function getTier(): 'api_key' | 'claude_pro' {
  return vscode.workspace.getConfiguration('aigg').get<'api_key' | 'claude_pro'>('serviceTier', 'api_key');
}

export async function activate(ctx: vscode.ExtensionContext): Promise<void> {
  const session = new Session(ctx);
  await session.load();

  const tree = new AiggTreeProvider(session);
  ctx.subscriptions.push(vscode.window.registerTreeDataProvider('aiggPanel', tree));

  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  status.command = 'aigg.selectTask';
  ctx.subscriptions.push(status);

  const refreshStatus = (): void => {
    if (!session.isLoggedIn) {
      status.text = '$(shield) AIGG: đăng nhập';
      status.tooltip = 'Bấm để đăng nhập AI Governance Gateway';
      status.command = 'aigg.login';
    } else {
      const t = session.activeTask;
      status.text = t ? `$(target) AIGG: ${t.title}` : '$(shield) AIGG: chưa giao task';
      status.tooltip = t ? `Task AI: ${t.aiTaskId}` : 'Bấm để giao việc cho AI';
      status.command = 'aigg.selectTask';
    }
    status.show();
  };
  session.onChange(refreshStatus);
  refreshStatus();

  const requireLogin = (): boolean => {
    if (session.isLoggedIn) return true;
    void vscode.window.showWarningMessage('Bạn cần đăng nhập AI Governance Gateway trước.');
    return false;
  };

  // --- Đăng nhập ---
  const login = async (): Promise<void> => {
    const email = await vscode.window.showInputBox({ prompt: 'Email AI Gateway', ignoreFocusOut: true });
    if (!email) return;
    const password = await vscode.window.showInputBox({
      prompt: 'Mật khẩu',
      password: true,
      ignoreFocusOut: true,
    });
    if (!password) return;
    try {
      const api = getApi();
      const res = await api.login(email, password);
      let internalToken: string | null = null;
      try {
        internalToken = (await api.getInternalToken(res.accessToken)).internalToken;
      } catch {
        /* token nội bộ có thể chưa cấu hình */
      }
      await session.saveAuth(res.accessToken, internalToken, res.user);
      if (!internalToken && getTier() === 'api_key') {
        void vscode.window.showWarningMessage(
          'Đăng nhập OK nhưng chưa có internal token (storo_live_). Hãy tạo token trong Dashboard để định tuyến qua Gateway.',
        );
      } else {
        void vscode.window.showInformationMessage(`Đã đăng nhập: ${res.user.fullName}`);
      }
    } catch (err) {
      void vscode.window.showErrorMessage(`Đăng nhập thất bại: ${(err as Error).message}`);
    }
  };

  const logout = async (): Promise<void> => {
    const ok = await vscode.window.showWarningMessage('Đăng xuất AI Gateway?', { modal: true }, 'Đăng xuất');
    if (ok !== 'Đăng xuất') return;
    await session.clearAuth();
    void vscode.window.showInformationMessage('Đã đăng xuất.');
  };

  // --- Giao việc cho AI (chọn/tạo task) ---
  const selectTask = async (): Promise<void> => {
    if (!requireLogin()) return;
    const source = await vscode.window.showQuickPick(
      [
        { label: '$(checklist) Công việc của tôi', value: 'work' },
        { label: '$(robot) AI task đã có', value: 'ai' },
        { label: '$(add) Tạo AI task mới', value: 'new' },
      ],
      { placeHolder: 'Nguồn task để giao cho AI', ignoreFocusOut: true },
    );
    if (!source) return;
    const api = getApi();
    const jwt = session.jwt as string;
    const userId = session.user?.id ?? '';

    try {
      if (source.value === 'work') {
        const { rows } = await api.listWorkTasks(jwt, userId);
        if (rows.length === 0) {
          void vscode.window.showInformationMessage('Không có công việc nào được giao cho bạn.');
          return;
        }
        const picked = await vscode.window.showQuickPick(
          rows.map((t) => ({
            label: t.title,
            description: t.project?.title ?? '',
            detail: `Ước tính: ${t.estimatedHours ?? '—'} giờ`,
            task: t,
          })),
          { placeHolder: 'Chọn công việc để giao cho AI', ignoreFocusOut: true },
        );
        if (!picked) return;
        const baseline = await promptNumber('Số giờ công ước tính (baseline)', picked.task.estimatedHours ?? 1);
        if (baseline === undefined) return;
        const budget = await promptNumber('Ngân sách token (Enter để bỏ qua, dùng hạn mức user)', 0, true);
        const aiTask = await api.assignAi(jwt, picked.task.id, {
          baselineHours: baseline,
          budgetTokens: budget || undefined,
          endDate: picked.task.dueDate ? picked.task.dueDate.slice(0, 10) : undefined,
        });
        const ref = picked.task.project?.code ?? (picked.task.projectId ? String(picked.task.projectId) : null);
        await session.setActiveTask(aiTask.id, aiTask.title, ref);
      } else if (source.value === 'ai') {
        const tasks = await api.listAiTasks(jwt, userId);
        if (tasks.length === 0) {
          void vscode.window.showInformationMessage('Chưa có AI task nào của bạn.');
          return;
        }
        const picked = await vscode.window.showQuickPick(
          tasks.map((t) => ({
            label: t.title,
            description: `${t.status} · baseline ${t.baselineHours}h`,
            task: t,
          })),
          { placeHolder: 'Chọn AI task làm task hoạt động', ignoreFocusOut: true },
        );
        if (!picked) return;
        const ref = picked.task.projectId ? String(picked.task.projectId) : null;
        await session.setActiveTask(picked.task.id, picked.task.title, ref);
      } else {
        const title = await vscode.window.showInputBox({ prompt: 'Tiêu đề AI task', ignoreFocusOut: true });
        if (!title) return;
        const baseline = await promptNumber('Số giờ công ước tính (baseline)', 1);
        if (baseline === undefined) return;
        const budget = await promptNumber('Ngân sách token (Enter để bỏ qua)', 0, true);
        const aiTask = await api.createAiTask(jwt, {
          title,
          baselineHours: baseline,
          budgetTokens: budget || undefined,
        });
        await session.setActiveTask(aiTask.id, aiTask.title, null);
      }

      void vscode.window.showInformationMessage(`Đã giao việc cho AI: ${session.activeTask?.title}`);
      if (getTier() === 'api_key') await configureRouting(true);
    } catch (err) {
      void vscode.window.showErrorMessage(`Giao việc thất bại: ${(err as Error).message}`);
    }
  };

  const clearTask = async (): Promise<void> => {
    await session.clearActiveTask();
    void vscode.window.showInformationMessage('Đã bỏ task đang hoạt động.');
  };

  // --- Hạn ngạch ---
  const showQuota = async (): Promise<void> => {
    if (!requireLogin()) return;
    try {
      const snap = await getApi().getQuota(session.jwt as string, session.activeTask?.aiTaskId ?? 'N/A');
      const lines = snap.cycles
        .map((c) => `${c.cycle}: ${c.used}/${c.unlimited ? '∞' : c.limit}`)
        .join('   |   ');
      void vscode.window.showInformationMessage(`Hạn ngạch token — ${lines}`);
    } catch (err) {
      void vscode.window.showErrorMessage(`Không lấy được hạn ngạch: ${(err as Error).message}`);
    }
  };

  // --- Cấu hình định tuyến (gói API key) ---
  const configureRouting = async (silentIfNoFolder = false): Promise<void> => {
    if (!requireLogin()) return;
    const active = session.activeTask;
    if (!active) {
      void vscode.window.showWarningMessage('Hãy giao việc cho AI (chọn task) trước khi cấu hình định tuyến.');
      return;
    }
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      if (!silentIfNoFolder) void vscode.window.showWarningMessage('Mở một thư mục/workspace để ghi cấu hình định tuyến.');
      return;
    }
    const cfg = vscode.workspace.getConfiguration('aigg');
    const baseUrl = cfg.get<string>('baseUrl', 'http://localhost:3900');
    const model = cfg.get<string>('estimationModel', 'claude-3-5-sonnet');
    try {
      const uri = await writeRoutingArtifacts(folder, baseUrl, active, model);
      const choice = await vscode.window.showInformationMessage(
        'Đã ghi cấu hình định tuyến vào .aigg/. Đặt biến môi trường AIGG_TOKEN = internal token để client gọi qua Gateway.',
        'Mở routing.json',
        'Copy headers/cURL',
      );
      if (choice === 'Mở routing.json') await vscode.window.showTextDocument(uri);
      else if (choice === 'Copy headers/cURL') await copyHeaders();
    } catch (err) {
      void vscode.window.showErrorMessage(`Ghi cấu hình thất bại: ${(err as Error).message}`);
    }
  };

  const copyHeaders = async (): Promise<void> => {
    if (!requireLogin()) return;
    const active = session.activeTask;
    if (!active) {
      void vscode.window.showWarningMessage('Chưa có task hoạt động để tạo headers.');
      return;
    }
    const token = session.internalToken;
    if (!token) {
      void vscode.window.showWarningMessage('Chưa có internal token. Tạo token trong Dashboard rồi đăng nhập lại.');
      return;
    }
    const cfg = vscode.workspace.getConfiguration('aigg');
    const curl = buildCurl(cfg.get('baseUrl', 'http://localhost:3900'), token, active, cfg.get('estimationModel', 'claude-3-5-sonnet'));
    await vscode.env.clipboard.writeText(curl);
    void vscode.window.showInformationMessage('Đã copy lệnh cURL (kèm token + headers) vào clipboard.');
  };

  // --- Báo cáo usage (gói Claude Pro) ---
  const reportUsage = async (): Promise<void> => {
    if (!requireLogin()) return;
    const active = session.activeTask;
    if (!active) {
      void vscode.window.showWarningMessage('Hãy giao việc cho AI (chọn task) trước khi báo cáo usage.');
      return;
    }
    const promptTokens = await promptNumber('Số token prompt (ước tính)', 0);
    if (promptTokens === undefined) return;
    const completionTokens = await promptNumber('Số token completion (ước tính)', 0);
    if (completionTokens === undefined) return;
    const cfg = vscode.workspace.getConfiguration('aigg');
    try {
      const res = await getApi().ingestUsage(session.jwt as string, {
        taskId: active.aiTaskId,
        requesterId: session.user?.email ?? '',
        model: cfg.get('estimationModel', 'claude-3-5-sonnet'),
        promptTokens,
        completionTokens,
        captureMode: 'TASK',
        projectId: active.projectRef ?? undefined,
        conversationId: active.conversationId,
      });
      void vscode.window.showInformationMessage(
        `Đã báo cáo usage: ${res.totalTokens} tokens · $${res.costUsd}.`,
      );
    } catch (err) {
      void vscode.window.showErrorMessage(`Báo cáo usage thất bại: ${(err as Error).message}`);
    }
  };

  ctx.subscriptions.push(
    vscode.commands.registerCommand('aigg.login', login),
    vscode.commands.registerCommand('aigg.logout', logout),
    vscode.commands.registerCommand('aigg.selectTask', selectTask),
    vscode.commands.registerCommand('aigg.clearTask', clearTask),
    vscode.commands.registerCommand('aigg.showQuota', showQuota),
    vscode.commands.registerCommand('aigg.configureRouting', () => configureRouting(false)),
    vscode.commands.registerCommand('aigg.copyHeaders', copyHeaders),
    vscode.commands.registerCommand('aigg.reportUsage', reportUsage),
    vscode.commands.registerCommand('aigg.refresh', () => {
      tree.refresh();
      refreshStatus();
    }),
  );
}

/** Hộp nhập số có validate. allowEmpty=true: Enter trống trả về 0. */
async function promptNumber(prompt: string, value: number, allowEmpty = false): Promise<number | undefined> {
  const input = await vscode.window.showInputBox({
    prompt,
    value: value ? String(value) : '',
    ignoreFocusOut: true,
    validateInput: (v) => {
      if (!v.trim()) return allowEmpty ? null : 'Vui lòng nhập số';
      return Number.isFinite(Number(v)) && Number(v) >= 0 ? null : 'Giá trị không hợp lệ';
    },
  });
  if (input === undefined) return undefined;
  if (!input.trim()) return allowEmpty ? 0 : undefined;
  return Number(input);
}

export function deactivate(): void {
  /* không có tài nguyên cần giải phóng thủ công */
}
