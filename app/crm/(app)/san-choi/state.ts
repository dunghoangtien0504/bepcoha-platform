import { cache } from 'react'
import { playerState } from '@/lib/crm/san-choi'

/** Một lần tính trạng thái người chơi cho cả layout và trang trong cùng một lượt tải. */
export const meState = cache((staffId: number) => playerState(staffId))
