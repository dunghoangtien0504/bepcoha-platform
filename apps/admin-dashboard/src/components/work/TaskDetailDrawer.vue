<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { workApi } from '@/api/endpoints';
import { http } from '@/api/http';
import type { AiAssignment, EntityAttachment, WorkTask } from '@/api/types';
import SideDrawer from '@/components/common/SideDrawer.vue';
import { usePolicy } from '@/composables/usePolicy';
import { formatDateTime } from '@/utils/format';
import {
  TASK_PRIORITY_LABELS,
  TASK_PROGRESS_SOURCE_LABELS,
  TASK_STATUS_LABELS,
  taskPriorityClass,
  taskStatusClass,
} from '@/utils/work-labels';
import { confirmSubmit, toastError, toastSuccess } from '@/utils/swal';

const props = defineProps<{ open: boolean; taskId: number | null }>();
const emit = defineEmits<{ (e: 'close'): void; (e: 'edit', id: number): void }>();

const { ensureLoaded, taskVisual, badgeStyle, taskProgress } = usePolicy();

const detail = ref<WorkTask | null>(null);
const assignment = ref<AiAssignment | null>(null);
const loading = ref(false);

const loadDetail = async (id: number): Promise<void> => {
  detail.value = null;
  assignment.value = null;
  assignAiOpen.value = false;
  editOpen.value = false;
  loading.value = true;
  try {
    await ensureLoaded();
    detail.value = await workApi.task(id);
    assignment.value = await workApi.aiAssignment(id);
  } finally {
    loading.value = false;
  }
};

watch(
  () => [props.open, props.taskId] as const,
  ([open, id]) => {
    if (open && id !== null) void loadDetail(id);
  },
  { immediate: true },
);

// --- Giao việc cho AI (tạo ai_tasks) ---
const assignAiOpen = ref(false);
const editOpen = ref(false);
const assignAiSubmitting = ref(false);
const assignAiForm = reactive({
  baselineHours: 0,
  endDate: '',
  title: '',
  budgetTokens: '' as number | '',
  moreDesc: '',
});

/** Placeholder hướng dẫn user mô tả ngữ cảnh đầu vào để AI hiểu rõ task. */
const MORE_DESC_PLACEHOLDER =
  'Mô tả ngữ cảnh để AI hiểu rõ task:\n' +
  '• Mục tiêu cần đạt (output mong muốn là gì).\n' +
  '• Đầu vào / dữ liệu cần đọc (vd: đọc file abc.pdf, sheet "Doanh thu", repo nào…).\n' +
  '• Ràng buộc & tiêu chí nghiệm thu (vd: giữ nguyên định dạng, không đổi API public).\n' +
  '• Định dạng kết quả (vd: bảng Markdown, JSON theo schema, báo cáo tiếng Việt).\n' +
  '• Ví dụ tham khảo nếu có.';

const toDateInput = (iso: string | null | undefined): string =>
  iso ? new Date(iso).toISOString().slice(0, 10) : '';

const assignAiMaxDate = (): string => toDateInput(detail.value?.project?.endDate ?? null);

const openAssignAi = (): void => {
  if (!detail.value) return;
  assignAiForm.baselineHours = Number(detail.value.estimatedHours ?? 0);
  assignAiForm.endDate = toDateInput(detail.value.dueDate);
  assignAiForm.title = detail.value.title;
  assignAiForm.budgetTokens = '';
  assignAiForm.moreDesc = '';
  assignAiOpen.value = true;
};

