import * as vscode from 'vscode';
import { randomUUID } from 'crypto';
import type { AuthUser } from './api';

/** Task đang hoạt động: ai_tasks.id dùng làm X-Task-ID khi định tuyến qua Gateway. */
export interface ActiveTask {
  aiTaskId: string;
  title: string;
  projectRef: string | null;
  conversationId: string;
}

const KEY_JWT = 'aigg.jwt';
const KEY_TOKEN = 'aigg.internalToken';
const KEY_USER = 'aigg.user';
const KEY_ACTIVE = 'aigg.activeTask';

/**
 * Quản lý phiên: lưu JWT + internal token trong SecretStorage (an toàn), thông tin user &
 * task đang hoạt động trong globalState. Phát sự kiện onChange để cập nhật status bar/tree.
 */
export class Session {
  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onChange = this.emitter.event;

  private _jwt: string | null = null;
  private _internalToken: string | null = null;

  constructor(private readonly ctx: vscode.ExtensionContext) {}

  async load(): Promise<void> {
    this._jwt = (await this.ctx.secrets.get(KEY_JWT)) ?? null;
    this._internalToken = (await this.ctx.secrets.get(KEY_TOKEN)) ?? null;
    this.emitter.fire();
  }

  get isLoggedIn(): boolean {
    return !!this._jwt;
  }

  get jwt(): string | null {
    return this._jwt;
  }

  get internalToken(): string | null {
    return this._internalToken;
  }

  get user(): AuthUser | undefined {
    return this.ctx.globalState.get<AuthUser>(KEY_USER);
  }

  get activeTask(): ActiveTask | undefined {
    return this.ctx.globalState.get<ActiveTask>(KEY_ACTIVE);
  }

  async saveAuth(jwt: string, internalToken: string | null, user: AuthUser): Promise<void> {
    this._jwt = jwt;
    this._internalToken = internalToken;
    await this.ctx.secrets.store(KEY_JWT, jwt);
    if (internalToken) await this.ctx.secrets.store(KEY_TOKEN, internalToken);
    else await this.ctx.secrets.delete(KEY_TOKEN);
    await this.ctx.globalState.update(KEY_USER, user);
    this.emitter.fire();
  }

  async clearAuth(): Promise<void> {
    this._jwt = null;
    this._internalToken = null;
    await this.ctx.secrets.delete(KEY_JWT);
    await this.ctx.secrets.delete(KEY_TOKEN);
    await this.ctx.globalState.update(KEY_USER, undefined);
    await this.ctx.globalState.update(KEY_ACTIVE, undefined);
    this.emitter.fire();
  }

  /** Đặt task hoạt động; sinh conversationId mới cho mỗi lần giao việc. */
  async setActiveTask(aiTaskId: string, title: string, projectRef: string | null): Promise<ActiveTask> {
    const task: ActiveTask = { aiTaskId, title, projectRef, conversationId: randomUUID() };
    await this.ctx.globalState.update(KEY_ACTIVE, task);
    this.emitter.fire();
    return task;
  }

  async clearActiveTask(): Promise<void> {
    await this.ctx.globalState.update(KEY_ACTIVE, undefined);
    this.emitter.fire();
  }
}
