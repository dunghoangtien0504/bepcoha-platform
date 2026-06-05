import { NextResponse } from 'next/server'

export async function GET() {
  const raw = process.env.ADMIN_PASSWORD
  return NextResponse.json({
    exists: raw !== undefined,
    length: raw ? raw.length : 0,
    value: raw ? `${raw.substring(0, 3)}...${raw.substring(raw.length - 3)}` : 'undefined',
    trimmed_length: raw ? raw.trim().length : 0,
    chars: raw ? Array.from(raw).map(c => c.charCodeAt(0)) : [],
  })
}
