<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import * as XLSX from 'xlsx';
import { usersApi, workApi } from '@/api/endpoints';
import type {
  AdminUser,
  AiAssignment,
  TaskCategory,
  TaskOverviewReport,
  WorkProject,
  WorkTask,
} from '@/api/types';
import SideDrawer from '@/components/common/SideDrawer.vue';
import TaskDetailDrawer from '@/components/work/TaskDetailDrawer.vue';
import { usePolicy } from '@/composables/usePolicy';
import { formatDateTime } from '@/utils/format';
import {
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_OPTIONS,
  TASK_STATUS_LABELS,
  TASK_STATUS_OPTIONS,
  taskPriorityClass,
  taskStatusClass,
} from '@/utils/work-labels';
import { confirmDelete, confirmSubmit, toastError, toastSuccess } from '@/utils/swal';

const router = useRouter();
const { ensureLoaded, taskVisual, badgeStyle, taskProgress } = usePolicy();
const rows = ref<WorkTask[]>([]);
const allRows = ref<WorkTask[]>([]); // toàn bộ theo filter (kanban / categories / export)
const total = ref(0);
const message = ref<string | null>(null);
const loading = ref(false);

const projects = ref<WorkProject[]>([]);
const categories = ref<TaskCategory[]>([]);
const users = ref<AdminUser[]>([]);

type ViewMode = 'table' | 'kanban' | 'categories';
const viewMode = ref<ViewMode>('table');

