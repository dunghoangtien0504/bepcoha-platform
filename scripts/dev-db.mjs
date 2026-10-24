// PostgreSQL chạy ngay trên máy để phát triển/thử nghiệm (KHÔNG đụng Supabase thật).
// Chạy: node scripts/dev-db.mjs   → giữ cửa sổ này mở; Ctrl+C để tắt.
// Dữ liệu nằm ở .devdb/ (đã .gitignore). Chuỗi kết nối: postgres://haco:haco@127.0.0.1:54329/haco_dev
import EmbeddedPostgres from 'embedded-postgres'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = join(root, '.devdb')
const fresh = !existsSync(join(dataDir, 'PG_VERSION'))

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'haco',
  password: 'haco',
  port: 54329,
  persistent: true,
  onLog: () => {},
})

if (fresh) await pg.initialise()
await pg.start()
if (fresh) await pg.createDatabase('haco_dev')
console.log('PostgreSQL dev đang chạy: postgres://haco:haco@127.0.0.1:54329/haco_dev')

const stop = async () => { await pg.stop(); process.exit(0) }
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
setInterval(() => {}, 1 << 30)
