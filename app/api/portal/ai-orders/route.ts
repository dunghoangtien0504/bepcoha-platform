import { NextRequest, NextResponse } from 'next/server'
import { initDb, getAllAiOrders } from '@/lib/db'

function checkAuth(req: NextRequest): boolean {
  const auth = req.headers.get('Authorization') || ''
  const token = auth.replace(/^Bearer\s+/i, '').trim()
  const expected = process.env.ADMIN_PASSWORD || 'hacofood2024'
  return token === expected
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await initDb()
  const orders = await getAllAiOrders(200)
  return NextResponse.json({ orders })
}