// Map việc đã giao cho AI theo taskId (cột "AI nhận việc").
const aiByTask = ref<Map<number, AiAssignment>>(new Map());
const loadAiAssignments = async (): Promise<void> => {
  try {
    const list = await workApi.aiAssignments();
    aiByTask.value = new Map(list.map((a) => [a.taskId, a]));
  } catch {
    /* ignore */
  }
};

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** Định dạng DDD DD/MMM YY, vd "T4 17/Jun 26". */
const fmtAiDate = (iso: string): string => {
  const d = new Date(iso);
  return `${WEEKDAYS[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
};

const filters = reactive({
  q: '',
  status: '',
  priority: '',
  projectId: '',
  taskCategoryId: '',
  assignedToUserId: '',
  fromDate: '',
  toDate: '',
  page: 1,
  pageSize: 10,
  sort: 'id',
  order: 'DESC' as 'ASC' | 'DESC',
});

/** Tham số filter dùng chung cho list/loadAll/overview/export. */
const filterParams = (): Record<string, string | number | undefined> => ({
  q: filters.q || undefined,
  status: filters.status || undefined,
  priority: filters.priority || undefined,
  projectId: filters.projectId || undefined,
  taskCategoryId: filters.taskCategoryId || undefined,
  assignedToUserId: filters.assignedToUserId || undefined,
  fromDate: filters.fromDate || undefined,
  toDate: filters.toDate || undefined,
});

const totalPages = (): number => Math.max(1, Math.ceil(total.value / filters.pageSize));

const load = async (): Promise<void> => {
  loading.value = true;
  try {
    const result = await workApi.tasks({
      ...filterParams(),
      page: filters.page,
      pageSize: filters.pageSize,
      sort: filters.sort,
      order: filters.order,
    });
    rows.value = result.rows;
    total.value = result.total;
  } catch {
    message.value = 'Không tải được danh sách công việc.';
  } finally {
    loading.value = false;
  }
};

/** Tải toàn bộ công việc theo filter (cho kanban / categories / export). */
const loadAll = async (): Promise<WorkTask[]> => {
  const result = await workApi.tasks({ ...filterParams(), page: 1, pageSize: 1000, sort: 'id', order: 'DESC' });
  allRows.value = result.rows;
  return result.rows;
};

const refreshView = async (): Promise<void> => {
  await load();
  if (viewMode.value !== 'table') await loadAll();
};

const applyFilters = (): void => {
  filters.page = 1;
  void refreshView();
};

watch(viewMode, (m) => {
  if (m !== 'table' && allRows.value.length === 0) void loadAll();
});

const toggleSort = (column: string): void => {
  if (filters.sort === column) {
    filters.order = filters.order === 'ASC' ? 'DESC' : 'ASC';
  } else {
    filters.sort = column;
    filters.order = 'ASC';
  }
  void load();
};

const changePage = (delta: number): void => {
  const next = filters.page + delta;
  if (next < 1 || next > totalPages()) return;
  filters.page = next;
  void load();
};

const openCreate = (): void => {
  void router.push({ name: 'work-task-create' });
};
const openEdit = (id: number): void => {
  void router.push({ name: 'work-task-edit', params: { id } });
};

const remove = async (task: WorkTask): Promise<void> => {
  const ok = await confirmDelete(`Xóa công việc "${task.title}"?`);
  if (!ok) return;
  try {
    await workApi.removeTask(task.id);
    toastSuccess('Đã xóa công việc.');
    await refreshView();
  } catch {
    toastError('Xóa công việc thất bại.');
  }
};

// --- Kanban: nhóm theo trạng thái ---
const kanbanColumns = computed(() =>
  TASK_STATUS_OPTIONS.map((opt) => ({
    value: opt.value,
    label: opt.label,
    tasks: allRows.value.filter((t) => t.status === opt.value),
  })),
);

// --- Categories: nhóm theo danh mục công việc (collapse) ---
const collapsedCats = reactive<Record<string, boolean>>({});
const toggleCat = (key: string): void => {
  collapsedCats[key] = !collapsedCats[key];
};
const categoryGroups = computed(() => {
  const map = new Map<string, { key: string; title: string; tasks: WorkTask[] }>();
  for (const t of allRows.value) {
    const key = t.taskCategoryId ? String(t.taskCategoryId) : 'none';
    const title = t.category?.title ?? 'Chưa phân loại';
    if (!map.has(key)) map.set(key, { key, title, tasks: [] });
    map.get(key)!.tasks.push(t);
  }
  return Array.from(map.values()).sort((a, b) => a.title.localeCompare(b.title));
});

// --- Drag & drop: đổi trạng thái (kanban) / đổi danh mục (categories) ---
const draggedTaskId = ref<number | null>(null);
const dragOverKey = ref<string | null>(null);
const onDragStart = (id: number): void => {
  draggedTaskId.value = id;
};
const findTask = (id: number): WorkTask | undefined => allRows.value.find((t) => t.id === id);

const moveStatus = async (newStatus: WorkTask['status']): Promise<void> => {
  const id = draggedTaskId.value;
  draggedTaskId.value = null;
  dragOverKey.value = null;
  if (id === null) return;
  const t = findTask(id);
  if (!t || t.status === newStatus) return;
  const ok = await confirmSubmit({
    title: 'Bạn có chắc muốn thay đổi trạng thái công việc?',
    text: `${t.title}: ${TASK_STATUS_LABELS[t.status]} → ${TASK_STATUS_LABELS[newStatus]}`,
  });
  if (!ok) return;
  try {
    await workApi.updateTask(id, { status: newStatus });
    toastSuccess('Đã cập nhật trạng thái công việc.');
    await Promise.all([loadAll(), load()]);
  } catch {
    toastError('Cập nhật trạng thái thất bại.');
  }
};

const moveCategory = async (catKey: string, catTitle: string): Promise<void> => {
  const id = draggedTaskId.value;
  draggedTaskId.value = null;
  dragOverKey.value = null;
  if (id === null) return;
  const t = findTask(id);
  const targetId = catKey === 'none' ? null : Number(catKey);
  if (!t || (t.taskCategoryId ?? null) === targetId) return;
  if (targetId === null) {
    toastError('Không thể chuyển về "Chưa phân loại".');
    return;
  }
  const ok = await confirmSubmit({
    title: 'Bạn có chắc muốn chuyển đổi danh mục công việc?',
    text: `${t.title}: ${t.category?.title ?? 'Chưa phân loại'} → ${catTitle}`,
  });
  if (!ok) return;
  try {
    await workApi.updateTask(id, { taskCategoryId: targetId });
    toastSuccess('Đã chuyển danh mục công việc.');
    await Promise.all([loadAll(), load()]);
  } catch {
    toastError('Chuyển danh mục thất bại.');
  }
};

// --- Drawer chi tiết ---
const detailOpen = ref(false);
const detailTaskId = ref<number | null>(null);
const openDetail = (id: number): void => {
  detailTaskId.value = id;
  detailOpen.value = true;
};

// --- Báo cáo tổng quan (drawer) ---
const reportOpen = ref(false);
const report = ref<TaskOverviewReport | null>(null);
const openReport = async (): Promise<void> => {
  report.value = null;
  reportOpen.value = true;
  report.value = await workApi.taskOverview(filterParams());
};

// --- Xuất XLS (2 sheet) theo filter ---
const exporting = ref(false);
const aiStatusText = (t: WorkTask): string => {
  const a = aiByTask.value.get(t.id);
  if (!a) return '';
  return a.status === 'in_progress' ? 'Đang thực hiện' : 'Chưa bắt đầu';
};
const exportXls = async (): Promise<void> => {
  exporting.value = true;
  try {
    const [tasks, overview] = await Promise.all([loadAll(), workApi.taskOverview(filterParams())]);

    // Sheet 1: Báo cáo tổng quan
    const s1: (string | number)[][] = [
      ['BÁO CÁO TỔNG QUAN CÔNG VIỆC'],
      ['Khoảng thời gian', `${filters.fromDate || '—'}  →  ${filters.toDate || '—'}`],
      ['Xuất lúc', new Date().toLocaleString('vi-VN')],
      [],
      ['Tổng công việc', overview.total],
      ['Hoàn thành', overview.completed],
      ['Quá hạn', overview.overdue],
      ['Tỷ lệ hoàn thành (%)', overview.completionRate],
      [],
      ['Phân bố theo trạng thái', ''],
      ...Object.entries(overview.byStatus).map(
        ([k, v]) => [TASK_STATUS_LABELS[k as keyof typeof TASK_STATUS_LABELS] ?? k, v] as [string, number],
      ),
      [],
      ['Phân bố theo ưu tiên', ''],
      ...Object.entries(overview.byPriority).map(
        ([k, v]) => [TASK_PRIORITY_LABELS[k as keyof typeof TASK_PRIORITY_LABELS] ?? k, v] as [string, number],
      ),
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(s1);
    ws1['!cols'] = [{ wch: 26 }, { wch: 26 }];

    // Sheet 2: Chi tiết danh sách công việc
    const header = [
      'ID', 'Tên công việc', 'Dự án', 'Danh mục', 'Phụ trách', 'Ưu tiên',
      'Trạng thái', 'Tiến độ (%)', 'Giờ ước tính', 'Bắt đầu', 'Hạn',
      'AI nhận việc', 'Trạng thái AI',
    ];
    const detail = tasks.map((t) => [
      t.id,
      t.title,
      t.project?.title ?? '',
      t.category?.title ?? '',
      t.assignedTo?.fullName ?? '',
      TASK_PRIORITY_LABELS[t.priority],
      TASK_STATUS_LABELS[t.status],
      taskProgress(t),
      t.estimatedHours ?? '',
      t.startDate ? t.startDate.slice(0, 10) : '',
      t.dueDate ? t.dueDate.slice(0, 10) : '',
      aiByTask.value.get(t.id) ? fmtAiDate(aiByTask.value.get(t.id)!.createdAt) : '',
      aiStatusText(t),
    ]);
    const ws2 = XLSX.utils.aoa_to_sheet([header, ...detail]);
    ws2['!cols'] = [
      { wch: 6 }, { wch: 36 }, { wch: 24 }, { wch: 18 }, { wch: 18 }, { wch: 12 },
      { wch: 14 }, { wch: 11 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 16 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, 'Báo cáo tổng quan');
    XLSX.utils.book_append_sheet(wb, ws2, 'Chi tiết danh sách công việc');
    XLSX.writeFile(wb, `bao-cao-cong-viec-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toastSuccess('Đã xuất file Excel.');
  } catch {
    toastError('Xuất Excel thất bại.');
  } finally {
    exporting.value = false;
  }
};

