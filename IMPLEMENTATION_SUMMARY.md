# Hệ thống Admin Nâng cao - Tóm tắt triển khai

## Tổng quan

Xây dựng hệ thống admin nâng cao cho khóa học Dưa Cà Muối với:
- JWT authentication (JWT tokens)
- Quản lý nhân viên (tạo, sửa, xóa, quản lý quyền)
- Audit logging tự động (ghi lại mọi thay đổi dữ liệu)
- Cài đặt khóa học động
- 5 tabs UI: Nhận quà, Đăng ký, Nhân viên, Audit Log, Settings

## Files được tạo/cập nhật

### 1. Database Layer (lib/db.ts) - CẬP NHẬT
**Thêm schema:**
- `staff` table (id, name, email, password_hash, role, status, created_at, last_login)
- `audit_logs` table (id, user_id, action, table_name, record_id, old_value, new_value, created_at, ip_address)
- `course_settings` table (id, course_name, course_price, discount_price, course_description, updated_at)

**Thêm functions:**
- `insertStaff()` - Tạo nhân viên
- `updateStaffStatus()` - Cập nhật trạng thái (active/inactive)
- `updateStaffRole()` - Cập nhật quyền (admin/staff)
- `deleteStaff()` - Soft delete
- `getStaffByEmail()` - Lấy nhân viên theo email
- `getStaffById()` - Lấy nhân viên theo ID
- `getAllStaff()` - Lấy tất cả nhân viên hoạt động
- `updateLastLogin()` - Cập nhật thời gian đăng nhập cuối
- `insertAuditLog()` - Thêm audit log
- `getAuditLogs()` - Lấy audit logs (paginated)
- `getAuditLogsByFilters()` - Lấy audit logs với filters
- `getCourseSettings()` - Lấy cài đặt khóa học
- `updateCourseSettings()` - Cập nhật cài đặt khóa học

**Thêm types:**
- `Staff` - Thông tin nhân viên
- `StaffWithPassword` - Nhân viên kèm password_hash
- `AuditLog` - Log audit
- `AuditLogWithStaff` - Audit log kèm tên nhân viên
- `CourseSettings` - Cài đặt khóa học

### 2. Authentication Library - TẠO MỚI (lib/auth.ts)

```typescript
// Password hashing
hashPassword(plainPassword: string) -> Promise<string>
verifyPassword(plainPassword: string, hash: string) -> Promise<boolean>

// JWT tokens
createToken(payload: JWTPayload) -> Promise<string>
verifyToken(token: string) -> Promise<JWTPayload | null>

// Helpers
getTokenFromHeader(authHeader: string) -> string | null
verifyAuthHeader(authHeader: string) -> Promise<JWTPayload | null>
```

Dependencies: bcrypt, jose

### 3. API Routes - TẠO MỚI

#### Auth endpoints

**POST /api/auth/login**
- Request: { email, password }
- Response: { token, user: { id, email, name, role } }
- Tự động cập nhật last_login

**POST /api/auth/logout**
- Client-side logout (xóa token từ localStorage)

**GET /api/auth/me**
- Headers: Authorization: Bearer {token}
- Response: { id, email, name, role, status, lastLogin }

#### Staff Management endpoints

**GET /api/staff**
- Requires: admin role
- Response: { staff: Staff[] }

**POST /api/staff/create**
- Requires: admin role
- Request: { name, email, password, role }
- Auto: Hash password, log audit
- Response: { message, staff }

**PATCH /api/staff/:id**
- Requires: admin role
- Request: { role?, status? }
- Auto: Log audit cho mỗi update
- Response: { message, staff }

**DELETE /api/staff/:id**
- Requires: admin role
- Soft delete (status = 'inactive')
- Auto: Log audit
- Response: { message }

#### Audit Logs endpoint

**GET /api/audit-logs**
- Requires: admin role
- Query params: action, table, startDate, endDate, limit, offset
- Response: { logs: AuditLogWithStaff[], count, limit, offset }

#### Course Settings endpoint

**GET /api/settings/course**
- Public (no auth required)
- Response: CourseSettings

