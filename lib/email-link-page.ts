// Trang HTML tối giản cho link trong email (huỷ nhận tin, xác nhận nhận tin).
// Link chỉ HIỆN NÚT; thao tác thật chạy bằng POST — để trình quét link của hộp thư không tự huỷ/tự xác nhận thay khách.
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function linkPage(title: string, body: string, form?: { action: string; button: string }): Response {
  const f = form ? `<form method="post" action="${esc(form.action)}"><button style="background:#065f46;color:#fff;border:0;border-radius:10px;padding:12px 22px;font-size:16px;cursor:pointer">${esc(form.button)}</button></form>` : ''
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title></head>
<body style="font-family:system-ui,Arial,sans-serif;background:#f5f5f4;margin:0;padding:40px 16px;color:#1c1917"><div style="max-width:440px;margin:0 auto;background:#fff;border-radius:16px;padding:28px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.08)">
<div style="font-size:12px;letter-spacing:.1em;color:#047857;font-weight:600">BẾP CÔ HẠ</div><h1 style="font-size:22px;margin:8px 0 12px">${esc(title)}</h1><p style="line-height:1.6;color:#57534e">${esc(body)}</p>${f}</div></body></html>`
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })
}
