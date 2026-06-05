import { NextRequest, NextResponse } from 'next/server'
import { initDb, getCourseSettings, updateCourseSettings } from '@/lib/db'
import { verifyAuthHeader } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    await initDb()
    const settings = await getCourseSettings()
    return NextResponse.json(settings)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Lỗi server' },
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest) {
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
    const { courseName, coursePrice, discountPrice, courseDescription } = body

    const updated = await updateCourseSettings(
      courseName,
      coursePrice,
      discountPrice,
      courseDescription
    )

    return NextResponse.json({
      message: 'Cập nhật thành công',
      settings: updated,
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Lỗi server' },
      { status: 500 }
    )
  }
}
