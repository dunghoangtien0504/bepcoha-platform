#!/usr/bin/env node
// Sao lưu database CRM ra file .sql.gz có ghi ngày (nền móng "Bền", Buổi 2). Chạy hằng đêm bằng cron/launchd/GitHub Actions.
// Dùng: DATABASE_URL=... node scripts/backup-db.mjs [thư-mục-đích]   (mặc định ./backups.nosync — iCloud không đồng bộ)
// Cần pg_dump cùng bản lớn với máy chủ trên PATH. Giữ 14 bản mới nhất. Mỗi thứ Hai khôi phục thử 1 bản vào database tạm.
import { spawn } from 'node:child_process'
import { createWriteStream, mkdirSync, readdirSync, unlinkSync } from 'node:fs'
import { createGzip } from 'node:zlib'
import { join } from 'node:path'

const url = process.env.DATABASE_URL
if (!url) { console.error('Thiếu DATABASE_URL'); process.exit(1) }
const dir = process.argv[2] || 'backups.nosync'
const KEEP = Number(process.env.BACKUP_KEEP || 14)
mkdirSync(dir, { recursive: true })
const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16)
const file = join(dir, `haco-crm-${stamp}.sql.gz`)

const dump = spawn('pg_dump', ['--no-owner', '--no-privileges', '--dbname', url], { stdio: ['ignore', 'pipe', 'inherit'] })
dump.stdout.pipe(createGzip()).pipe(createWriteStream(file))
dump.on('error', e => { console.error('Không chạy được pg_dump:', e.message); process.exit(1) })
dump.on('close', code => {
  if (code !== 0) { console.error(`pg_dump lỗi (mã ${code}), bản sao lưu không dùng được: ${file}`); process.exit(1) }
  const old = readdirSync(dir).filter(f => /^haco-crm-.*\.sql\.gz$/.test(f)).sort().reverse().slice(KEEP)
  for (const f of old) unlinkSync(join(dir, f))
  console.log(`Đã sao lưu: ${file}${old.length ? ` · xoá ${old.length} bản cũ` : ''}`)
})
