import { execSync } from 'node:child_process';
import { loadConfig } from './config.js';

const cfg = loadConfig();

/** Ngữ cảnh đính kèm mỗi lần forward — để Node-RED tự map task_id / dự án / người gọi. */
export interface CallContext {
  cwd: string;
  gitBranch: string | null;
  activeTaskId: string | null;
  projectId: string | null;
}

let activeTaskId: string | null = cfg.initialTaskId;

export function setActiveTask(id: string | null): void {
  activeTaskId = id && id.trim() ? id.trim() : null;
}

/** Suy nhánh git hiện tại (để Node-RED map theo quy ước branch → task, nếu muốn). */
function currentBranch(): string | null {
  try {
    const out = execSync('git rev-parse --abbrev-ref HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
    return out || null;
  } catch {
    return null;
  }
}

export function getContext(): CallContext {
  return {
    cwd: process.cwd(),
    gitBranch: currentBranch(),
    activeTaskId,
    projectId: cfg.projectId,
  };
}
