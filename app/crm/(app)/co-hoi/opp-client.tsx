'use client'
import { api, useAction, Feedback } from '../../_components/client'

const STAGES = [['moi', 'Mới'], ['tu_van', 'Đang tư vấn'], ['bao_gia', 'Đã báo giá'], ['dam_phan', 'Đàm phán'], ['da_chot', 'Đã chốt'], ['khong_chot', 'Không chốt']]

export function StageSelect({ id, stage }: { id: number; stage: string }) {
  const { run, pending, error } = useAction()
  return (
    <div className="mt-2">
      <select disabled={pending} defaultValue={stage} className="w-full rounded border border-stone-300 px-1.5 py-1 text-xs"
        onChange={e => {
          const v = e.target.value
          let lost_reason: string | null = null
          if (v === 'khong_chot') { lost_reason = prompt('Vì sao không chốt? (để rút kinh nghiệm)'); if (!lost_reason) { e.target.value = stage; return } }
          run(() => api('/api/crm/opportunities', 'PATCH', { id, stage: v, lost_reason }))
        }}>
        {STAGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      <Feedback error={error} />
    </div>
  )
}