**PUT /api/settings/course**
- Requires: admin role
- Request: { courseName?, coursePrice?, discountPrice?, courseDescription? }
- Response: { message, settings }

### 4. Admin UI - CẬP NHẬT (app/admin/page.tsx)

**New features:**
- JWT-based login (email + password) thay vì simple password
- 5 tabs:
  1. **Nhận quà** - Danh sách gift leads (giữ nguyên)
  2. **Đăng ký khóa học** - Danh sách course leads (giữ nguyên)
  3. **Quản lý nhân viên** - Inline form + table với edit/delete
  4. **Lịch sử chỉnh sửa** - Audit log viewer với filters
  5. **Cài đặt khóa học** - Form chỉnh sửa course info

**UI Components:**
- Login form (email + password)
- Staff creation form (name, email, password, role)
- Staff table với dropdown inline edit (role, status)
- Delete button (soft delete)
- Audit log table với action badges
- Audit filter dropdowns
- Course settings form

**Auto-refresh:** Mỗi 30s fetch dữ liệu mới

## Configuration

### Environment Variables

Thêm vào `.env.local`:

```env
JWT_SECRET=your-secret-key-change-in-production
ADMIN_PASSWORD=hacofood2024  # For legacy admin endpoint
DATABASE_URL=postgresql://...
```

### Dependencies

Thêm vào package.json:

```json
{
  "dependencies": {
    "bcrypt": "^5.1.1",
    "jose": "^5.6.3"
  },
  "devDependencies": {
    "@types/bcrypt": "^5.0.2"
  }
}
```

## Security Features

1. **Password Hashing**: bcrypt với 10 salt rounds
2. **JWT Tokens**: 7 ngày expiry, stored in localStorage
3. **Authorization**: Role-based access control (admin vs staff)
4. **Audit Logging**: Tự động ghi mọi thay đổi
5. **IP Tracking**: Lưu IP address của request vào audit log
6. **Soft Delete**: Không xóa dữ liệu, chỉ set status = 'inactive'

## Database Schema Changes

```sql
-- New tables
CREATE TABLE staff (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES staff(id),
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  table_name TEXT NOT NULL CHECK (table_name IN ('gift_leads', 'course_leads', 'staff')),
  record_id INT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT
);

CREATE TABLE course_settings (
  id SERIAL PRIMARY KEY,
  course_name TEXT DEFAULT 'Khóa học Dưa Cà Muối',
  course_price INTEGER DEFAULT 1095000,
  discount_price INTEGER DEFAULT 299000,
  course_description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default course settings
INSERT INTO course_settings (course_name, course_price, discount_price)
VALUES ('Khóa học Dưa Cà Muối', 1095000, 299000);
```

## Build & Deployment

```bash
# Install dependencies
npm install

# Development
npm run dev

# Build
npm run build

# Production
npm start
```

Build status: ✅ All TypeScript checks pass

## Next Steps

1. Chạy script `CREATE_ADMIN.js` để tạo admin account đầu tiên
2. Login vào admin page với credentials
3. Thêm nhân viên mới từ tab "Quản lý nhân viên"
4. Xem audit logs từ tab "Lịch sử chỉnh sửa"
5. Cấu hình khóa học từ tab "Cài đặt khóa học"

## Documentation Files

- `ADMIN_SETUP.md` - Hướng dẫn chi tiết setup và sử dụng
- `CREATE_ADMIN.js` - Script tạo admin account
- `IMPLEMENTATION_SUMMARY.md` - File này

## Testing Checklist

- [ ] npm install
- [ ] npm run build (verify no errors)
- [ ] Create admin account bằng CREATE_ADMIN.js
- [ ] Login thành công
- [ ] Tạo nhân viên mới
- [ ] Chỉnh sửa nhân viên (role/status)
- [ ] Xóa nhân viên (soft delete)
- [ ] Xem audit logs
- [ ] Filter audit logs
- [ ] Cập nhật course settings
- [ ] Auto-refresh data mỗi 30s
- [ ] Token refresh (7 ngày)
