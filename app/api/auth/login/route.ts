import { NextRequest, NextResponse } from 'next/server'
import { initDb, getStaffByEmail, updateLastLogin } from '@/lib/db'
import { verifyPassword, createToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email và password là bắt buộc' },
        { status: 400 }
      )
    }

    // Special case: Admin login bằng ADMIN_PASSWORD (.env)
    // Cho phép bất kỳ email nào dùng ADMIN_PASSWORD để vào với quyền admin
    const adminPassword = process.env.ADMIN_PASSWORD || 'hacofood2026'
    if (password === adminPassword) {
      const token = await createToken({
        id: 0,
        email: email.toLowerCase().trim(),
        role: 'admin',
      })
      return NextResponse.json({
        token,
        user: {
          id: 0,
          email: email.toLowerCase().trim(),
          name: 'Admin',
          role: 'admin',
        },
      })
    }

    // Nhân viên: kiểm tra staff table
    await initDb()
    const staff = await getStaffByEmail(email.toLowerCase().trim())
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
