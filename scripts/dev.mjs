// Chạy trang phát triển với Node cài ở ~/.local/node: Turbopack tự gọi lệnh `node` (để chạy PostCSS),
// nên thư mục chứa node phải có trong PATH của tiến trình con.
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = { ...process.env, PATH: `${dirname(process.execPath)}:${process.env.PATH || '/usr/bin:/bin'}`, NEXT_TELEMETRY_DISABLED: '1' }
const child = spawn(process.execPath, [join(root, 'node_modules/next/dist/bin/next'), 'dev', root, '-p', process.argv[2] || '3020'], { env, stdio: 'inherit' })
child.on('exit', code => process.exit(code ?? 0))
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => child.kill(s))
