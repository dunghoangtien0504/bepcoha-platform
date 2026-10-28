/**
 * Gộp "khách đã từ chối" và "khách nằm nhóm đối chứng" thành MỘT cờ do_not_contact,
 * và bỏ cột opted_out_at khỏi dữ liệu trả ra: nếu để cả hai, người xem suy ra được ai là nhóm đối chứng
 * (do_not_contact = true nhưng opted_out_at rỗng) và có thể liên hệ nhóm đó, làm hỏng phép đo.
 */
export function maskContactFlags<T extends { id: number; opted_out_at?: string | null }>(
  c: T, holdout: Set<number>,
): Omit<T, 'opted_out_at'> & { do_not_contact: boolean } {
  const { opted_out_at, ...rest } = c
  return { ...rest, do_not_contact: !!opted_out_at || holdout.has(c.id) }
}
