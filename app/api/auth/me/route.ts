import { NextRequest, NextResponse } from 'next/server'
import { initDb, getStaffById } from '@/lib/db'
import { verifyAuthHeader } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    await initDb()
    const authHeader = req.headers.get('authorization')
    const payload = await verifyAuthHeader(authHeader)

    if (!payload) {
      return NextResponse.json(
        { error: 'Chưa xác thực' },
        { status: 401 }
      )
    }

    const staff = await getStaffById(payload.id)
    if (!staff) {
      return NextResponse.json(
        { error: 'Người dùng không tồn tại' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      id: staff.id,
      email: staff.email,
      name: staff.name,
      role: staff.role,
      status: staff.status,
      lastLogin: staff.last_login,
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Lỗi server' },
      { status: 500 }
    )
  }
}
