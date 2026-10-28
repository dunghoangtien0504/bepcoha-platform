'use client'
// Giá trị nhớ theo máy (localStorage) dùng an toàn với SSR: máy chủ luôn thấy giá trị mặc định, trình duyệt đọc ngay sau khi gắn.
// Trình duyệt chặn lưu (chế độ riêng tư) thì chạy bằng giá trị mặc định, không lỗi.
import { useCallback, useMemo, useSyncExternalStore } from 'react'

const EVT = 'haco-store'

export function readStored(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}

export function writeStored(key: string, value: unknown) {
  try { localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value)) } catch { /* bị chặn: bỏ qua */ }
  window.dispatchEvent(new Event(EVT))
}

function subscribe(cb: () => void) {
  window.addEventListener(EVT, cb)
  window.addEventListener('storage', cb)
  return () => { window.removeEventListener(EVT, cb); window.removeEventListener('storage', cb) }
}

/** [giá trị, ghi] — fallback nên là hằng số khai báo ngoài component. */
export function useStored<T>(key: string, fallback: T): [T, (v: T) => void] {
  const raw = useSyncExternalStore(subscribe, () => readStored(key), () => null)
  const value = useMemo(() => {
    if (raw === null) return fallback
    try { return JSON.parse(raw) as T } catch { return raw as unknown as T }
  }, [raw, fallback])
  const set = useCallback((v: T) => writeStored(key, v), [key])
  return [value, set]
}

/** Giá trị chỉ có ở trình duyệt (vd máy có BarcodeDetector không); máy chủ trả server. */
export function useClientValue<T>(get: () => T, server: T): T {
  return useSyncExternalStore(subscribe, get, () => server)
}