const submitAssignAi = async (): Promise<void> => {
  if (!detail.value) return;
  if (assignAiForm.baselineHours <= 0) {
    toastError('Số giờ công ước tính phải lớn hơn 0.');
    return;
  }
  const max = assignAiMaxDate();
  if (max && assignAiForm.endDate && assignAiForm.endDate > max) {
    toastError(`Ngày phải hoàn thành không được vượt quá ngày kết thúc dự án (${max}).`);
    return;
  }
  const ok = await confirmSubmit({
    title: 'Giao việc cho AI?',
    text: `Tạo tác vụ AI cho "${assignAiForm.title}" với ${assignAiForm.baselineHours} giờ công ước tính.`,
  });
  if (!ok) return;
  assignAiSubmitting.value = true;
  try {
    await workApi.assignAi(detail.value.id, {
      baselineHours: assignAiForm.baselineHours,
      endDate: assignAiForm.endDate || undefined,
      title: assignAiForm.title || undefined,
      budgetTokens: assignAiForm.budgetTokens === '' ? undefined : Number(assignAiForm.budgetTokens),
      moreDesc: assignAiForm.moreDesc.trim() || undefined,
    });
    toastSuccess('Đã giao việc cho AI. Tác vụ AI đã được tạo.');
    assignAiOpen.value = false;
    assignment.value = await workApi.aiAssignment(detail.value.id);
  } catch {
    toastError('Giao việc cho AI thất bại.');
  } finally {
    assignAiSubmitting.value = false;
  }
};

/** Định dạng ngày dd/mm/yyyy cho hiển thị thông tin AI. */
const fmtDate = (iso: string | null): string => (iso ? new Date(iso).toLocaleDateString('vi-VN') : '—');

const openEditAi = (): void => {
  if (!assignment.value) return;
  assignAiForm.baselineHours = Number(assignment.value.baselineHours);
  assignAiForm.endDate = toDateInput(assignment.value.endDate);
  assignAiForm.title = assignment.value.title;
  assignAiForm.budgetTokens = assignment.value.budgetTokens ?? '';
  assignAiForm.moreDesc = assignment.value.moreDesc ?? '';
  editOpen.value = true;
};

const submitEditAi = async (): Promise<void> => {
  if (!assignment.value) return;
  if (assignAiForm.baselineHours <= 0) {
    toastError('Số giờ công ước tính phải lớn hơn 0.');
    return;
  }
  const max = assignAiMaxDate();
  if (max && assignAiForm.endDate && assignAiForm.endDate > max) {
    toastError(`Ngày phải hoàn thành không được vượt quá ngày kết thúc dự án (${max}).`);
    return;
  }
  const ok = await confirmSubmit({ title: 'Cập nhật việc đã giao cho AI?', text: 'Lưu thay đổi tác vụ AI.' });
  if (!ok) return;
  assignAiSubmitting.value = true;
  try {
    await workApi.updateAiTask(assignment.value.aiTaskId, {
      title: assignAiForm.title || undefined,
      baselineHours: assignAiForm.baselineHours,
      endDate: assignAiForm.endDate || undefined,
      budgetTokens: assignAiForm.budgetTokens === '' ? undefined : Number(assignAiForm.budgetTokens),
      moreDesc: assignAiForm.moreDesc.trim() || undefined,
    });
    toastSuccess('Đã cập nhật việc giao cho AI.');
    editOpen.value = false;
    if (detail.value) assignment.value = await workApi.aiAssignment(detail.value.id);
  } catch {
    toastError('Cập nhật thất bại.');
  } finally {
    assignAiSubmitting.value = false;
  }
};

