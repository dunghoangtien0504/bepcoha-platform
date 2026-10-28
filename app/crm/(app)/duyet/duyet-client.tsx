'use client'
import { api, useAction, btnClass } from '../../_components/client'

/** Chấp nhận một lượt chấm bị gắn cờ: bắt buộc lý do, có nhật ký (sửa công tay). */
export function AcceptPunch({ logId, staffId }: { logId: number; staffId: number }) {
  const { run, pending, error, message } = useAction()
  return (
    <span className="inline-flex items-center gap-2">
      <button disabled={pending} className={btnClass('secondary', 'sm')} onClick={() => {
        const reason = prompt('Chấp nhận lượt chấm này. Lý do (VD: đã gọi xác nhận có mặt ở bếp, GPS lệch):')
        if (reason) run(() => api('/api/crm/attendance', 'PATCH', { action: 'accept_log', log_id: logId, staff_id: staffId, reason }), 'Đã chấp nhận')
      }}>Chấp nhận</button>
      {error && <span className="text-xs text-rose-600">{error}</span>}
      {message && <span className="text-xs text-emerald-700">{message}</span>}
    </span>
  )
}
