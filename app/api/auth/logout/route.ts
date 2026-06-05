import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  // Logout is handled client-side by removing the token
  // This endpoint can be used for audit purposes if needed
  return NextResponse.json({ message: 'Đã đăng xuất thành công' })
}
