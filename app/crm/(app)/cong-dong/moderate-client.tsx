'use client'
import { api, useAction, btnClass, Feedback } from '../../_components/client'

type Status = 'cho_duyet' | 'da_duyet' | 'tu_choi' | 'an'

export function ModerateButtons({ id, status, pinned }: { id: number; status: Status; pinned: boolean }) {
  const { run, pending, error, message } = useAction()
  const act = (action: string, reason = '') => run(() => api('/api/crm/community', 'PATCH', { id, action, reason }), 'Đã cập nhật')
  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      {status !== 'da_duyet' && <button disabled={pending} className={btnClass('primary', 'sm')} onClick={() => act('duyet')}>Duyệt</button>}
      <button disabled={pending} className={btnClass('primary', 'sm')} onClick={() => act('khen')}>Duyệt + khen</button>
      {status !== 'tu_choi' && (
        <button disabled={pending} className={btnClass('ghost', 'sm')} onClick={() => {
          const r = prompt('Lý do từ chối (khách sẽ thấy):', 'Ảnh chưa rõ món ăn')
          if (r) act('tu_choi', r)
        }}>Từ chối</button>
      )}
      {status === 'da_duyet' && <button disabled={pending} className={btnClass('ghost', 'sm')} onClick={() => act(pinned ? 'bo_ghim' : 'ghim')}>{pinned ? 'Bỏ ghim' : 'Ghim lên đầu'}</button>}
      {status === 'da_duyet' && <button disabled={pending} className={btnClass('ghost', 'sm')} onClick={() => { if (confirm('Ẩn bài này khỏi Mini App?')) act('an') }}>Ẩn</button>}
      <Feedback error={error} message={message} />
    </div>
  )
}
