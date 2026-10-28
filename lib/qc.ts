import { GoogleGenerativeAI } from '@google/generative-ai'
import { getDb } from './db'
import { notifyConversationAlert } from './telegram'

// Google hay gỡ model cũ (2.5-flash đã bị gỡ với tài khoản mới) nên mặc định dùng bí danh luôn trỏ bản flash mới nhất; đặt GEMINI_MODEL để cố định. Dùng bản lite: rẻ hơn và hạn mức miễn phí cao hơn, đủ cho việc chấm hội thoại.
export const AI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest'
// Giá ước tính USD / 1 triệu token, chỉnh bằng env nếu bảng giá model đổi.
const USD_PER_M_INPUT = Number(process.env.AI_USD_PER_M_INPUT) || 0.10
const USD_PER_M_OUTPUT = Number(process.env.AI_USD_PER_M_OUTPUT) || 0.40
const VND_PER_USD = Number(process.env.AI_USD_VND) || 26_000

export interface QcMessage { from_customer: boolean; content: string; sender_name?: string; timestamp?: string }
export interface QcViolation { severity: 'nghiem_trong' | 'can_cai_thien'; description: string; evidence: string }
export interface QcCriterion { name: string; score: number; passed: boolean; comment: string }
export interface QcJob { id: number; name: string; rules_prompt: string; pass_threshold: number; batch_size: number }

export interface QcResult {
  id: string
  score: number
  verdict: 'pass' | 'fail'
  customer_needs: string
  sales_name: string
  evaluation: string
  violations: QcViolation[]
  criteria: QcCriterion[]
  summary: string
  suggestion: string
  tags: string[]
  needs_attention: boolean
  issue: string
}

// Chặn bão tin nhắn Telegram: mỗi lượt chạy chỉ báo tối đa vài hội thoại nghiêm trọng nhất/mới nhất.
const MAX_ALERTS_PER_RUN = 5

export async function logSystem(level: 'info' | 'warn' | 'error', source: string, message: string, meta?: unknown) {
  try {
    const sql = getDb()
    await sql`INSERT INTO system_logs (level, source, message, meta) VALUES (${level}, ${source}, ${message.slice(0, 500)}, ${meta === undefined ? null : sql.json(meta as never)})`
  } catch (e) { console.error('[logSystem]', e) }
}

export async function logNotification(channel: string, kind: string, subject: string, success: boolean, error?: string) {
  try {
    const sql = getDb()
    await sql`INSERT INTO notification_logs (channel, kind, subject, success, error) VALUES (${channel}, ${kind}, ${subject.slice(0, 300)}, ${success}, ${error ?? null})`
  } catch (e) { console.error('[logNotification]', e) }
}

async function logUsage(jobId: number | null, conversations: number, input: number, output: number) {
  const cost = (input / 1e6) * USD_PER_M_INPUT * VND_PER_USD + (output / 1e6) * USD_PER_M_OUTPUT * VND_PER_USD
  const sql = getDb()
  await sql`INSERT INTO ai_usage_logs (job_id, model, conversations, input_tokens, output_tokens, cost_vnd) VALUES (${jobId}, ${AI_MODEL}, ${conversations}, ${input}, ${output}, ${cost})`
}

function convText(msgs: QcMessage[]): string {
  return msgs
    .map(m => m.from_customer ? `Khách: ${m.content}` : `NV${m.sender_name ? ` (${m.sender_name})` : ''}: ${m.content}`)
    .join('\n').slice(-6_000)
}

function parseJsonArray(raw: string): Record<string, unknown>[] | null {
  try {
    const cleaned = raw.replace(/```json|```/gi, '').trim()
    const start = cleaned.indexOf('['), end = cleaned.lastIndexOf(']')
    if (start === -1 || end === -1) return null
    const arr = JSON.parse(cleaned.slice(start, end + 1))
    return Array.isArray(arr) ? arr : null
  } catch { return null }
}

