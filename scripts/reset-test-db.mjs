// Xoá và tạo lại database TEST (haco_test hoặc TEST_DB_NAME) trên PostgreSQL dev trong máy, để mỗi lần chạy test bắt đầu sạch.
// Không bao giờ đụng haco_dev hay Supabase.
import postgres from 'postgres'

// Tên database lấy từ TEST_DB_NAME (mặc định haco_test) để 2 phiên/2 người chạy test song song không giẫm lên nhau.
const name = process.env.TEST_DB_NAME || 'haco_test'
if (!/^haco_test[a-z0-9_]*$/.test(name)) { console.error('TEST_DB_NAME phải bắt đầu bằng haco_test'); process.exit(1) }
const sql = postgres('postgres://haco:haco@127.0.0.1:54329/postgres', { onnotice: () => {} })
await sql.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`)
await sql.unsafe(`CREATE DATABASE ${name}`)
await sql.end()
