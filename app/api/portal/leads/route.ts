import { NextRequest, NextResponse } from 'next/server'
import { initDb, getDb } from '@/lib/db'
import { checkAdminAuth } from '@/lib/admin-auth'

export async function GET(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await initDb()
  const sql = getDb()

  const course = req.nextUrl.searchParams.get('course') || 'all'
  const status = req.nextUrl.searchParams.get('status') || 'all'

  let rows
  if (course !== 'all' && status !== 'all') {
    rows = await sql`
      SELECT * FROM course_leads
      WHERE payment_ref LIKE ${coursePrefix(course) + '%'}
        AND payment_status = ${status}
      ORDER BY created_at DESC
    `
  } else if (course !== 'all') {
    rows = await sql`
      SELECT * FROM course_leads
      WHERE payment_ref LIKE ${coursePrefix(course) + '%'}
      ORDER BY created_at DESC
    `
  } else if (status !== 'all') {
    rows = await sql`
      SELECT * FROM course_leads
      WHERE payment_status = ${status}
      ORDER BY created_at DESC
    `
  } else {
    rows = await sql`SELECT * FROM course_leads ORDER BY created_at DESC`
  }

  const leads = (rows as Record<string, unknown>[]).map(r => ({
    ...r,
    course_name: detectCourse(String(r.payment_ref || '')),
  }))

  // Stats
  const allRows = (await sql`SELECT payment_status, amount FROM course_leads`) as unknown as { payment_status: string; amount: number }[]
  const stats = {
    total: allRows.length,
    paid: allRows.filter(r => r.payment_status === 'paid').length,
    pending: allRows.filter(r => r.payment_status !== 'paid').length,
    revenue: allRows.filter(r => r.payment_status === 'paid').reduce((sum, r) => sum + (Number(r.amount) || 0), 0),
    pendingRevenue: allRows.filter(r => r.payment_status !== 'paid').reduce((sum, r) => sum + (Number(r.amount) || 0), 0),
  }

  return NextResponse.json({ leads, stats })
}

function coursePrefix(course: string): string {
  if (course === 'dua-ca') return 'DH'
  if (course === 'rau-ma') return 'RM'
  return ''
}

function detectCourse(ref: string): string {
  if (ref.startsWith('DH')) return 'Dưa Cà Muối'
  if (ref.startsWith('RM')) return 'Rau Má Đậu Xanh'
  return 'Khác'
}
