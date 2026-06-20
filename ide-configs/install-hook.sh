#!/usr/bin/env bash
#
# install-hook.sh — Cài Git post-checkout hook tự bóc tách mã Task từ tên branch
# và ghi vào ~/.continue/.task-id để dev không phải sửa X-Task-ID thủ công.
#
# Quy ước branch: feature/TERO-102-mo-ta  ->  Task ID = TERO-102
#
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "${REPO_ROOT}" ]]; then
  echo "❌ Hãy chạy script này bên trong một git repository." >&2
  exit 1
fi

HOOK_DIR="${REPO_ROOT}/.git/hooks"
HOOK_FILE="${HOOK_DIR}/post-checkout"

mkdir -p "${HOOK_DIR}"

cat > "${HOOK_FILE}" <<'HOOK'
#!/usr/bin/env bash
# Tự động bóc tách Task ID (vd: TERO-102, STORO-201) từ tên branch hiện tại.
set -euo pipefail
branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"
task_id="$(printf '%s' "$branch" | grep -oE '[A-Z]+-[0-9]+' | head -n1 || true)"
if [[ -n "$task_id" ]]; then
  mkdir -p "$HOME/.continue"
  printf '%s' "$task_id" > "$HOME/.continue/.task-id"
  echo "🔖 X-Task-ID đã đặt = ${task_id} (theo branch ${branch})"
else
  echo "ℹ️  Không tìm thấy mã Task trong tên branch '${branch}'. Hãy đặt X-Task-ID thủ công."
fi
HOOK

chmod +x "${HOOK_FILE}"
echo "✅ Đã cài post-checkout hook tại ${HOOK_FILE}"
echo "   Mỗi lần checkout branch, Task ID sẽ được ghi vào ~/.continue/.task-id"
