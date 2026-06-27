<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ProjectPhase, WorkTask } from '@/api/types';
import { TASK_STATUS_LABELS } from '@/utils/work-labels';

const props = defineProps<{ phases: ProjectPhase[]; tasks: WorkTask[] }>();

const DAY_W = 40;
const PHASE_COLOR = '#6366f1';
const STATUS_COLOR: Record<string, string> = {
  todo: '#94a3b8',
  in_progress: '#3b82f6',
  review: '#f97316',
  completed: '#22c55e',
  cancelled: '#ef4444',
  blocked: '#94a3b8',
};
const LEGEND = [
  { label: 'Phase', color: PHASE_COLOR },
  { label: 'Chờ làm', color: STATUS_COLOR.todo },
  { label: 'Đang làm', color: STATUS_COLOR.in_progress },
  { label: 'Xem xét', color: STATUS_COLOR.review },
  { label: 'Hoàn thành', color: STATUS_COLOR.completed },
  { label: 'Hủy', color: STATUS_COLOR.cancelled },
];

const MS_DAY = 86_400_000;
const toDay = (iso: string | null): Date | null => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
};
const addDays = (d: Date, n: number): Date => new Date(d.getTime() + n * MS_DAY);
const diffDays = (a: Date, b: Date): number => Math.round((a.getTime() - b.getTime()) / MS_DAY);

interface Span {
  start: Date | null;
  end: Date | null;
}
const taskSpan = (t: WorkTask): Span => ({ start: toDay(t.startDate), end: toDay(t.dueDate ?? t.startDate) });
const phaseSpan = (phaseId: number): Span => {
  const ts = props.tasks.filter((t) => t.projectPhaseId === phaseId);
  const starts = ts.map((t) => toDay(t.startDate)).filter((d): d is Date => !!d);
  const ends = ts.map((t) => toDay(t.dueDate ?? t.startDate)).filter((d): d is Date => !!d);
  return {
    start: starts.length ? new Date(Math.min(...starts.map((d) => d.getTime()))) : null,
    end: ends.length ? new Date(Math.max(...ends.map((d) => d.getTime()))) : null,
  };
};

// --- Lọc theo phase/task khi click ---
const selected = ref<{ type: 'phase' | 'task'; id: number; label: string } | null>(null);
const selectPhase = (p: ProjectPhase): void => {
  selected.value = { type: 'phase', id: p.id, label: p.title };
};
const selectTask = (t: WorkTask): void => {
  selected.value = { type: 'task', id: t.id, label: t.title };
};
const reset = (): void => {
  selected.value = null;
};

interface Row {
  kind: 'phase' | 'task';
  id: number;
  label: string;
  span: Span;
  color: string;
  phase?: ProjectPhase;
  task?: WorkTask;
}
const rows = computed<Row[]>(() => {
  const out: Row[] = [];
  const phaseList =
    selected.value?.type === 'phase'
      ? props.phases.filter((p) => p.id === selected.value!.id)
      : selected.value?.type === 'task'
        ? props.phases.filter((p) => p.id === props.tasks.find((t) => t.id === selected.value!.id)?.projectPhaseId)
        : props.phases;

  for (const phase of phaseList) {
    out.push({ kind: 'phase', id: phase.id, label: phase.title, span: phaseSpan(phase.id), color: PHASE_COLOR, phase });
    let phaseTasks = props.tasks.filter((t) => t.projectPhaseId === phase.id);
    if (selected.value?.type === 'task') phaseTasks = phaseTasks.filter((t) => t.id === selected.value!.id);
    for (const task of phaseTasks) {
      out.push({
        kind: 'task',
        id: task.id,
        label: task.title,
        span: taskSpan(task),
        color: STATUS_COLOR[task.status] ?? '#94a3b8',
        task,
      });
    }
  }
  return out;
});

