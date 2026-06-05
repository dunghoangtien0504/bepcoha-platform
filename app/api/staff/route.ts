import { NextRequest, NextResponse } from 'next/server'
import { initDb, getAllStaff } from '@/lib/db'
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

    const staff = await getAllStaff()
    return NextResponse.json({ staff })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Lỗi server' },
      { status: 500 }
    )
  }
}