onMounted(async () => {
  void ensureLoaded();
  void loadAiAssignments();
  try {
    projects.value = (await workApi.projects({ pageSize: 100 })).rows;
  } catch {
    /* ignore */
  }
  try {
    categories.value = await workApi.taskCategories();
  } catch {
    /* ignore */
  }
  try {
    users.value = await usersApi.list();
  } catch {
    /* ignore */
  }
  await load();
});
</script>

<template>
  <div class="p-6">
    <header class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Công việc</h1>
        <p class="text-sm text-slate-500">Quản lý công việc: phụ trách, ưu tiên, tiến độ.</p>
      </div>
      <div class="flex gap-2">
        <button class="btn-ghost" :disabled="exporting" @click="exportXls">
          <span class="material-symbols-rounded mr-1 text-[18px]">download</span>{{ exporting ? 'Đang xuất…' : 'Xuất Excel' }}
        </button>
        <button class="btn-ghost" @click="openReport">
          <span class="material-symbols-rounded mr-1 text-[18px]">summarize</span>Báo cáo tổng quan
        </button>
        <button class="btn-primary" @click="openCreate">
          <span class="material-symbols-rounded mr-1 text-[18px]">add</span>Thêm công việc
        </button>
      </div>
    </header>
    <p v-if="message" class="mt-3 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-700">{{ message }}</p>

    <!-- Bộ lọc -->
    <section class="card mt-4">
      <div class="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <input v-model="filters.q" class="input" placeholder="Tìm theo tên công việc" @keyup.enter="applyFilters" />
        <select v-model="filters.status" class="input" @change="applyFilters">
          <option value="">— Tất cả trạng thái —</option>
          <option v-for="opt in TASK_STATUS_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <select v-model="filters.priority" class="input" @change="applyFilters">
          <option value="">— Tất cả ưu tiên —</option>
          <option v-for="opt in TASK_PRIORITY_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <select v-model="filters.taskCategoryId" class="input" @change="applyFilters">
          <option value="">— Tất cả danh mục —</option>
          <option v-for="c in categories" :key="c.id" :value="String(c.id)">{{ c.title }}</option>
        </select>
        <select v-model="filters.projectId" class="input" @change="applyFilters">
          <option value="">— Tất cả dự án —</option>
          <option v-for="p in projects" :key="p.id" :value="String(p.id)">{{ p.title ?? p.name }}</option>
        </select>
        <select v-model="filters.assignedToUserId" class="input" @change="applyFilters">
          <option value="">— Tất cả người phụ trách —</option>
          <option v-for="u in users" :key="u.id" :value="u.id">{{ u.fullName }}</option>
        </select>
        <div>
          <label class="label">Từ ngày</label>
          <input v-model="filters.fromDate" type="date" class="input" @change="applyFilters" />
        </div>
        <div>
          <label class="label">Đến ngày</label>
          <input v-model="filters.toDate" type="date" class="input" @change="applyFilters" />
        </div>
      </div>
    </section>

    <!-- Chuyển chế độ xem -->
    <div class="mt-4 flex items-center gap-2">
      <div class="inline-flex overflow-hidden rounded-lg border border-slate-300 text-sm">
        <button
          v-for="m in [
            { key: 'table', label: 'Bảng', icon: 'table_rows' },
            { key: 'kanban', label: 'Kanban', icon: 'view_kanban' },
            { key: 'categories', label: 'Theo danh mục', icon: 'category' },
          ]"
          :key="m.key"
          class="flex items-center gap-1 px-3 py-1.5 font-medium"
          :class="viewMode === m.key ? 'bg-brand text-white' : 'bg-white text-slate-600 hover:bg-slate-50'"
          @click="viewMode = m.key as ViewMode"
        >
          <span class="material-symbols-rounded text-[16px]">{{ m.icon }}</span>{{ m.label }}
        </button>
      </div>
    </div>

    <!-- ===== Bảng ===== -->
    <section v-if="viewMode === 'table'" class="card mt-4">
      <div class="table-scroll">
        <table class="data-table min-w-[1100px]">
          <thead>
            <tr class="border-b text-left text-slate-500">
              <th class="cursor-pointer py-2" @click="toggleSort('title')">Tên công việc</th>
              <th>Dự án</th>
              <th>Danh mục</th>
              <th>Phụ trách</th>
              <th class="cursor-pointer" @click="toggleSort('priority')">Ưu tiên</th>
              <th class="cursor-pointer" @click="toggleSort('status')">Trạng thái</th>
              <th>Tiến độ</th>
              <th class="cursor-pointer" @click="toggleSort('dueDate')">Hạn</th>
              <th>AI nhận việc</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.id" class="border-b last:border-0 hover:bg-slate-50">
              <td class="cursor-pointer py-2 font-medium text-slate-800" @click="openDetail(row.id)">{{ row.title }}</td>
              <td>{{ row.project?.title ?? '—' }}</td>
              <td>{{ row.category?.title ?? '—' }}</td>
              <td>{{ row.assignedTo?.fullName ?? '—' }}</td>
              <td><span class="rounded px-2 py-0.5 text-xs" :class="taskPriorityClass(row.priority)">{{ TASK_PRIORITY_LABELS[row.priority] }}</span></td>
              <td>
                <span v-if="taskVisual(row.status)" class="rounded px-2 py-0.5 text-xs font-medium" :style="badgeStyle(taskVisual(row.status))">{{ taskVisual(row.status)?.icon }} {{ taskVisual(row.status)?.label }}</span>
                <span v-else class="rounded px-2 py-0.5 text-xs" :class="taskStatusClass(row.status)">{{ TASK_STATUS_LABELS[row.status] }}</span>
              </td>
              <td>
                <div class="flex items-center gap-2">
                  <div class="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                    <div class="h-full rounded-full bg-brand" :style="{ width: taskProgress(row) + '%' }"></div>
                  </div>
                  <span class="text-xs text-slate-500">{{ taskProgress(row) }}%</span>
                </div>
              </td>
              <td class="text-slate-500">{{ formatDateTime(row.dueDate) }}</td>
              <td>
                <button v-if="aiByTask.get(row.id)" class="flex flex-col items-start rounded px-1 text-left hover:bg-slate-100" @click="openDetail(row.id)">
                  <span class="flex items-center gap-1 text-xs font-medium text-brand">
                    <span class="material-symbols-rounded text-[14px]">smart_toy</span>{{ fmtAiDate(aiByTask.get(row.id)!.createdAt) }}
                  </span>
                  <span class="text-[11px]" :class="aiByTask.get(row.id)!.status === 'in_progress' ? 'text-blue-600' : 'text-slate-400'">{{ aiByTask.get(row.id)!.status === 'in_progress' ? '⏳ Đang thực hiện' : '🕒 Chưa bắt đầu' }}</span>
                </button>
                <span v-else class="text-xs text-slate-300">—</span>
              </td>
              <td class="whitespace-nowrap text-right">
                <button class="text-brand hover:underline" @click="openEdit(row.id)">Sửa</button>
                <button class="ml-3 text-rose-600 hover:underline" @click="remove(row)">Xóa</button>
              </td>
            </tr>
            <tr v-if="rows.length === 0 && !loading">
              <td colspan="10" class="py-6 text-center text-slate-400">Chưa có công việc.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="mt-4 flex items-center justify-between text-sm text-slate-500">
        <span>Tổng {{ total }} công việc</span>
        <div class="flex items-center gap-2">
          <button class="btn-ghost px-2 py-1" :disabled="filters.page <= 1" @click="changePage(-1)">
            <span class="material-symbols-rounded text-[18px]">chevron_left</span>
          </button>
          <span>Trang {{ filters.page }} / {{ totalPages() }}</span>
          <button class="btn-ghost px-2 py-1" :disabled="filters.page >= totalPages()" @click="changePage(1)">
            <span class="material-symbols-rounded text-[18px]">chevron_right</span>
          </button>
        </div>
      </div>
    </section>

    <!-- ===== Kanban (theo trạng thái) ===== -->
    <section v-else-if="viewMode === 'kanban'" class="mt-4 flex gap-4 overflow-x-auto pb-2">
      <div
        v-for="col in kanbanColumns"
        :key="col.value"
        class="w-72 flex-shrink-0 rounded-xl bg-slate-50 p-3 transition"
        :class="dragOverKey === 'st:' + col.value ? 'ring-2 ring-brand ring-inset bg-brand-light/40' : ''"
        @dragover.prevent="dragOverKey = 'st:' + col.value"
        @dragleave="dragOverKey = null"
        @drop="moveStatus(col.value)"
      >
        <div class="mb-2 flex items-center justify-between">
          <span class="font-semibold text-slate-700">{{ col.label }}</span>
          <span class="rounded-full bg-white px-2 text-xs text-slate-500">{{ col.tasks.length }}</span>
        </div>
        <div class="space-y-2">
          <div
            v-for="task in col.tasks"
            :key="task.id"
            draggable="true"
            class="cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm hover:border-brand active:cursor-grabbing"
            :class="draggedTaskId === task.id ? 'opacity-50' : ''"
            @dragstart="onDragStart(task.id)"
            @click="openDetail(task.id)"
          >
            <p class="text-sm font-medium text-slate-800">{{ task.title }}</p>
            <p class="mt-0.5 text-[11px] text-slate-400">{{ task.category?.title ?? 'Chưa phân loại' }} · {{ task.project?.title ?? '—' }}</p>
            <div class="mt-2 flex flex-wrap items-center gap-1.5">
              <span class="rounded px-1.5 py-0.5 text-[11px]" :class="taskPriorityClass(task.priority)">{{ TASK_PRIORITY_LABELS[task.priority] }}</span>
              <span class="text-[11px] text-slate-400">{{ task.assignedTo?.fullName ?? '—' }}</span>
              <span class="ml-auto text-[11px] text-slate-400">{{ taskProgress(task) }}%</span>
            </div>
          </div>
          <p v-if="col.tasks.length === 0" class="py-2 text-center text-xs text-slate-300">Trống</p>
        </div>
      </div>
    </section>

    <!-- ===== Theo danh mục (collapse) ===== -->
    <section v-else class="mt-4 space-y-3">
      <div
        v-for="g in categoryGroups"
        :key="g.key"
        class="card transition"
        :class="dragOverKey === 'cat:' + g.key ? 'ring-2 ring-brand' : ''"
        @dragover.prevent="dragOverKey = 'cat:' + g.key"
        @dragleave="dragOverKey = null"
        @drop="moveCategory(g.key, g.title)"
      >
        <button class="flex w-full items-center gap-2 text-left" @click="toggleCat(g.key)">
          <span class="material-symbols-rounded text-[20px] text-slate-400">{{ collapsedCats[g.key] ? 'chevron_right' : 'expand_more' }}</span>
          <span class="font-semibold text-slate-800">{{ g.title }}</span>
          <span class="rounded-full bg-slate-100 px-2 text-xs text-slate-500">{{ g.tasks.length }}</span>
        </button>
        <div v-if="!collapsedCats[g.key]" class="mt-3 table-scroll">
          <table class="data-table min-w-[860px]">
            <thead>
              <tr class="border-b text-left text-slate-500">
                <th class="py-2">Tên công việc</th><th>Dự án</th><th>Phụ trách</th><th>Ưu tiên</th><th>Trạng thái</th><th>Tiến độ</th><th>Hạn</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="task in g.tasks"
                :key="task.id"
                draggable="true"
                class="cursor-grab border-b last:border-0 hover:bg-slate-50 active:cursor-grabbing"
                :class="draggedTaskId === task.id ? 'opacity-50' : ''"
                @dragstart="onDragStart(task.id)"
              >
                <td class="cursor-pointer py-2 font-medium text-slate-800 hover:text-brand" @click="openDetail(task.id)">{{ task.title }}</td>
                <td>{{ task.project?.title ?? '—' }}</td>
                <td>{{ task.assignedTo?.fullName ?? '—' }}</td>
                <td><span class="rounded px-2 py-0.5 text-xs" :class="taskPriorityClass(task.priority)">{{ TASK_PRIORITY_LABELS[task.priority] }}</span></td>
                <td>
                  <span v-if="taskVisual(task.status)" class="rounded px-2 py-0.5 text-xs font-medium" :style="badgeStyle(taskVisual(task.status))">{{ taskVisual(task.status)?.icon }} {{ taskVisual(task.status)?.label }}</span>
                  <span v-else class="rounded px-2 py-0.5 text-xs" :class="taskStatusClass(task.status)">{{ TASK_STATUS_LABELS[task.status] }}</span>
                </td>
                <td class="text-xs text-slate-600">{{ taskProgress(task) }}%</td>
                <td class="text-slate-500">{{ formatDateTime(task.dueDate) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <p v-if="categoryGroups.length === 0" class="card py-6 text-center text-sm text-slate-400">Chưa có công việc.</p>
    </section>

    <!-- Drawer chi tiết công việc -->
    <TaskDetailDrawer
      :open="detailOpen"
      :task-id="detailTaskId"
      @close="detailOpen = false; loadAiAssignments()"
      @edit="openEdit"
    />

    <!-- Drawer báo cáo tổng quan -->
    <SideDrawer :open="reportOpen" title="Báo cáo tổng quan công việc" subtitle="Theo bộ lọc hiện tại" @close="reportOpen = false">
      <div v-if="report" class="space-y-5 text-sm">
        <div class="grid grid-cols-2 gap-3">
          <div class="card"><p class="text-slate-500">Tổng công việc</p><p class="text-2xl font-bold text-slate-900">{{ report.total }}</p></div>
          <div class="card"><p class="text-slate-500">Hoàn thành</p><p class="text-2xl font-bold text-emerald-600">{{ report.completed }}</p></div>
          <div class="card"><p class="text-slate-500">Quá hạn</p><p class="text-2xl font-bold text-rose-600">{{ report.overdue }}</p></div>
          <div class="card"><p class="text-slate-500">Tỷ lệ hoàn thành</p><p class="text-2xl font-bold text-brand">{{ report.completionRate }}%</p></div>
        </div>
        <div>
          <p class="mb-2 font-semibold text-slate-700">Theo trạng thái</p>
          <ul class="space-y-1">
            <li v-for="(count, key) in report.byStatus" :key="key" class="flex justify-between border-b border-slate-100 py-1">
              <span>{{ TASK_STATUS_LABELS[key as keyof typeof TASK_STATUS_LABELS] ?? key }}</span><span class="font-medium">{{ count }}</span>
            </li>
          </ul>
        </div>
        <div>
          <p class="mb-2 font-semibold text-slate-700">Theo ưu tiên</p>
          <ul class="space-y-1">
            <li v-for="(count, key) in report.byPriority" :key="key" class="flex justify-between border-b border-slate-100 py-1">
              <span>{{ TASK_PRIORITY_LABELS[key as keyof typeof TASK_PRIORITY_LABELS] ?? key }}</span><span class="font-medium">{{ count }}</span>
            </li>
          </ul>
        </div>
      </div>
      <p v-else class="text-sm text-slate-400">Đang tải…</p>
    </SideDrawer>
  </div>
</template>
