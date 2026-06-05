import { NextRequest, NextResponse } from 'next/server'
import {
  initDb,
  getStaffById,
  updateStaffStatus,
  updateStaffRole,
  insertAuditLog,
} from '@/lib/db'
import { verifyAuthHeader } from '@/lib/auth'

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const staffId = parseInt(id)
    const oldStaff = await getStaffById(staffId)

    if (!oldStaff) {
      return NextResponse.json(
        { error: 'Nhân viên không tồn tại' },
        { status: 404 }
      )
    }

    const body = await req.json()
    const { status, role } = body

    let updatedStaff = oldStaff

    if (status && ['active', 'inactive'].includes(status)) {
      updatedStaff = (await updateStaffStatus(staffId, status)) || oldStaff
      await insertAuditLog(
        payload.id,
        'UPDATE',
        'staff',
        staffId,
        { status: oldStaff.status },
        { status: updatedStaff.status },
        getClientIp(req)
      )
    }

    if (role && ['admin', 'staff'].includes(role)) {
      updatedStaff = (await updateStaffRole(staffId, role)) || updatedStaff
      await insertAuditLog(
        payload.id,
        'UPDATE',
        'staff',
        staffId,
        { role: oldStaff.role },
        { role: updatedStaff.role },
        getClientIp(req)
      )
    }

    return NextResponse.json({
      message: 'Cập nhật thành công',
      staff: updatedStaff,
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Lỗi server' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const staffId = parseInt(id)

    if (staffId === payload.id) {
      return NextResponse.json(
        { error: 'Không thể xóa chính mình' },
        { status: 400 }
      )
    }

    const oldStaff = await getStaffById(staffId)
    if (!oldStaff) {
      return NextResponse.json(
        { error: 'Nhân viên không tồn tại' },
        { status: 404 }
      )
    }

    await updateStaffStatus(staffId, 'inactive')
    await insertAuditLog(
      payload.id,
      'DELETE',
      'staff',
      staffId,
      {
        id: oldStaff.id,
        name: oldStaff.name,
        email: oldStaff.email,
        role: oldStaff.role,
        status: oldStaff.status,
      },
      { status: 'inactive' },
      getClientIp(req)
    )

    return NextResponse.json({
      message: 'Xóa thành công',
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Lỗi server' },
      { status: 500 }
    )
  }
}