/** Chấm nhiều hội thoại trong MỘT lần gọi AI (batch) để tiết kiệm token. */
export async function analyzeBatch(items: { id: string; messages: QcMessage[] }[], job: QcJob): Promise<QcResult[]> {
  if (!process.env.GEMINI_API_KEY || !items.length) return []
  const blocks = items.map(it => `=== HỘI THOẠI id=${it.id} ===\n${convText(it.messages)}`).join('\n\n')
  const prompt = `Bạn là chuyên gia QA chăm sóc khách hàng. Chấm chất lượng từng hội thoại bán hàng dưới đây theo TIÊU CHÍ:

${job.rules_prompt}

Trả về JSON THUẦN (không markdown): MỘT MẢNG, mỗi hội thoại một phần tử đúng cấu trúc:
{
  "id": "<id hội thoại như đề bài>",
  "score": <số nguyên 0-100, chất lượng chăm sóc của nhân viên; 100 là xuất sắc>,
  "customer_needs": "Nhu cầu của khách trong 1-2 câu",
  "sales_name": "Tên nhân viên thật trả lời (từ nhãn 'NV (Tên)'); nếu chỉ có bot thì 'Tự động (Botcake)'",
  "evaluation": "Nhận xét ngắn 1-2 câu",
  "summary": "Phân tích tổng quan 2-4 câu: diễn biến hội thoại, nhân viên làm tốt gì, sai/thiếu gì, và VÌ SAO ra điểm này (đặc biệt nếu điểm thấp)",
  "criteria": [ { "name": "tên ngắn của từng tiêu chí ở trên (đúng thứ tự, đủ tất cả tiêu chí)", "score": <0-100 cho riêng tiêu chí này>, "passed": <true/false>, "comment": "1 câu giải thích, dẫn chứng cụ thể từ hội thoại" } ],
  "suggestion": "1-2 câu: nhân viên nên làm gì để xử lý/cải thiện (ví dụ tin nhắn nên gửi lại cho khách)",
  "violations": [ { "severity": "nghiem_trong" | "can_cai_thien", "description": "vi phạm tiêu chí nào", "evidence": "trích NGUYÊN VĂN tin nhắn làm bằng chứng" } ],
  "tags": ["1-4 tag ngắn tiếng Việt phân loại: vd 'Khiếu nại', 'Hỏi giá', 'Chốt đơn', 'Hỗ trợ chung'"],
  "needs_attention": <true nếu khách bức xúc, bị bỏ lơ, mất khách rõ ràng, sự cố đơn hàng; ngược lại false>,
  "issue": "Nếu needs_attention: mô tả vấn đề ngắn gọn, ngược lại chuỗi rỗng"
}
Chỉ đưa vào "violations" vi phạm có bằng chứng thật; nếu không có vi phạm thì mảng rỗng.

${blocks}`

  const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  const model = genai.getGenerativeModel({ model: AI_MODEL })
  const res = await model.generateContent(prompt)
  const usage = res.response.usageMetadata
  await logUsage(job.id, items.length, usage?.promptTokenCount ?? 0, usage?.candidatesTokenCount ?? 0)

  const arr = parseJsonArray(res.response.text())
  if (!arr) { await logSystem('error', 'ai', 'AI trả về sai định dạng (batch)', { ids: items.map(i => i.id) }); return [] }

  const out: QcResult[] = []
  for (const o of arr) {
    const id = String(o.id ?? '')
    if (!items.some(i => i.id === id)) continue
    const score = Math.max(0, Math.min(100, Math.round(Number(o.score) || 0)))
    const violations: QcViolation[] = Array.isArray(o.violations)
      ? (o.violations as Record<string, unknown>[]).map(v => ({
          severity: v.severity === 'nghiem_trong' ? 'nghiem_trong' as const : 'can_cai_thien' as const,
          description: String(v.description || '').slice(0, 300),
          evidence: String(v.evidence || '').slice(0, 400),
        })).filter(v => v.description).slice(0, 8)
      : []
    const hasSevere = violations.some(v => v.severity === 'nghiem_trong')
    out.push({
      id, score,
      verdict: score >= job.pass_threshold && !hasSevere ? 'pass' : 'fail',
      customer_needs: String(o.customer_needs || ''),
      sales_name: String(o.sales_name || ''),
      evaluation: String(o.evaluation || ''),
      violations,
      criteria: Array.isArray(o.criteria)
        ? (o.criteria as Record<string, unknown>[]).map(c => ({
            name: String(c.name || '').slice(0, 120),
            score: Math.max(0, Math.min(100, Math.round(Number(c.score) || 0))),
            passed: c.passed === true,
            comment: String(c.comment || '').slice(0, 400),
          })).filter(c => c.name).slice(0, 12)
        : [],
      summary: String(o.summary || '').slice(0, 1200),
      suggestion: String(o.suggestion || '').slice(0, 600),
      tags: Array.isArray(o.tags) ? (o.tags as unknown[]).map(t => String(t).trim()).filter(Boolean).slice(0, 4) : [],
      needs_attention: o.needs_attention === true || hasSevere,
      issue: String(o.issue || ''),
    })
  }
  return out
}

