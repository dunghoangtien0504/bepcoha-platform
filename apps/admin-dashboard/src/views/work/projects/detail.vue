<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { usersApi, workApi } from '@/api/endpoints';
import type {
  AdminUser,
  AiAssignment,
  PhaseInput,
  ProjectPhase,
  TaskCategory,
  WorkProject,
  WorkTask,
  WorkTaskPayload,
} from '@/api/types';
import SideDrawer from '@/components/common/SideDrawer.vue';
import TaskDetailDrawer from '@/components/work/TaskDetailDrawer.vue';
import AttachmentManager from '@/components/work/AttachmentManager.vue';
import ProjectGantt from '@/components/work/ProjectGantt.vue';
import ProjectFiles from '@/components/work/ProjectFiles.vue';
import { formatDateTime } from '@/utils/format';
import { usePolicy } from '@/composables/usePolicy';
import { useValidationForm } from '@/composables/useValidationForm';
import { confirmDelete, confirmSubmit, toastError, toastSuccess } from '@/utils/swal';
import {
  MEMBER_ROLE_LABELS,
  PHASE_STATUS_LABELS,
  PHASE_STATUS_OPTIONS,
  PROJECT_STATUS_LABELS,
  projectStatusClass,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_OPTIONS,
  TASK_STATUS_LABELS,
  TASK_STATUS_OPTIONS,
  taskPriorityClass,
  taskStatusClass,
} from '@/utils/work-labels';

const {
  policy,
  ensureLoaded,
  taskVisual,
  phaseVisual,
  projectVisual,
  badgeStyle,
  taskProgress,
  phaseProgress,
  projectProgress,
  projectThreshold,
} = usePolicy();

const route = useRoute();
const router = useRouter();

const projectId = computed<number>(() => Number(route.params.id));

const project = ref<WorkProject | null>(null);
const tasks = ref<WorkTask[]>([]);
const taskCategories = ref<TaskCategory[]>([]);
const users = ref<AdminUser[]>([]);
const loading = ref(false);
const recalcing = ref(false);
const message = ref<string | null>(null);

type TabKey = 'overview' | 'phases' | 'members' | 'tasks' | 'gantt' | 'files';
const activeTab = ref<TabKey>('overview');
const tabs: { key: TabKey; label: string; icon: string }[] = [
  { key: 'overview', label: 'Tổng quan', icon: 'dashboard' },
  { key: 'phases', label: 'Giai đoạn', icon: 'timeline' },
  { key: 'members', label: 'Thành viên', icon: 'group' },
  { key: 'tasks', label: 'Công việc', icon: 'task_alt' },
  { key: 'gantt', label: 'Gantt Chart', icon: 'view_timeline' },
  { key: 'files', label: 'Files', icon: 'folder' },
];

const userName = (id: string | null): string => {
  if (!id) return '—';
  const u = users.value.find((x) => x.id === id);
  return u ? u.fullName : '—';
};

/** Định dạng ngày ngắn dd/m/yyyy (vi-VN) cho header. */
const fmtDate = (iso: string | null | undefined): string =>
  iso ? new Date(iso).toLocaleDateString('vi-VN') : '—';

const loadProject = async (): Promise<void> => {
  loading.value = true;
  try {
    project.value = await workApi.project(projectId.value);
  } catch {
    message.value = 'Không tải được dự án.';
  } finally {
    loading.value = false;
  }
};

const loadTasks = async (): Promise<void> => {
  try {
    const result = await workApi.tasks({ projectId: projectId.value, pageSize: 100, sort: 'id', order: 'DESC' });
    tasks.value = result.rows;
  } catch {
    /* ignore */
  }
};

// Map việc đã giao cho AI theo taskId (cột "AI nhận việc" ở tab Công việc).
const aiByTask = ref<Map<number, AiAssignment>>(new Map());
const loadAiAssignments = async (): Promise<void> => {
  try {
    const list = await workApi.aiAssignments();
    aiByTask.value = new Map(list.map((a) => [a.taskId, a]));
  } catch {
    /* ignore */
  }
};

