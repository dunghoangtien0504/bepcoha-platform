import { NextRequest, NextResponse } from 'next/server'
import { initDb, getAllGiftLeads, getAllCourseLeads } from '@/lib/db'
import { verifyAuthHeader } from '@/lib/auth'

export async function GET(req: NextRequest) {
  // Ưu tiên JWT auth
  const authHeader = req.headers.get('Authorization')
  const user = await verifyAuthHeader(authHeader)

  // Fallback: check x-admin-password header (legacy) — fail-closed, không default
  if (!user) {
    const adminPassword = process.env.ADMIN_PASSWORD
    const headerPassword = req.headers.get('x-admin-password')
    if (!adminPassword || headerPassword !== adminPassword) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  await initDb()
  const giftLeads = await getAllGiftLeads()
  const courseLeads = await getAllCourseLeads()

  return NextResponse.json({
    giftLeads,
    courseLeads,
    stats: {
      totalGiftLeads: giftLeads.length,
      totalCourseLeads: courseLeads.length,
      paidLeads: courseLeads.filter((l) => l.payment_status === 'paid').length,
      revenue: courseLeads
        .filter((l) => l.payment_status === 'paid')
        .reduce((sum, l) => sum + (l.amount || 0), 0),
    },
  })
}