export async function saveQcResult(r: QcResult, meta: { customerName?: string; pageName?: string; jobId: number }) {
  const sql = getDb()
  const stars = Math.max(1, Math.min(5, Math.round(r.score / 20)))
  await sql`
    INSERT INTO conversation_evaluations (
      pancake_conversation_id, customer_name, page_name, ai_summary, customer_needs, sales_name, sales_evaluation,
      ai_score, score100, verdict, violations, job_id, needs_attention, issue, tags, analyzed_at, analysis
    ) VALUES (
      ${r.id}, ${meta.customerName ?? null}, ${meta.pageName ?? null}, ${r.customer_needs.slice(0, 200)}, ${r.customer_needs},
      ${r.sales_name}, ${r.evaluation}, ${stars}, ${r.score}, ${r.verdict}, ${sql.json(r.violations as never)}, ${meta.jobId},
      ${r.needs_attention}, ${r.needs_attention ? (r.issue || r.violations[0]?.description || null) : null}, ${JSON.stringify(r.tags)}, NOW(),
      ${sql.json({ criteria: r.criteria, summary: r.summary, suggestion: r.suggestion } as never)}
    )
    ON CONFLICT (pancake_conversation_id) DO UPDATE SET
      ai_summary = EXCLUDED.ai_summary, customer_needs = EXCLUDED.customer_needs, sales_name = EXCLUDED.sales_name,
      sales_evaluation = EXCLUDED.sales_evaluation, ai_score = EXCLUDED.ai_score, score100 = EXCLUDED.score100,
      verdict = EXCLUDED.verdict, violations = EXCLUDED.violations, job_id = EXCLUDED.job_id, analysis = EXCLUDED.analysis,
      needs_attention = EXCLUDED.needs_attention, issue = EXCLUDED.issue, tags = EXCLUDED.tags,
      customer_name = COALESCE(EXCLUDED.customer_name, conversation_evaluations.customer_name),
      page_name = COALESCE(EXCLUDED.page_name, conversation_evaluations.page_name),
      analyzed_at = NOW(), updated_at = NOW()
  `
}

/** Chạy 1 tác vụ AI trên danh sách hội thoại: chia lô, chấm, lưu, cảnh báo Telegram. */
export async function runQcJob(job: QcJob, convs: { id: string; customer_name: string; page_name: string; messages: QcMessage[]; last_message_at?: string | Date | null }[], opts: { alert?: boolean } = {}) {
  const sql = getDb()
  const summary = { analyzed: 0, pass: 0, fail: 0, alerts: 0, errors: 0, quotaExceeded: false }
  const size = Math.max(1, Math.min(job.batch_size || 3, 8))

  for (let i = 0; i < convs.length; i += size) {
    const chunk = convs.slice(i, i + size)
    try {
      const results = await analyzeBatch(chunk.map(c => ({ id: c.id, messages: c.messages })), job)
      if (!results.length) summary.errors++
      for (const r of results) {
        const c = chunk.find(x => x.id === r.id)!
        await saveQcResult(r, { customerName: c.customer_name, pageName: c.page_name, jobId: job.id })
        summary.analyzed++
        r.verdict === 'pass' ? summary.pass++ : summary.fail++
        // Chỉ báo Telegram cho hội thoại còn mới (24 giờ); hội thoại cũ vẫn được chấm và hiện ở mục Kết quả nhưng không làm phiền nhóm.
        const recent = !c.last_message_at || Date.now() - new Date(c.last_message_at).getTime() < 24 * 3600 * 1000
        if (opts.alert !== false && r.needs_attention && recent && summary.alerts < MAX_ALERTS_PER_RUN) {
          const claimed = await sql`
            UPDATE conversations SET alerted_at = NOW()
            WHERE pancake_conversation_id = ${r.id} AND (alerted_at IS NULL OR alerted_at < NOW() - INTERVAL '24 hours')
            RETURNING id
          `
          if (claimed.length) {
            const issue = r.issue || r.violations[0]?.description || 'Cần kiểm tra hội thoại'
            try {
              await notifyConversationAlert({ customerName: c.customer_name, pageName: c.page_name, issue })
              await logNotification('telegram', 'conversation_alert', `${c.customer_name}: ${issue}`, true)
              summary.alerts++
            } catch (e) {
              await logNotification('telegram', 'conversation_alert', `${c.customer_name}: ${issue}`, false, e instanceof Error ? e.message : String(e))
            }
          }
        }
      }
    } catch (e) {
      summary.errors++
      const msg = e instanceof Error ? e.message : String(e)
      await logSystem('error', 'ai', `Lỗi chấm lô: ${msg}`, { ids: chunk.map(c => c.id) })
      // Hết hạn mức (429): dừng luôn, gọi tiếp chỉ tốn thêm lỗi
      if (msg.includes('429')) { summary.quotaExceeded = true; break }
    }
  }
  await sql`UPDATE ai_jobs SET last_run_at = NOW(), last_result = ${sql.json(summary as never)} WHERE id = ${job.id}`
  return summary
}

export async function getEnabledJobs(): Promise<QcJob[]> {
  const sql = getDb()
  const rows = await sql`SELECT id, name, rules_prompt, pass_threshold, batch_size FROM ai_jobs WHERE enabled ORDER BY id`
  return rows as unknown as QcJob[]
}