// --- Khung thời gian (snap theo tuần thứ 2 → CN) ---
const range = computed<{ start: Date; days: Date[] } | null>(() => {
  const dates: Date[] = [];
  for (const t of props.tasks) {
    const s = toDay(t.startDate);
    const e = toDay(t.dueDate ?? t.startDate);
    if (s) dates.push(s);
    if (e) dates.push(e);
  }
  if (dates.length === 0) return null;
  const min = new Date(Math.min(...dates.map((d) => d.getTime())));
  const max = new Date(Math.max(...dates.map((d) => d.getTime())));
  // lùi về thứ 2 đầu tuần, tiến tới CN cuối tuần
  const startDow = (min.getDay() + 6) % 7; // 0 = Mon
  const start = addDays(min, -startDow);
  const endDow = (max.getDay() + 6) % 7;
  const end = addDays(max, 6 - endDow);
  const days: Date[] = [];
  for (let d = start; d.getTime() <= end.getTime(); d = addDays(d, 1)) days.push(d);
  return { start, days };
});

const weeks = computed(() => {
  if (!range.value) return [];
  const out: { label: string; span: number }[] = [];
  for (let i = 0; i < range.value.days.length; i += 7) {
    const a = range.value.days[i];
    const b = range.value.days[Math.min(i + 6, range.value.days.length - 1)];
    const f = (d: Date): string => `${d.getDate().toString().padStart(2, '0')} ${d.toLocaleDateString('en', { month: 'short' })}, ${String(d.getFullYear()).slice(2)}`;
    out.push({ label: `${f(a)} – ${f(b)}`, span: Math.min(7, range.value.days.length - i) });
  }
  return out;
});

const isWeekend = (d: Date): boolean => d.getDay() === 0 || d.getDay() === 6;
const today = new Date();
const todayD = new Date(today.getFullYear(), today.getMonth(), today.getDate());
const isToday = (d: Date): boolean => d.getTime() === todayD.getTime();

const barStyle = (span: Span, color: string): Record<string, string> => {
  if (!range.value || !span.start || !span.end) return { display: 'none' };
  const left = diffDays(span.start, range.value.start) * DAY_W;
  const width = (diffDays(span.end, span.start) + 1) * DAY_W;
  return { left: `${left}px`, width: `${Math.max(width, DAY_W)}px`, background: color };
};

const MONTHS_UP = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
/**
 * Định dạng khoảng thời gian:
 * - 1 ngày: "15 JUN 26"
 * - cùng tháng: "15 - 17 JUN 26"
 * - khác tháng: "15 JUN - 17 JUL 26"
 */
