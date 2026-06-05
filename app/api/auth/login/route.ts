import { NextRequest, NextResponse } from 'next/server'
import { initDb, getStaffByEmail, updateLastLogin } from '@/lib/db'
import { verifyPassword, createToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    await initDb()
    const body = await req.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email và password là bắt buộc' },
        { status: 400 }
      )
    }

    const staff = await getStaffByEmail(email)
    if (!staff) {
      return NextResponse.json(
        { error: 'Email hoặc mật khẩu không chính xác' },
        { status: 401 }
      )
    }

    if (staff.status === 'inactive') {
      return NextResponse.json(
        { error: 'Tài khoản đã bị khóa' },
        { status: 401 }
      )
    }

    const isValidPassword = await verifyPassword(password, staff.password_hash)
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Email hoặc mật khẩu không chính xác' },
        { status: 401 }
      )
    }

    // Update last login
    await updateLastLogin(staff.id)

    // Create JWT token
    const token = await createToken({
      id: staff.id,
      email: staff.email,
      role: staff.role as 'admin' | 'staff',
    })

    return NextResponse.json({
      token,
      user: {
        id: staff.id,
        email: staff.email,
        name: staff.name,
        role: staff.role,
      },
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Lỗi server' },
      { status: 500 }
    )
  }
}
