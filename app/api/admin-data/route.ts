import { NextRequest, NextResponse } from 'next/server'
import { initDb, getAllGiftLeads, getAllCourseLeads, getAllStnOrders, getAllKdxOrders } from '@/lib/db'
import { verifyAuthHeader } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  const user = await verifyAuthHeader(authHeader)

  if (!user) {
    const adminPassword = process.env.ADMIN_PASSWORD
    const headerPassword = req.headers.get('x-admin-password')
    if (!adminPassword || headerPassword !== adminPassword) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  await initDb()
  const [giftLeads, courseLeads, stnOrders, kdxOrders] = await Promise.all([
    getAllGiftLeads(),
    getAllCourseLeads(),
    getAllStnOrders(),
    getAllKdxOrders(),
  ])

  const paidCourse = courseLeads.filter((l) => l.payment_status === 'paid')
  const paidStn = stnOrders.filter((o) => o.payment_status === 'paid')
  const paidKdx = kdxOrders.filter((o) => o.payment_status === 'paid')

  return NextResponse.json({
    giftLeads,
    courseLeads,
    stnOrders,
    kdxOrders,
    stats: {
      totalGiftLeads: giftLeads.length,
      totalCourseLeads: courseLeads.length,
      paidLeads: paidCourse.length,
      revenue: paidCourse.reduce((s, l) => s + (l.amount || 0), 0),
      stnTotal: stnOrders.length,
      stnPaid: paidStn.length,
      stnRevenue: paidStn.reduce((s, o) => s + (o.total_price || 0), 0),
      kdxTotal: kdxOrders.length,
      kdxPaid: paidKdx.length,
      kdxRevenue: paidKdx.reduce((s, o) => s + (o.total_price || 0), 0),
    },
  })
}
