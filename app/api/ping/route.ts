import { NextResponse } from 'next/server'

export async function GET() {
  const pw = process.env.ADMIN_PASSWORD
  return NextResponse.json({
    version: 'v2-fixed',
    pw_set: pw !== undefined,
    pw_len: pw?.length ?? 0,
    pw_preview: pw ? pw[0] + '***' + pw[pw.length - 1] : 'NOT_SET',
  })
}
