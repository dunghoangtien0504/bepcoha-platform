import { NextRequest, NextResponse } from 'next/server'
import { initDb, insertStaff, insertAuditLog } from '@/lib/db'
import { verifyAuthHeader, hashPassword } from '@/lib/auth'

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

export async function POST(req: NextRequest) {
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

    const body = await req.json()
    const { name, email, password, role } = body

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Tên, email, và password là bắt buộc' },
        { status: 400 }
      )
    }

    if (!['admin', 'staff'].includes(role)) {
      return NextResponse.json(
        { error: 'Role không hợp lệ' },
        { status: 400 }
      )
    }

    const passwordHash = await hashPassword(password)
    const staff = await insertStaff(name, email, passwordHash, role)

    // Log audit
    await insertAuditLog(
      payload.id,
      'INSERT',
      'staff',
      staff.id,
      null,
      {
        id: staff.id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
        status: staff.status,
      },
      getClientIp(req)
    )

    return NextResponse.json({
      message: 'Tạo nhân viên thành công',
      staff: {
        id: staff.id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
        status: staff.status,
      },
    })
  } catch (error: any) {
    console.error('Error:', error)
    if (error.message?.includes('duplicate')) {
      return NextResponse.json(
        { error: 'Email đã tồn tại' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Lỗi server' },
      { status: 500 }
    )
  }
}
