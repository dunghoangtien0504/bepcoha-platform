import { NextRequest, NextResponse } from 'next/server'
import { initDb, getAllAiOrders } from '@/lib/db'
import { checkAdminAuth } from '@/lib/admin-auth'

export async function GET(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await initDb()
  const orders = await getAllAiOrders(200)
  return NextResponse.json({ orders })
}