const AI_WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const AI_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** Định dạng DDD DD/MMM YY, vd "T4 17/Jun 26". */
const fmtAiDate = (iso: string): string => {
  const d = new Date(iso);
  return `${AI_WEEKDAYS[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${AI_MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
};

const loadRefs = async (): Promise<void> => {
  try {
    taskCategories.value = await workApi.taskCategories();
  } catch {
    /* ignore */
  }
  try {
    users.value = await usersApi.list();
  } catch {
    /* ignore */
  }
};

/** Tính lại tiến độ: backend tính KPI khi đọc nên chỉ cần tải lại dự án + công việc. */
const recalcProgress = async (): Promise<void> => {
  recalcing.value = true;
  try {
    await Promise.all([loadProject(), loadTasks()]);
    toastSuccess('Đã tính lại tiến độ từ công việc.');
  } finally {
    recalcing.value = false;
  }
};

// --- Header (vòng tiến độ + màu theo trạng thái) ---
const RING_C = 2 * Math.PI * 34; // chu vi vòng tròn r=34
const progressPct = computed<number>(() => Math.round(Number(project.value?.progress ?? 0)));
const ringOffset = computed<number>(() => RING_C * (1 - progressPct.value / 100));
const accentColor = computed<string>(
  () => (project.value ? projectVisual(project.value.status)?.color : null) ?? '#6366f1',
);

// --- Tổng quan: chỉ số + phân bố trạng thái ---
const now = Date.now();
const memberCount = computed<number>(() => project.value?.members?.length ?? 0);
const completedCount = computed<number>(() => tasks.value.filter((t) => t.status === 'completed').length);
const overdueCount = computed<number>(
  () =>
    tasks.value.filter(
      (t) =>
        t.dueDate &&
        new Date(t.dueDate).getTime() < now &&
        t.status !== 'completed' &&
        t.status !== 'cancelled',
    ).length,
);

/** Một số task.status khác vocabulary policy (completed ⇄ done). */
const aliasStatus = (s: string): string => (s === 'completed' ? 'done' : s);

interface StatusBar {
  key: string;
  label: string;
  color: string;
  count: number;
}
const statusDistribution = computed<StatusBar[]>(() => {
  const map = policy.value?.task.status_visual_map;
  if (!map) return [];
  return Object.entries(map).map(([key, v]) => ({
    key,
    label: v.label,
    color: v.color,
    count: tasks.value.filter((t) => aliasStatus(t.status) === key).length,
  }));
});

// --- Task drawer (thêm/sửa) ---
const drawerOpen = ref(false);
const drawerTaskId = ref<number | null>(null);
const savingTask = ref(false);
const taskError = ref<string | null>(null);
const taskAttachmentRef = ref<InstanceType<typeof AttachmentManager> | null>(null);

const taskForm = reactive<{
  taskCategoryId: number | '';
  title: string;
  description: string;
  projectPhaseId: number | '';
  priority: WorkTaskPayload['priority'];
  status: WorkTaskPayload['status'];
  assignedToUserId: string;
  startDate: string;
  dueDate: string;
}>({
  taskCategoryId: '',
  title: '',
  description: '',
  projectPhaseId: '',
  priority: 'medium',
  status: 'todo',
  assignedToUserId: '',
  startDate: '',
  dueDate: '',
});

const taskValidation = useValidationForm(taskForm, {
  title: { required: true, label: 'Tên công việc' },
  taskCategoryId: { required: true, label: 'Loại công việc' },
  startDate: { required: true, label: 'Ngày bắt đầu' },
  dueDate: { required: true, label: 'Hạn hoàn thành' },
});

const resetTaskForm = (phaseId: number | '' = ''): void => {
  taskForm.taskCategoryId = taskCategories.value[0]?.id ?? '';
  taskForm.title = '';
  taskForm.description = '';
  taskForm.projectPhaseId = phaseId;
  taskForm.priority = 'medium';
  taskForm.status = 'todo';
  taskForm.assignedToUserId = '';
  taskForm.startDate = '';
  taskForm.dueDate = '';
};

const openCreateTask = (phaseId: number | '' = ''): void => {
  drawerTaskId.value = null;
  taskError.value = null;
  taskValidation.clearErrors();
  resetTaskForm(phaseId);
  drawerOpen.value = true;
};

const openEditTask = async (task: WorkTask): Promise<void> => {
  drawerTaskId.value = task.id;
  taskError.value = null;
  taskValidation.clearErrors();
  const full = await workApi.task(task.id);
  taskForm.taskCategoryId = full.taskCategoryId;
  taskForm.title = full.title;
  taskForm.description = full.description ?? '';
  taskForm.projectPhaseId = full.projectPhaseId ?? '';
  taskForm.priority = full.priority;
  taskForm.status = full.status;
  taskForm.assignedToUserId = full.assignedToUserId ?? '';
  taskForm.startDate = full.startDate ? full.startDate.slice(0, 10) : '';
  taskForm.dueDate = full.dueDate ? full.dueDate.slice(0, 10) : '';
  drawerOpen.value = true;
};

const closeDrawer = (): void => {
  drawerOpen.value = false;
};

const submitTask = async (): Promise<void> => {
  taskError.value = null;
  if (!taskValidation.validate()) return;
  const ok = await confirmSubmit({
    title: drawerTaskId.value ? 'Cập nhật công việc?' : 'Tạo công việc mới?',
    text: 'Vui lòng kiểm tra lại thông tin trước khi lưu.',
  });
  if (!ok) return;
  const payload: WorkTaskPayload = {
    taskCategoryId: Number(taskForm.taskCategoryId),
    projectId: projectId.value,
    projectPhaseId: taskForm.projectPhaseId === '' ? undefined : Number(taskForm.projectPhaseId),
    priority: taskForm.priority,
    status: taskForm.status,
    assignedToUserId: taskForm.assignedToUserId || undefined,
    title: taskForm.title.trim(),
    description: taskForm.description.trim() || undefined,
    startDate: taskForm.startDate,
    dueDate: taskForm.dueDate,
  };
  savingTask.value = true;
  try {
    if (drawerTaskId.value !== null) {
      await workApi.updateTask(drawerTaskId.value, payload);
      toastSuccess('Đã cập nhật công việc.');
    } else {
      const created = await workApi.createTask(payload);
      if (taskAttachmentRef.value?.hasStaged) {
        await taskAttachmentRef.value.flush(created.id);
      }
      toastSuccess('Đã tạo công việc mới.');
    }
    drawerOpen.value = false;
    await Promise.all([loadTasks(), loadProject()]);
  } catch {
    taskError.value = 'Lưu công việc thất bại.';
    toastError('Lưu công việc thất bại.');
  } finally {
    savingTask.value = false;
  }
};

const removeTask = async (task: WorkTask): Promise<void> => {
  const ok = await confirmDelete(`Xóa công việc "${task.title}"?`);
  if (!ok) return;
  try {
    await workApi.removeTask(task.id);
    toastSuccess('Đã xóa công việc.');
    await Promise.all([loadTasks(), loadProject()]);
  } catch {
    toastError('Xóa công việc thất bại.');
  }
};

const goEdit = (): void => {
  void router.push({ name: 'work-project-edit', params: { id: projectId.value } });
};

// --- KPI tiến độ theo policy (Task → Phase → Project) ---
const tasksOfPhase = (phaseId: number): WorkTask[] =>
  tasks.value.filter((t) => t.projectPhaseId === phaseId);
const phaseProgressOf = (phaseId: number): number => phaseProgress(tasksOfPhase(phaseId));
const unphasedTasks = computed<WorkTask[]>(() =>
  tasks.value.filter((t) => !t.projectPhaseId),
);

// --- Kanban drag/drop: kéo task giữa các giai đoạn ---
const draggedTaskId = ref<number | null>(null);
const dragOverPhase = ref<number | 'none' | null>(null);
const onDragStart = (taskId: number): void => {
  draggedTaskId.value = taskId;
};
const onDropToPhase = async (phaseId: number | null): Promise<void> => {
  const id = draggedTaskId.value;
  draggedTaskId.value = null;
  dragOverPhase.value = null;
  if (id === null) return;
  const task = tasks.value.find((t) => t.id === id);
  if (!task || (task.projectPhaseId ?? null) === phaseId) return;
  const prev = task.projectPhaseId;
  task.projectPhaseId = phaseId; // cập nhật lạc quan
  try {
    await workApi.updateTask(id, { projectPhaseId: phaseId });
    toastSuccess('Đã chuyển công việc sang giai đoạn mới.');
    await loadProject();
  } catch {
    task.projectPhaseId = prev; // hoàn tác nếu lỗi
    toastError('Chuyển giai đoạn thất bại.');
  }
};

const projectComputedProgress = computed<number>(() => {
  const phases = project.value?.phases ?? [];
  if (phases.length > 0) return projectProgress(phases.map((p) => phaseProgressOf(p.id)));
  return phaseProgress(tasks.value);
});
const projectProgressBadge = computed(() => projectThreshold(projectComputedProgress.value));

// --- Giai đoạn: timeline accordion + kanban + CRUD ---
const phaseView = ref<'list' | 'kanban'>('list');
const expanded = reactive<Record<number, boolean>>({});
const togglePhase = (id: number): void => {
  expanded[id] = !expanded[id];
};

const phaseFormOpen = ref(false);
const phaseEditId = ref<number | null>(null);
const phaseSaving = ref(false);
const phaseForm = reactive<{ title: string; description: string; status: ProjectPhase['status'] }>({
  title: '',
  description: '',
  status: 'pending',
});
const phaseValidation = useValidationForm(phaseForm, {
  title: { required: true, label: 'Tên giai đoạn' },
});

const openCreatePhase = (): void => {
  phaseEditId.value = null;
  phaseValidation.clearErrors();
  phaseForm.title = '';
  phaseForm.description = '';
  phaseForm.status = 'pending';
  phaseFormOpen.value = true;
};

const openEditPhase = (phase: ProjectPhase): void => {
  phaseEditId.value = phase.id;
  phaseValidation.clearErrors();
  phaseForm.title = phase.title;
  phaseForm.description = phase.description ?? '';
  phaseForm.status = phase.status;
  phaseFormOpen.value = true;
};

const submitPhase = async (): Promise<void> => {
  if (!phaseValidation.validate()) return;
  const payload: PhaseInput = {
    title: phaseForm.title.trim(),
    description: phaseForm.description.trim() || undefined,
    status: phaseForm.status,
  };
  phaseSaving.value = true;
  try {
    if (phaseEditId.value !== null) {
      await workApi.updatePhase(projectId.value, phaseEditId.value, payload);
      toastSuccess('Đã cập nhật giai đoạn.');
    } else {
      await workApi.createPhase(projectId.value, payload);
      toastSuccess('Đã tạo giai đoạn mới.');
    }
    phaseFormOpen.value = false;
    await loadProject();
  } catch {
    toastError('Lưu giai đoạn thất bại.');
  } finally {
    phaseSaving.value = false;
  }
};

const removePhase = async (phase: ProjectPhase): Promise<void> => {
  const ok = await confirmDelete(`Xóa giai đoạn "${phase.title}"? Công việc sẽ được gỡ khỏi giai đoạn.`);
  if (!ok) return;
  try {
    await workApi.removePhase(projectId.value, phase.id);
    toastSuccess('Đã xóa giai đoạn.');
    await Promise.all([loadProject(), loadTasks()]);
  } catch {
    toastError('Xóa giai đoạn thất bại.');
  }
};

// --- Drawer chi tiết công việc (component dùng chung, gồm "Giao việc cho AI") ---
const taskDetailOpen = ref(false);
const taskDetailId = ref<number | null>(null);
const openTaskDetail = (id: number): void => {
  taskDetailId.value = id;
  taskDetailOpen.value = true;
};
const onTaskDetailEdit = (id: number): void => {
  taskDetailOpen.value = false;
  const task = tasks.value.find((t) => t.id === id);
  if (task) void openEditTask(task);
};

onMounted(async () => {
  await ensureLoaded();
  void loadAiAssignments();
  await loadRefs();
  await loadProject();
  await loadTasks();
  // Mở sẵn giai đoạn đầu tiên cho dễ nhìn.
  const first = project.value?.phases?.[0];
  if (first) expanded[first.id] = true;
});
</script>

<template>
  <div class="p-6">
    <button class="text-sm text-slate-500 hover:text-brand" @click="router.push({ name: 'work-projects' })">
      <span class="material-symbols-rounded mr-1 align-middle text-[16px]">arrow_back</span>Danh sách dự án
    </button>

    <!-- ===== Header dự án ===== -->
    <div
      v-if="project"
      class="project-header flex items-start justify-between gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      :style="{ borderLeft: `4px solid ${accentColor}` }"
    >
      <div class="min-w-0 flex-1">
        <div class="mb-2 flex flex-wrap items-center gap-2">
          <span
            v-if="projectVisual(project.status)"
            class="rounded-full px-2.5 py-0.5 text-xs font-semibold"
            :style="badgeStyle(projectVisual(project.status))"
          >{{ projectVisual(project.status)?.icon }} {{ projectVisual(project.status)?.label }}</span>
          <span v-else class="rounded-full px-2.5 py-0.5 text-xs font-semibold" :class="projectStatusClass(project.status)">
            {{ PROJECT_STATUS_LABELS[project.status] }}
          </span>
          <span v-if="project.category?.title" class="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
            {{ project.category.title }}
          </span>
        </div>
        <h1 class="truncate text-2xl font-bold text-slate-900">{{ project.title ?? project.name }}</h1>
        <div class="mt-2 flex flex-wrap gap-4 text-sm text-slate-500">
          <span>Bắt đầu: {{ fmtDate(project.startDate) }}</span>
          <span>Deadline: {{ fmtDate(project.endDate) }}</span>
          <span v-if="project.code">Mã: {{ project.code }}</span>
        </div>
      </div>
      <div class="flex flex-col items-center gap-3">
        <div class="relative h-20 w-20">
          <svg width="80" height="80" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="34" fill="none" stroke="#f1f5f9" stroke-width="8" />
            <circle
              cx="40" cy="40" r="34" fill="none" :stroke="accentColor" stroke-width="8"
              :stroke-dasharray="RING_C" :stroke-dashoffset="ringOffset"
              transform="rotate(-90 40 40)" stroke-linecap="round"
              style="transition: stroke-dashoffset .4s ease"
            />
          </svg>
          <span class="absolute inset-0 flex items-center justify-center text-lg font-bold text-slate-800">{{ progressPct }}%</span>
        </div>
        <div class="flex gap-2">
          <button
            class="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            :disabled="recalcing"
            title="Tính lại tiến độ từ công việc"
            @click="recalcProgress"
          >
            <span class="material-symbols-rounded text-[14px]">refresh</span>Tính lại tiến độ
          </button>
          <button
            class="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            @click="goEdit"
          >
            <span class="material-symbols-rounded text-[14px]">edit</span>Sửa
          </button>
        </div>
      </div>
    </div>

    <p v-if="message" class="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-700">{{ message }}</p>
    <p v-if="loading" class="text-sm text-slate-400">Đang tải…</p>

    <!-- Tabs -->
    <div class="border-b border-slate-200">
      <nav class="flex gap-1">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="flex items-center gap-1 border-b-2 px-4 py-2 text-md font-medium"
          :class="activeTab === tab.key ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-slate-700'"
          @click="activeTab = tab.key"
        >
          <span class="material-symbols-rounded text-[18px]">{{ tab.icon }}</span>{{ tab.label }}
        </button>
      </nav>
    </div>

    <!-- ===== Tổng quan ===== -->
    <template v-if="activeTab === 'overview' && project">
      <!-- 2.1 Chỉ số -->
      <div class="grid grid-cols-2 gap-4 md:grid-cols-5 py-2">
        <div class="card text-center">
          <div class="text-2xl font-bold" :style="{ color: accentColor }">{{ progressPct }}%</div>
          <div class="text-xs text-slate-500">Tiến độ</div>
        </div>
        <div class="card text-center">
          <div class="text-2xl font-bold text-slate-800">{{ memberCount }}</div>
          <div class="text-xs text-slate-500">Thành viên</div>
        </div>
        <div class="card text-center">
          <div class="text-2xl font-bold text-slate-800">{{ tasks.length }}</div>
          <div class="text-xs text-slate-500">Công việc</div>
        </div>
        <div class="card text-center">
          <div class="text-2xl font-bold text-emerald-600">{{ completedCount }}</div>
          <div class="text-xs text-slate-500">Hoàn thành</div>
        </div>
        <div class="card text-center">
          <div class="text-2xl font-bold" :class="overdueCount > 0 ? 'text-rose-600' : 'text-slate-800'">{{ overdueCount }}</div>
          <div class="text-xs text-rose-500">Quá hạn</div>
        </div>
      </div>

      <!-- 2.2 Phân bố trạng thái + thông tin chung -->
      <div class="grid gap-4 md:grid-cols-2">
        <div class="card space-y-3">
          <h2 class="text-sm font-semibold text-slate-700">Phân bố trạng thái công việc</h2>
          <div class="space-y-2">
            <div v-for="b in statusDistribution" :key="b.key" class="flex items-center gap-3">
              <span class="w-24 flex-shrink-0 text-xs text-slate-600">{{ b.label }}</span>
              <div class="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  class="h-full rounded-full transition-all"
                  :style="{ width: (tasks.length ? (b.count / tasks.length) * 100 : 0) + '%', background: b.color }"
                ></div>
              </div>
              <span class="w-6 flex-shrink-0 text-right text-xs font-medium text-slate-700">{{ b.count }}</span>
            </div>
            <p v-if="statusDistribution.length === 0" class="text-xs text-slate-400">Chưa có cấu hình trạng thái.</p>
          </div>
        </div>

        <div class="card space-y-3">
          <h2 class="text-sm font-semibold text-slate-700">Thông tin chung</h2>
          <dl class="space-y-2 text-sm">
            <div class="flex justify-between"><dt class="text-slate-500">Danh mục</dt><dd>{{ project.category?.title ?? '—' }}</dd></div>
            <div class="flex justify-between"><dt class="text-slate-500">Chủ sở hữu</dt><dd>{{ project.owner?.fullName ?? '—' }}</dd></div>
            <div class="flex items-center justify-between">
              <dt class="text-slate-500">Tiến độ (KPI)</dt>
              <dd class="flex items-center gap-2">
                <span class="font-semibold" :style="projectProgressBadge ? { color: projectProgressBadge.color } : {}">{{ projectComputedProgress }}%</span>
                <span
                  v-if="projectProgressBadge"
                  class="rounded px-2 py-0.5 text-xs font-medium"
                  :style="{ color: projectProgressBadge.color, backgroundColor: projectProgressBadge.color + '22' }"
                >{{ projectProgressBadge.label }}</span>
              </dd>
            </div>
            <div class="flex justify-between"><dt class="text-slate-500">Bắt đầu</dt><dd>{{ formatDateTime(project.startDate) }}</dd></div>
            <div class="flex justify-between"><dt class="text-slate-500">Kết thúc</dt><dd>{{ formatDateTime(project.endDate) }}</dd></div>
          </dl>
          <div>
            <p class="text-sm text-slate-500">Mô tả</p>
            <p class="text-sm text-slate-700">{{ project.description ?? '—' }}</p>
          </div>
        </div>
      </div>
    </template>

    <!-- ===== Giai đoạn (timeline / kanban) ===== -->
    <section v-else-if="activeTab === 'phases'" class="space-y-4">
      <div class="flex items-center justify-end gap-2">
        <div class="inline-flex overflow-hidden rounded-lg border border-slate-300 text-sm">
          <button
            class="px-3 py-1.5 font-medium"
            :class="phaseView === 'list' ? 'bg-brand text-white' : 'bg-white text-slate-600 hover:bg-slate-50'"
            @click="phaseView = 'list'"
          >Danh sách</button>
          <button
            class="px-3 py-1.5 font-medium"
            :class="phaseView === 'kanban' ? 'bg-brand text-white' : 'bg-white text-slate-600 hover:bg-slate-50'"
            @click="phaseView = 'kanban'"
          >Kanban</button>
        </div>
        <button class="btn-primary" @click="openCreatePhase">
          <span class="material-symbols-rounded mr-1 text-[18px]">add</span>Thêm Phase
        </button>
      </div>

      <!-- 3.1 Timeline accordion -->
      <div v-if="phaseView === 'list'" class="relative space-y-3 pl-7">
        <span class="absolute bottom-3 left-[10px] top-3 w-px bg-slate-200"></span>
        <div v-for="phase in project?.phases ?? []" :key="phase.id" class="relative">
          <span class="absolute -left-7 top-4 h-3.5 w-3.5 rounded-full border-2 border-white" :style="{ background: accentColor }"></span>
          <div class="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div class="flex items-center gap-3 px-4 py-3">
              <button class="text-slate-400 hover:text-slate-700" @click="togglePhase(phase.id)">
                <span class="material-symbols-rounded text-[20px]">{{ expanded[phase.id] ? 'expand_more' : 'chevron_right' }}</span>
              </button>
              <span class="font-semibold text-slate-800">{{ phase.title }}</span>
              <span class="text-xs text-slate-400">{{ tasksOfPhase(phase.id).length }} công việc</span>
              <span
                v-if="phaseVisual(phase.status)"
                class="rounded px-2 py-0.5 text-xs font-medium"
                :style="badgeStyle(phaseVisual(phase.status))"
              >{{ phaseVisual(phase.status)?.icon }} {{ phaseVisual(phase.status)?.label }}</span>
              <span v-else class="text-xs text-slate-500">{{ PHASE_STATUS_LABELS[phase.status] }}</span>
              <div class="ml-auto flex items-center gap-2">
                <span class="text-xs text-slate-500">{{ phaseProgressOf(phase.id) }}%</span>
                <button class="text-slate-400 hover:text-brand" title="Thêm công việc" @click="openCreateTask(phase.id)">
                  <span class="material-symbols-rounded text-[18px]">add</span>
                </button>
                <button class="text-slate-400 hover:text-brand" title="Sửa giai đoạn" @click="openEditPhase(phase)">
                  <span class="material-symbols-rounded text-[18px]">edit</span>
                </button>
                <button class="text-slate-400 hover:text-rose-600" title="Xóa giai đoạn" @click="removePhase(phase)">
                  <span class="material-symbols-rounded text-[18px]">delete</span>
                </button>
              </div>
            </div>
            <div v-if="expanded[phase.id]" class="border-t border-slate-100 px-4 py-2">
              <div
                v-for="task in tasksOfPhase(phase.id)"
                :key="task.id"
                class="flex items-center gap-3 border-b border-slate-50 py-2 last:border-0"
              >
                <span class="cursor-pointer font-medium text-slate-600 hover:text-brand" @click="openTaskDetail(task.id)">{{ task.title }}</span>
                <span
                  v-if="taskVisual(task.status)"
                  class="rounded px-2 py-0.5 text-xs font-medium"
                  :style="badgeStyle(taskVisual(task.status))"
                >{{ taskVisual(task.status)?.icon }} {{ taskVisual(task.status)?.label }}</span>
                <span class="rounded px-2 py-0.5 text-xs" :class="taskPriorityClass(task.priority)">{{ TASK_PRIORITY_LABELS[task.priority] }}</span>
                <span class="ml-auto text-xs text-slate-500">{{ taskProgress(task) }}%</span>
                <span class="text-xs text-slate-400">{{ formatDateTime(task.dueDate) }}</span>
              </div>
              <button class="mt-1 text-xs text-brand hover:underline" @click="openCreateTask(phase.id)">+ Thêm công việc</button>
              <p v-if="tasksOfPhase(phase.id).length === 0" class="py-2 text-xs text-slate-400">Chưa có công việc trong giai đoạn này.</p>
            </div>
          </div>
        </div>
        <p v-if="(project?.phases ?? []).length === 0" class="py-6 text-center text-sm text-slate-400">
          Chưa có giai đoạn. Bấm “Thêm Phase” để tạo.
        </p>
      </div>

      <!-- 3.2 Kanban -->
      <div v-else class="flex gap-4 overflow-x-auto pb-2">
        <div
          v-for="phase in project?.phases ?? []"
          :key="phase.id"
          class="w-72 flex-shrink-0 rounded-xl bg-slate-50 p-3 transition"
          :class="dragOverPhase === phase.id ? 'ring-2 ring-brand ring-inset bg-brand-light/40' : ''"
          @dragover.prevent="dragOverPhase = phase.id"
          @dragleave="dragOverPhase = null"
          @drop="onDropToPhase(phase.id)"
        >
          <div class="mb-2 flex items-center justify-between">
            <span class="font-semibold text-slate-800">{{ phase.title }}</span>
            <span class="text-xs text-slate-400">{{ tasksOfPhase(phase.id).length }}</span>
          </div>
          <div class="space-y-2">
            <div
              v-for="task in tasksOfPhase(phase.id)"
              :key="task.id"
              draggable="true"
              class="cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm hover:border-brand active:cursor-grabbing"
              :class="draggedTaskId === task.id ? 'opacity-50' : ''"
              @dragstart="onDragStart(task.id)"
              @click="openTaskDetail(task.id)"
            >
              <p class="text-sm font-medium text-slate-800">{{ task.title }}</p>
              <div class="mt-2 flex flex-wrap items-center gap-1.5">
                <span
                  v-if="taskVisual(task.status)"
                  class="rounded px-1.5 py-0.5 text-[11px] font-medium"
                  :style="badgeStyle(taskVisual(task.status))"
                >{{ taskVisual(task.status)?.icon }} {{ taskVisual(task.status)?.label }}</span>
                <span class="rounded px-1.5 py-0.5 text-[11px]" :class="taskPriorityClass(task.priority)">{{ TASK_PRIORITY_LABELS[task.priority] }}</span>
                <span class="ml-auto text-[11px] text-slate-400">{{ taskProgress(task) }}%</span>
              </div>
            </div>
            <button class="w-full rounded-lg border border-dashed border-slate-300 py-1.5 text-xs text-slate-500 hover:bg-white" @click="openCreateTask(phase.id)">
              + Thêm công việc
            </button>
          </div>
        </div>
        <div
          v-if="unphasedTasks.length > 0 || draggedTaskId !== null"
          class="w-72 flex-shrink-0 rounded-xl bg-slate-50 p-3 transition"
          :class="dragOverPhase === 'none' ? 'ring-2 ring-brand ring-inset bg-brand-light/40' : ''"
          @dragover.prevent="dragOverPhase = 'none'"
          @dragleave="dragOverPhase = null"
          @drop="onDropToPhase(null)"
        >
          <div class="mb-2 flex items-center justify-between">
            <span class="font-semibold text-slate-500">Chưa gán giai đoạn</span>
            <span class="text-xs text-slate-400">{{ unphasedTasks.length }}</span>
          </div>
          <div class="space-y-2">
            <div
              v-for="task in unphasedTasks"
              :key="task.id"
              draggable="true"
              class="cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm hover:border-brand active:cursor-grabbing"
              :class="draggedTaskId === task.id ? 'opacity-50' : ''"
              @dragstart="onDragStart(task.id)"
              @click="openTaskDetail(task.id)"
            >
              <p class="text-sm font-medium text-slate-800">{{ task.title }}</p>
            </div>
            <p v-if="unphasedTasks.length === 0" class="py-2 text-center text-xs text-slate-400">Thả vào đây để gỡ giai đoạn</p>
          </div>
        </div>
        <p v-if="(project?.phases ?? []).length === 0" class="py-6 text-sm text-slate-400">Chưa có giai đoạn.</p>
      </div>
    </section>

    <!-- ===== Thành viên ===== -->
    <section v-else-if="activeTab === 'members'" class="card">
      <div class="table-scroll">
      <table class="data-table">
        <thead>
          <tr class="border-b text-left text-slate-500"><th class="py-2">Thành viên</th><th>Vai trò</th></tr>
        </thead>
        <tbody>
          <tr v-for="m in project?.members ?? []" :key="m.id" class="border-b last:border-0">
            <td class="py-2 font-medium text-slate-800">{{ m.user?.fullName ?? userName(m.userId) }}</td>
            <td>{{ MEMBER_ROLE_LABELS[m.role] }}</td>
          </tr>
          <tr v-if="(project?.members ?? []).length === 0"><td colspan="2" class="py-6 text-center text-slate-400">Chưa có thành viên.</td></tr>
        </tbody>
      </table>
      </div>
    </section>

    <!-- ===== Công việc ===== -->
    <section v-else-if="activeTab === 'tasks'" class="card space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-semibold text-slate-700">Công việc của dự án</h2>
        <button class="btn-primary" @click="openCreateTask()">
          <span class="material-symbols-rounded mr-1 text-[18px]">add</span>Thêm công việc
        </button>
      </div>
      <div class="table-scroll">
        <table class="data-table min-w-[860px]">
          <thead>
            <tr class="border-b text-left text-slate-500">
              <th class="py-2">Tên công việc</th><th>Phụ trách</th><th>Ưu tiên</th><th>Trạng thái</th><th>Tiến độ</th><th>Hạn</th><th>AI nhận việc</th><th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="task in tasks" :key="task.id" class="border-b last:border-0 hover:bg-slate-50">
              <td class="cursor-pointer py-2 font-medium text-slate-800 hover:text-brand" @click="openTaskDetail(task.id)">{{ task.title }}</td>
              <td>{{ task.assignedTo?.fullName ?? userName(task.assignedToUserId) }}</td>
              <td><span class="rounded px-2 py-0.5 text-xs" :class="taskPriorityClass(task.priority)">{{ TASK_PRIORITY_LABELS[task.priority] }}</span></td>
              <td>
                <span
                  v-if="taskVisual(task.status)"
                  class="rounded px-2 py-0.5 text-xs font-medium"
                  :style="badgeStyle(taskVisual(task.status))"
                >{{ taskVisual(task.status)?.icon }} {{ taskVisual(task.status)?.label }}</span>
                <span v-else class="rounded px-2 py-0.5 text-xs" :class="taskStatusClass(task.status)">{{ TASK_STATUS_LABELS[task.status] }}</span>
              </td>
              <td class="text-xs text-slate-600">{{ taskProgress(task) }}%</td>
              <td class="text-slate-500">{{ formatDateTime(task.dueDate) }}</td>
              <td>
                <button
                  v-if="aiByTask.get(task.id)"
                  class="flex flex-col items-start rounded px-1 text-left hover:bg-slate-100"
                  @click="openTaskDetail(task.id)"
                >
                  <span class="flex items-center gap-1 text-xs font-medium text-brand">
                    <span class="material-symbols-rounded text-[14px]">smart_toy</span>{{ fmtAiDate(aiByTask.get(task.id)!.createdAt) }}
                  </span>
                  <span
                    class="text-[11px]"
                    :class="aiByTask.get(task.id)!.status === 'in_progress' ? 'text-blue-600' : 'text-slate-400'"
                  >{{ aiByTask.get(task.id)!.status === 'in_progress' ? '⏳ Đang thực hiện' : '🕒 Chưa bắt đầu' }}</span>
                </button>
                <span v-else class="text-xs text-slate-300">—</span>
              </td>
              <td class="text-right">
                <button class="text-slate-600 hover:underline" @click="openTaskDetail(task.id)">Xem</button>
                <button class="ml-3 text-brand hover:underline" @click="openEditTask(task)">Sửa</button>
                <button class="ml-3 text-rose-600 hover:underline" @click="removeTask(task)">Xóa</button>
              </td>
            </tr>
            <tr v-if="tasks.length === 0"><td colspan="8" class="py-6 text-center text-slate-400">Chưa có công việc.</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- ===== Gantt Chart ===== -->
    <section v-else-if="activeTab === 'gantt'">
      <ProjectGantt :phases="project?.phases ?? []" :tasks="tasks" />
    </section>

    <!-- ===== Files ===== -->
    <section v-else-if="activeTab === 'files'">
      <ProjectFiles :project-id="projectId" @open-task="openTaskDetail" />
    </section>

    <!-- Drawer thêm/sửa công việc -->
    <SideDrawer
      :open="drawerOpen"
      :title="drawerTaskId ? 'Sửa công việc' : 'Thêm công việc'"
      subtitle="Công việc thuộc dự án này"
      @close="closeDrawer"
    >
      <div class="space-y-4">
        <p v-if="taskError" class="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{{ taskError }}</p>
        <div>
          <label class="label">Tên công việc *</label>
          <input v-model="taskForm.title" class="input" :class="taskValidation.fieldClass('title')" placeholder="Tên công việc" />
          <span v-if="taskValidation.errors.title" class="mt-1 block text-xs text-rose-600">{{ taskValidation.errors.title }}</span>
        </div>
        <div>
          <label class="label">Loại công việc *</label>
          <select v-model="taskForm.taskCategoryId" class="input" :class="taskValidation.fieldClass('taskCategoryId')">
            <option value="">— Chọn loại —</option>
            <option v-for="c in taskCategories" :key="c.id" :value="c.id">{{ c.title }}</option>
          </select>
          <span v-if="taskValidation.errors.taskCategoryId" class="mt-1 block text-xs text-rose-600">{{ taskValidation.errors.taskCategoryId }}</span>
        </div>
        <div>
          <label class="label">Giai đoạn</label>
          <select v-model="taskForm.projectPhaseId" class="input">
            <option value="">— Không gắn giai đoạn —</option>
            <option v-for="ph in project?.phases ?? []" :key="ph.id" :value="ph.id">{{ ph.title }}</option>
          </select>
        </div>
        <div>
          <label class="label">Người phụ trách</label>
          <select v-model="taskForm.assignedToUserId" class="input">
            <option value="">— Chưa chỉ định —</option>
            <option v-for="u in users" :key="u.id" :value="u.id">
              {{ u.fullName }}<template v-if="u.title"> · {{ u.title }}</template>
            </option>
          </select>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label">Ưu tiên</label>
            <select v-model="taskForm.priority" class="input">
              <option v-for="opt in TASK_PRIORITY_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </div>
          <div>
            <label class="label">Trạng thái</label>
            <select v-model="taskForm.status" class="input">
              <option v-for="opt in TASK_STATUS_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </div>
          <div>
            <label class="label">Bắt đầu *</label>
            <input v-model="taskForm.startDate" type="date" class="input" :class="taskValidation.fieldClass('startDate')" />
            <span v-if="taskValidation.errors.startDate" class="mt-1 block text-xs text-rose-600">{{ taskValidation.errors.startDate }}</span>
          </div>
          <div>
            <label class="label">Hạn hoàn thành *</label>
            <input v-model="taskForm.dueDate" type="date" class="input" :class="taskValidation.fieldClass('dueDate')" />
            <span v-if="taskValidation.errors.dueDate" class="mt-1 block text-xs text-rose-600">{{ taskValidation.errors.dueDate }}</span>
          </div>
        </div>
        <div>
          <label class="label">Mô tả</label>
          <textarea v-model="taskForm.description" class="input" rows="3" />
        </div>
        <AttachmentManager v-if="!drawerTaskId" ref="taskAttachmentRef" entity-type="tasks" :entity-id="null" />
        <AttachmentManager v-else entity-type="tasks" :entity-id="drawerTaskId" />
      </div>
      <template #footer>
        <div class="flex justify-end gap-3">
          <button class="btn-ghost" @click="closeDrawer">Hủy</button>
          <button class="btn-primary" :disabled="savingTask" @click="submitTask">
            {{ savingTask ? 'Đang lưu…' : 'Lưu công việc' }}
          </button>
        </div>
      </template>
    </SideDrawer>

    <!-- Drawer thêm/sửa giai đoạn -->
    <SideDrawer
      :open="phaseFormOpen"
      :title="phaseEditId ? 'Sửa giai đoạn' : 'Thêm giai đoạn'"
      subtitle="Giai đoạn thuộc dự án này"
      @close="phaseFormOpen = false"
    >
      <div class="space-y-4">
        <div>
          <label class="label">Tên giai đoạn *</label>
          <input v-model="phaseForm.title" class="input" :class="phaseValidation.fieldClass('title')" placeholder="vd: Phát triển" />
          <span v-if="phaseValidation.errors.title" class="mt-1 block text-xs text-rose-600">{{ phaseValidation.errors.title }}</span>
        </div>
        <div>
          <label class="label">Trạng thái</label>
          <select v-model="phaseForm.status" class="input">
            <option v-for="opt in PHASE_STATUS_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>
        <div>
          <label class="label">Mô tả</label>
          <textarea v-model="phaseForm.description" class="input" rows="3" placeholder="Mô tả giai đoạn (tùy chọn)" />
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-3">
          <button class="btn-ghost" @click="phaseFormOpen = false">Hủy</button>
          <button class="btn-primary" :disabled="phaseSaving" @click="submitPhase">
            {{ phaseSaving ? 'Đang lưu…' : 'Lưu giai đoạn' }}
          </button>
        </div>
      </template>
    </SideDrawer>

    <!-- Drawer chi tiết công việc dùng chung (gồm "Giao việc cho AI") -->
    <TaskDetailDrawer
      :open="taskDetailOpen"
      :task-id="taskDetailId"
      @close="taskDetailOpen = false; loadAiAssignments()"
      @edit="onTaskDetailEdit"
    />
  </div>
</template>
