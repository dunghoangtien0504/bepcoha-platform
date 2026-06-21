#!/usr/bin/env bash
#
# install-hook.sh — Git auto Task-ID hook installer
# Cài Git post-checkout hook tự bóc tách mã Task từ tên branch, để mọi request AI
# từ IDE của bạn được gắn đúng dự án/công việc mà KHÔNG phải sửa X-Task-ID thủ công.
#
# EN: Installs a post-checkout hook that extracts the Task ID from the current branch
#     name so every AI request from your IDE is attributed automatically.
#
# Quy ước branch (branch convention):
#   feature/AIGG-WPZ0XZ-...   -> Task ID = AIGG-WPZ0XZ
#   feature/TERO-102-mo-ta    -> Task ID = TERO-102
#   bugfix/AIGG-123           -> Task ID = AIGG-123
#
# Dùng (usage):
#   bash ide-configs/install-hook.sh          # cài cho repo hiện tại
#   bash ide-configs/install-hook.sh --print  # chỉ in Task ID của branch hiện tại
#
set -euo pipefail

# Regex bắt mã task theo chuẩn Jira/Linear: prefix >=2 CHỮ HOA + '-' + hậu tố CHỨA ít nhất 1 chữ số.
# Khớp: AIGG-WPZ0XZ, TERO-102, AIGG-123, STORO-2024X.  Bỏ qua: no-task, add-login, api-v2 (chữ thường).
TASK_PATTERN='[A-Z]{2,}-[A-Z0-9]*[0-9][A-Z0-9]*'

extract_task_id() {
  local branch="$1"
  printf '%s' "$branch" | grep -oE "$TASK_PATTERN" | head -n1 || true
}

# --print: chỉ in ra Task ID rồi thoát (tiện debug / dùng trong script khác).
if [[ "${1:-}" == "--print" ]]; then
  branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"
  extract_task_id "$branch"
  exit 0
fi

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "${REPO_ROOT}" ]]; then
  echo "❌ Hãy chạy script này bên trong một git repository. / Run inside a git repo." >&2
  exit 1
fi

HOOK_DIR="${REPO_ROOT}/.git/hooks"
HOOK_FILE="${HOOK_DIR}/post-checkout"
mkdir -p "${HOOK_DIR}"

cat > "${HOOK_FILE}" <<HOOK
#!/usr/bin/env bash
# AIGG auto Task-ID hook — tự bóc tách Task ID từ tên branch sau mỗi lần checkout.
set -euo pipefail
branch="\$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"
task_id="\$(printf '%s' "\$branch" | grep -oE '${TASK_PATTERN}' | head -n1 || true)"
if [[ -n "\$task_id" ]]; then
  mkdir -p "\$HOME/.continue"
  printf '%s' "\$task_id" > "\$HOME/.continue/.task-id"
  printf '%s' "\$task_id" > "\$(git rev-parse --show-toplevel)/.git/aigg-task-id"
  echo "🔖 AIGG X-Task-ID = \${task_id}  (branch: \${branch})"
else
  echo "ℹ️  Không thấy mã Task trong branch '\${branch}'. Đặt X-Task-ID thủ công nếu cần."
fi
HOOK

chmod +x "${HOOK_FILE}"

# Chạy ngay một lần cho branch hiện tại để có giá trị liền.
current_branch="$(git -C "${REPO_ROOT}" rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"
current_task="$(extract_task_id "${current_branch}")"

echo "✅ Đã cài post-checkout hook: ${HOOK_FILE}"
if [[ -n "${current_task}" ]]; then
  mkdir -p "${HOME}/.continue"
  printf '%s' "${current_task}" > "${HOME}/.continue/.task-id"
  printf '%s' "${current_task}" > "${REPO_ROOT}/.git/aigg-task-id"
  echo "🔖 Task ID hiện tại = ${current_task}  (branch: ${current_branch})"
else
  echo "ℹ️  Branch hiện tại '${current_branch}' chưa chứa mã Task — sẽ tự cập nhật khi bạn checkout branch có mã."
fi
echo "   • Ghi vào: ~/.continue/.task-id  và  ${REPO_ROOT}/.git/aigg-task-id"
echo "   • MCP/Node-RED tự đọc tên branch để gắn task; với Continue.dev hãy trỏ X-Task-ID tới giá trị này."