const fmtRange = (span: Span): string => {
  const s = span.start;
  if (!s) return '—';
  const yy = (d: Date): string => String(d.getFullYear()).slice(2);
  const e = span.end && span.end.getTime() !== s.getTime() ? span.end : null;
  if (!e) return `${s.getDate()} ${MONTHS_UP[s.getMonth()]} ${yy(s)}`;
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${s.getDate()} - ${e.getDate()} ${MONTHS_UP[e.getMonth()]} ${yy(e)}`;
  }
  return `${s.getDate()} ${MONTHS_UP[s.getMonth()]} - ${e.getDate()} ${MONTHS_UP[e.getMonth()]} ${yy(e)}`;
};
const spanDays = (span: Span): number | string =>
  span.start && span.end ? diffDays(span.end, span.start) + 1 : '—';

const gridWidth = computed(() => (range.value ? range.value.days.length * DAY_W : 0));
</script>

<template>
  <div class="space-y-3">
    <div v-if="selected" class="flex">
      <div class="inline-flex items-center gap-2 rounded-lg border border-brand/30 bg-brand-light/40 px-3 py-1.5 text-sm">
        <span class="material-symbols-rounded text-[16px] text-brand">filter_alt</span>
        <span class="font-medium text-slate-700">{{ selected.label }}</span>
        <button class="flex items-center gap-1 text-brand hover:underline" @click="reset">
          <span class="material-symbols-rounded text-[16px]">close</span>Xem tất cả
        </button>
      </div>
    </div>

    <div v-if="!range" class="card py-10 text-center text-sm text-slate-400">
      Chưa có dữ liệu thời gian (công việc cần ngày bắt đầu/hạn hoàn thành).
    </div>

    <div v-else class="overflow-auto rounded-xl border border-slate-200 bg-white max-h-[calc(100vh-300px)]">
      <div class="flex min-w-max">
        <!-- Cột trái cố định (sticky) — freeze tới cột NGÀY, chỉ lịch thời gian cuộn ngang -->
        <div class="sticky left-0 z-20 w-[420px] flex-shrink-0 border-r border-slate-200 bg-white shadow-[2px_0_5px_rgba(0,0,0,0.04)]">
          <div class="sticky top-0 z-30 flex h-[88px] items-center border-b border-slate-200 bg-white px-4 pb-2 text-xs font-semibold uppercase text-slate-700">
            <span class="flex-1">Công việc / Phase</span>
            <span class="w-28">Thời gian</span>
            <span class="w-12 text-right">Ngày</span>
          </div>
          <div
            v-for="row in rows"
            :key="row.kind + row.id"
            class="flex h-11 cursor-pointer items-center px-4 text-sm hover:bg-slate-50"
            :class="row.kind === 'phase' ? 'bg-slate-50/60 font-semibold text-slate-800' : 'text-slate-600'"
            @click="row.kind === 'phase' ? selectPhase(row.phase!) : selectTask(row.task!)"
          >
            <span class="flex flex-1 items-center gap-2 truncate">
              <span v-if="row.kind === 'phase'" class="h-2 w-2 flex-shrink-0 rounded-full" :style="{ background: PHASE_COLOR }"></span>
              <span class="truncate" :class="row.kind === 'task' ? 'pl-3' : ''">{{ row.label }}</span>
            </span>
            <span class="w-28 text-xs text-slate-500">{{ fmtRange(row.span) }}</span>
            <span class="w-12 text-right text-xs text-slate-500">{{ spanDays(row.span) }}</span>
          </div>
        </div>

        <!-- Lưới thời gian -->
        <div class="relative" :style="{ width: gridWidth + 'px' }">
          <!-- Header tuần + ngày (freeze khi cuộn dọc) -->
          <div class="sticky top-0 z-10 bg-white">
            <div class="gantt-wh-row border-b border-slate-200">
              <div v-for="(w, i) in weeks" :key="i" class="gantt-wh-cell" :style="{ width: w.span * DAY_W + 'px' }">
                <div class="border-b border-slate-100 py-1 text-xs font-medium text-slate-700">{{ w.label }}</div>
              </div>
            </div>
            <div class="gantt-dh-row">
              <div
                v-for="(d, i) in range.days"
                :key="i"
                class="flex-shrink-0 border-r border-slate-100 py-1 text-center text-[11px]"
                :class="isWeekend(d) ? 'bg-amber-50' : ''"
                :style="{ width: DAY_W + 'px' }"
              >
                <div :class="isWeekend(d) ? 'text-amber-600' : 'text-slate-600'">{{ d.getDate() }}</div>
                <div class="text-slate-600">{{ d.toLocaleDateString('en', { weekday: 'short' }) }}</div>
              </div>
            </div>
          </div>

          <!-- Hàng bar -->
          <div
            v-for="row in rows"
            :key="row.kind + row.id"
            class="relative h-11 border-b border-slate-50"
          >
            <!-- nền cuối tuần / hôm nay -->
            <span
              v-for="(d, i) in range.days"
              :key="i"
              class="absolute top-0 h-full"
              :class="[isWeekend(d) ? 'bg-amber-50' : '', isToday(d) ? 'border-l-2 border-brand' : '']"
              :style="{ left: i * DAY_W + 'px', width: DAY_W + 'px' }"
            ></span>
            <div
              class="absolute top-1/2 flex h-6 -translate-y-1/2 items-center overflow-hidden rounded-md px-2 text-xs font-medium text-white shadow-sm"
              :style="barStyle(row.span, row.color)"
            >
              <span class="truncate">{{ row.label }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Chú thích -->
    <div class="flex flex-wrap items-center gap-4 text-xs text-slate-500">
      <span v-for="l in LEGEND" :key="l.label" class="flex items-center gap-1.5">
        <span class="h-3 w-3 rounded-sm" :style="{ background: l.color }"></span>{{ l.label }}
      </span>
      <span class="flex items-center gap-1.5"><span class="h-3 w-0.5 bg-brand"></span>Hôm nay</span>
      <span class="flex items-center gap-1.5"><span class="h-3 w-3 rounded-sm bg-amber-100"></span>Cuối tuần</span>
    </div>
    <!-- chú thích trạng thái dạng chữ (đồng bộ nhãn enum) -->
    <p class="text-[11px] text-slate-400">{{ Object.values(TASK_STATUS_LABELS).join(' · ') }}</p>
  </div>
</template>