const downloadAttachment = async (item: EntityAttachment): Promise<void> => {
  const response = await http.get(workApi.attachmentDownloadUrl(item.id), { responseType: 'blob' });
  const url = URL.createObjectURL(response.data as Blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = item.fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};
</script>

<template>
  <SideDrawer :open="open" :title="detail?.title ?? 'Chi tiết công việc'" @close="emit('close')">
    <div v-if="detail" class="space-y-4 text-sm">
      <dl class="space-y-2">
        <div class="flex justify-between"><dt class="text-slate-500">Dự án</dt><dd>{{ detail.project?.title ?? '—' }}</dd></div>
        <div class="flex justify-between"><dt class="text-slate-500">Giai đoạn</dt><dd>{{ detail.phase?.title ?? '—' }}</dd></div>
        <div class="flex justify-between"><dt class="text-slate-500">Loại</dt><dd>{{ detail.category?.title ?? '—' }}</dd></div>
        <div class="flex justify-between"><dt class="text-slate-500">Phụ trách</dt><dd>{{ detail.assignedTo?.fullName ?? '—' }}</dd></div>
        <div class="flex justify-between"><dt class="text-slate-500">Người giao</dt><dd>{{ detail.assigner?.fullName ?? '—' }}</dd></div>
        <div class="flex justify-between"><dt class="text-slate-500">Ưu tiên</dt><dd><span class="rounded px-2 py-0.5 text-xs" :class="taskPriorityClass(detail.priority)">{{ TASK_PRIORITY_LABELS[detail.priority] }}</span></dd></div>
        <div class="flex justify-between">
          <dt class="text-slate-500">Trạng thái</dt>
          <dd>
            <span
              v-if="taskVisual(detail.status)"
              class="rounded px-2 py-0.5 text-xs font-medium"
              :style="badgeStyle(taskVisual(detail.status))"
            >{{ taskVisual(detail.status)?.icon }} {{ taskVisual(detail.status)?.label }}</span>
            <span v-else class="rounded px-2 py-0.5 text-xs" :class="taskStatusClass(detail.status)">{{ TASK_STATUS_LABELS[detail.status] }}</span>
          </dd>
        </div>
        <div class="flex justify-between"><dt class="text-slate-500">Bắt đầu</dt><dd>{{ formatDateTime(detail.startDate) }}</dd></div>
        <div class="flex justify-between"><dt class="text-slate-500">Hạn</dt><dd>{{ formatDateTime(detail.dueDate) }}</dd></div>
        <div class="flex justify-between"><dt class="text-slate-500">Công việc cha</dt><dd>{{ detail.parent?.title ?? '—' }}</dd></div>
        <div class="flex justify-between"><dt class="text-slate-500">Giờ công ước tính</dt><dd>{{ detail.estimatedHours ?? '—' }}</dd></div>
        <div class="flex justify-between"><dt class="text-slate-500">Tiến độ (KPI)</dt><dd>{{ taskProgress(detail) }}%</dd></div>
        <div class="flex justify-between"><dt class="text-slate-500">Nguồn cập nhật tiến độ</dt><dd>{{ TASK_PROGRESS_SOURCE_LABELS[detail.progressSource] }}</dd></div>
      </dl>
      <div>
        <p class="text-slate-500">Mô tả</p>
        <p class="text-slate-700">{{ detail.description ?? '—' }}</p>
      </div>

      <!-- Giao việc cho AI / Thông tin việc đã giao -->
      <div class="rounded-lg border border-brand-light bg-brand-light/40 p-3">
        <div class="flex items-center justify-between">
          <p class="font-semibold text-brand-dark">
            <span class="material-symbols-rounded mr-1 align-middle text-[18px]">smart_toy</span>
            {{ assignment ? 'Đã giao cho AI' : 'Giao việc cho AI' }}
          </p>
          <button v-if="assignment && !editOpen && !assignAiOpen" class="btn-ghost px-3 py-1 text-xs" @click="openEditAi">Sửa</button>
          <button v-else-if="!assignment && !assignAiOpen && detail.status !== 'completed'" class="btn-primary px-3 py-1 text-xs" @click="openAssignAi">Giao việc cho AI</button>
        </div>

        <!-- Thông tin việc đã giao (xem) -->
        <dl v-if="assignment && !editOpen" class="mt-2 space-y-1.5 text-xs text-slate-600">
          <div class="flex justify-between gap-3"><dt class="text-slate-400">Tiêu đề công việc</dt><dd class="text-right font-medium text-slate-700">{{ assignment.title }}</dd></div>
          <div><dt class="text-slate-400">Nội dung công việc</dt><dd class="mt-0.5 whitespace-pre-line text-slate-700">{{ detail.description ?? '—' }}</dd></div>
          <div><dt class="text-slate-400">Mô tả thêm</dt><dd class="mt-0.5 whitespace-pre-line text-slate-700">{{ assignment.moreDesc ?? '—' }}</dd></div>
          <div class="flex justify-between gap-3"><dt class="text-slate-400">Ngày phải hoàn thành</dt><dd class="font-medium text-slate-700">{{ fmtDate(assignment.endDate) }}</dd></div>
          <div class="flex justify-between gap-3"><dt class="text-slate-400">Số giờ ước tính</dt><dd class="font-medium text-slate-700">{{ assignment.baselineHours }} giờ</dd></div>
          <div class="flex justify-between gap-3"><dt class="text-slate-400">Ngân sách token</dt><dd class="font-medium text-slate-700">{{ assignment.budgetTokens != null ? assignment.budgetTokens.toLocaleString('vi-VN') : 'Không giới hạn' }}</dd></div>
          <div class="flex justify-between gap-3">
            <dt class="text-slate-400">Trạng thái</dt>
            <dd>
              <span
                class="rounded px-2 py-0.5 text-xs font-medium"
                :class="assignment.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'"
              >{{ assignment.status === 'in_progress' ? '⏳ Đang thực hiện' : '🕒 Chưa bắt đầu' }}</span>
            </dd>
          </div>
        </dl>

        <p v-else-if="!assignment && !assignAiOpen && detail.status === 'completed'" class="mt-1 text-xs text-slate-500">
          Công việc đã hoàn thành — không cần giao cho AI.
        </p>
        <p v-else-if="!assignment && !assignAiOpen" class="mt-1 text-xs text-slate-500">
          Tạo tác vụ AI gắn với công việc này — đồng bộ số giờ công ước tính & ngày phải hoàn thành làm mốc đo ROI.
        </p>

        <!-- Form tạo / sửa (dùng chung) -->
        <div v-if="assignAiOpen || editOpen" class="mt-3 space-y-3">
          <div>
            <label class="label">Tiêu đề tác vụ AI</label>
            <input v-model="assignAiForm.title" class="input" />
          </div>
          <div>
            <label class="label">Số giờ công ước tính (baseline)</label>
            <input v-model.number="assignAiForm.baselineHours" type="number" min="0" step="0.5" class="input" />
          </div>
          <div>
            <label class="label">Ngân sách token</label>
            <input v-model="assignAiForm.budgetTokens" type="number" min="0" step="1000" class="input" placeholder="vd: 200000" />
            <p class="mt-1 text-xs text-slate-400">Giới hạn token cho tác vụ AI (để trống nếu không giới hạn).</p>
          </div>
          <div>
            <label class="label">Mô tả thêm cho AI (ngữ cảnh đầu vào)</label>
            <textarea v-model="assignAiForm.moreDesc" rows="6" class="input" :placeholder="MORE_DESC_PLACEHOLDER" />
          </div>
          <div>
            <label class="label">Ngày phải hoàn thành</label>
            <input v-model="assignAiForm.endDate" type="date" class="input" :max="assignAiMaxDate() || undefined" />
            <p v-if="assignAiMaxDate()" class="mt-1 text-xs text-slate-400">Tối đa: {{ assignAiMaxDate() }} (ngày kết thúc dự án)</p>
          </div>
          <div class="flex justify-end gap-2">
            <button class="btn-ghost px-3 py-1 text-xs" :disabled="assignAiSubmitting" @click="assignAiOpen = false; editOpen = false">Hủy</button>
            <button class="btn-primary px-3 py-1 text-xs" :disabled="assignAiSubmitting" @click="editOpen ? submitEditAi() : submitAssignAi()">
              {{ assignAiSubmitting ? 'Đang xử lý…' : editOpen ? 'Lưu' : 'Xác nhận' }}
            </button>
          </div>
        </div>
      </div>

      <div>
        <p class="mb-2 font-semibold text-slate-700">Tệp đính kèm</p>
        <ul class="space-y-2">
          <li
            v-for="att in detail.attachments ?? []"
            :key="att.id"
            class="flex items-center rounded-lg border border-slate-200 px-3 py-2"
          >
            <button class="flex items-center gap-2 text-brand hover:underline" @click="downloadAttachment(att)">
              <span class="material-symbols-rounded text-[18px] text-slate-400">attach_file</span>{{ att.fileName }}
            </button>
          </li>
          <li v-if="(detail.attachments ?? []).length === 0" class="text-xs text-slate-400">Chưa có tệp đính kèm.</li>
        </ul>
      </div>
    </div>
    <p v-else class="text-sm text-slate-400">Đang tải…</p>
    <template #footer>
      <div class="flex justify-end gap-3">
        <button class="btn-ghost" @click="emit('close')">Đóng</button>
        <button v-if="detail" class="btn-primary" @click="emit('edit', detail.id)">Sửa</button>
      </div>
    </template>
  </SideDrawer>
</template>
