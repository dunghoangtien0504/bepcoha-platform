import * as vscode from 'vscode';
import type { Session } from './session';

interface Row {
  label: string;
  description?: string;
  icon: string;
  command?: string;
}

/** Panel sidebar: hiển thị trạng thái đăng nhập, task đang hoạt động & các hành động nhanh. */
export class AiggTreeProvider implements vscode.TreeDataProvider<Row> {
  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.emitter.event;

  constructor(private readonly session: Session) {
    session.onChange(() => this.emitter.fire());
  }

  refresh(): void {
    this.emitter.fire();
  }

  getTreeItem(row: Row): vscode.TreeItem {
    const item = new vscode.TreeItem(row.label, vscode.TreeItemCollapsibleState.None);
    item.description = row.description;
    item.iconPath = new vscode.ThemeIcon(row.icon);
    if (row.command) item.command = { command: row.command, title: row.label };
    return item;
  }

  getChildren(): Row[] {
    if (!this.session.isLoggedIn) {
      return [{ label: 'Đăng nhập AI Governance Gateway', icon: 'sign-in', command: 'aigg.login' }];
    }
    const tier = vscode.workspace.getConfiguration('aigg').get<string>('serviceTier', 'api_key');
    const user = this.session.user;
    const active = this.session.activeTask;

    const rows: Row[] = [
      { label: user ? user.fullName : 'Đã đăng nhập', description: user?.email, icon: 'account' },
      {
        label: active ? `Task: ${active.title}` : 'Chưa giao task cho AI',
        description: active ? active.aiTaskId.slice(0, 8) : 'bấm để chọn/tạo',
        icon: 'target',
        command: 'aigg.selectTask',
      },
      {
        label: `Gói dịch vụ: ${tier === 'api_key' ? 'API key (proxy)' : 'Claude Pro (báo cáo)'}`,
        icon: 'package',
      },
      { label: 'Xem hạn ngạch token', icon: 'dashboard', command: 'aigg.showQuota' },
    ];

    if (tier === 'api_key') {
      rows.push(
        { label: 'Cấu hình định tuyến qua Gateway', icon: 'gear', command: 'aigg.configureRouting' },
        { label: 'Copy headers / cURL', icon: 'clippy', command: 'aigg.copyHeaders' },
      );
    } else {
      rows.push({ label: 'Báo cáo usage (Claude Pro)', icon: 'cloud-upload', command: 'aigg.reportUsage' });
    }
    rows.push({ label: 'Đăng xuất', icon: 'sign-out', command: 'aigg.logout' });
    return rows;
  }
}
