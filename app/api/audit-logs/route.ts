import { NextRequest, NextResponse } from 'next/server'
import { initDb, getAuditLogsByFilters } from '@/lib/db'
import { verifyAuthHeader } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    await initDb()
    const authHeader = req.headers.get('authorization')
    const payload = await verifyAuthHeader(authHeader)

    if (!payload || payload.role !== 'admin') {
      return NextResponse.json(
        { error: 'Không có quyền' },
        { status: 403 }
      )
    }

    const searchParams = req.nextUrl.searchParams
    const action = searchParams.get('action') || undefined
    const tableName = searchParams.get('table') || undefined
    const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined
    const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    const logs = await getAuditLogsByFilters(
      action,
      tableName,
      startDate,
      endDate,
      limit,
      offset
    )

    return NextResponse.json({
      logs,
      count: logs.length,
      limit,
      offset,
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Lỗi server' },
      { status: 500 }
    )
  }
}
