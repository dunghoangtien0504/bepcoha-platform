<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { usersApi, workApi } from '@/api/endpoints';
import type {
  AdminUser,
  MemberInput,
  PhaseInput,
  ProjectCategory,
  WorkProjectPayload,
} from '@/api/types';
import AttachmentManager from '@/components/work/AttachmentManager.vue';
import {
  MEMBER_ROLE_OPTIONS,
  PHASE_STATUS_OPTIONS,
  PROJECT_STATUS_OPTIONS,
} from '@/utils/work-labels';
import { useValidationForm } from '@/composables/useValidationForm';
import { confirmSubmit, toastError, toastSuccess } from '@/utils/swal';

const route = useRoute();
const router = useRouter();

const projectId = computed<number | null>(() => {
  const raw = route.params.id;
  if (raw === undefined) return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
});
const isEdit = computed(() => projectId.value !== null);

const categories = ref<ProjectCategory[]>([]);
const users = ref<AdminUser[]>([]);
const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const attachmentRef = ref<InstanceType<typeof AttachmentManager> | null>(null);

const form = reactive<{
  projectCategoryId: number | '';
  code: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  progress: number;
  status: WorkProjectPayload['status'];
  ownerId: string;
}>({
  projectCategoryId: '',
  code: '',
  title: '',
  description: '',
  startDate: '',
  endDate: '',
  progress: 0,
  status: 'draft',
  ownerId: '',
});

const validation = useValidationForm(form, {
  title: { required: true, label: 'Tên dự án' },
  projectCategoryId: { required: true, label: 'Danh mục' },
  startDate: { required: true, label: 'Ngày bắt đầu' },
});

const phases = ref<PhaseInput[]>([]);
const members = ref<MemberInput[]>([]);

const toDateInput = (value: string | null): string => {
  if (!value) return '';
  return value.slice(0, 10);
};

const addPhase = (): void => {
  phases.value.push({ title: '', status: 'pending', sort: phases.value.length });
};
const removePhase = (index: number): void => {
  phases.value.splice(index, 1);
};

const addMember = (): void => {
  members.value.push({ userId: '', role: 'member', isActive: true });
};
const removeMember = (index: number): void => {
  members.value.splice(index, 1);
};

const loadRefs = async (): Promise<void> => {
  try {
    categories.value = await workApi.projectCategories();
  } catch {
    /* ignore */
  }
  try {
    users.value = await usersApi.list();
  } catch {
    /* ignore */
  }
};

const loadProject = async (): Promise<void> => {
  if (projectId.value === null) return;
  loading.value = true;
  try {
    const p = await workApi.project(projectId.value);
    form.projectCategoryId = p.projectCategoryId ?? '';
    form.code = p.code ?? '';
    form.title = p.title ?? p.name ?? '';
    form.description = p.description ?? '';
    form.startDate = toDateInput(p.startDate);
    form.endDate = toDateInput(p.endDate);
    form.progress = Number(p.progress) || 0;
    form.status = p.status;
    form.ownerId = p.ownerId ?? '';
    phases.value = (p.phases ?? []).map((ph) => ({
      id: ph.id,
      title: ph.title,
      description: ph.description,
      sort: ph.sort,
      status: ph.status,
    }));
    members.value = (p.members ?? []).map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      isActive: m.isActive,
    }));
  } catch {
    error.value = 'Không tải được dự án.';
  } finally {
    loading.value = false;
  }
};

const buildPayload = (): WorkProjectPayload | null => {
  if (!validation.validate()) return null;
  return {
    projectCategoryId: Number(form.projectCategoryId),
    code: form.code.trim() || undefined,
    title: form.title.trim(),
    description: form.description.trim() || undefined,
    startDate: form.startDate,
    endDate: form.endDate || undefined,
    progress: Number(form.progress) || 0,
    status: form.status,
    ownerId: form.ownerId || undefined,
    phases: phases.value
      .filter((p) => p.title.trim())
      .map((p, idx) => ({ ...p, title: p.title.trim(), sort: idx })),
    members: members.value.filter((m) => m.userId),
  };
};

const submit = async (): Promise<void> => {
  error.value = null;
  const payload = buildPayload();
  if (!payload) return;
  const ok = await confirmSubmit({
    title: isEdit.value ? 'Cập nhật dự án?' : 'Tạo dự án mới?',
    text: 'Vui lòng kiểm tra lại thông tin trước khi lưu.',
  });
  if (!ok) return;
  saving.value = true;
  try {
    if (isEdit.value && projectId.value !== null) {
      await workApi.updateProject(projectId.value, payload);
      toastSuccess('Đã cập nhật dự án.');
      void router.push({ name: 'work-project-detail', params: { id: projectId.value } });
    } else {
      const created = await workApi.createProject(payload);
      if (attachmentRef.value?.hasStaged) {
        await attachmentRef.value.flush(created.id);
      }
      toastSuccess('Đã tạo dự án mới.');
      void router.push({ name: 'work-project-detail', params: { id: created.id } });
    }
  } catch {
    error.value = 'Lưu dự án thất bại. Vui lòng kiểm tra dữ liệu nhập.';
    toastError('Lưu dự án thất bại.');
  } finally {
    saving.value = false;
  }
};

const cancel = (): void => {
  if (isEdit.value && projectId.value !== null) {
    void router.push({ name: 'work-project-detail', params: { id: projectId.value } });
  } else {
    void router.push({ name: 'work-projects' });
  }
};

onMounted(async () => {
  await loadRefs();
  if (isEdit.value) await loadProject();
});
</script>

<template>
  <div class="space-y-6 p-6">
    <header class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">
          {{ isEdit ? 'Sửa dự án' : 'Thêm dự án' }}
        </h1>
        <p class="text-sm text-slate-500">
          Thông tin chung, giai đoạn, thành viên và tệp đính kèm của dự án.
        </p>
      </div>
      <button class="btn-ghost" @click="cancel">
        <span class="material-symbols-rounded mr-1 text-[18px]">arrow_back</span>Quay lại
      </button>
    </header>

    <p v-if="error" class="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700">{{ error }}</p>
    <p v-if="loading" class="text-sm text-slate-400">Đang tải…</p>

    <form class="space-y-6" @submit.prevent="submit">
      <!-- Thông tin chung -->
      <section class="card space-y-4">
        <h2 class="text-sm font-semibold text-slate-700">Thông tin chung</h2>
        <div class="grid gap-4 md:grid-cols-2">
          <div>
            <label class="label">Tên dự án *</label>
            <input v-model="form.title" class="input" :class="validation.fieldClass('title')" placeholder="Tên dự án" />
            <span v-if="validation.errors.title" class="mt-1 block text-xs text-rose-600">{{ validation.errors.title }}</span>
          </div>
          <div>
            <label class="label">Mã dự án</label>
            <input v-model="form.code" class="input" placeholder="Tự sinh nếu bỏ trống" />
          </div>
          <div>
            <label class="label">Danh mục *</label>
            <select v-model="form.projectCategoryId" class="input" :class="validation.fieldClass('projectCategoryId')">
              <option value="">— Chọn danh mục —</option>
              <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.title }}</option>
            </select>
            <span v-if="validation.errors.projectCategoryId" class="mt-1 block text-xs text-rose-600">{{ validation.errors.projectCategoryId }}</span>
          </div>
          <div>
            <label class="label">Chủ sở hữu</label>
            <select v-model="form.ownerId" class="input">
              <option value="">— Chưa chỉ định —</option>
              <option v-for="u in users" :key="u.id" :value="u.id">
                {{ u.fullName }}<template v-if="u.title"> · {{ u.title }}</template>
              </option>
            </select>
          </div>
          <div>
            <label class="label">Ngày bắt đầu *</label>
            <input v-model="form.startDate" type="date" class="input" :class="validation.fieldClass('startDate')" />
            <span v-if="validation.errors.startDate" class="mt-1 block text-xs text-rose-600">{{ validation.errors.startDate }}</span>
          </div>
          <div>
            <label class="label">Ngày kết thúc (dự kiến)</label>
            <input v-model="form.endDate" type="date" class="input" />
          </div>
          <div>
            <label class="label">Trạng thái</label>
            <select v-model="form.status" class="input">
              <option v-for="opt in PROJECT_STATUS_OPTIONS" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>
          <div>
            <label class="label">Tiến độ (%)</label>
            <input v-model.number="form.progress" type="number" min="0" max="100" class="input" />
          </div>
        </div>
        <div>
          <label class="label">Mô tả</label>
          <textarea v-model="form.description" class="input" rows="3" placeholder="Mô tả dự án" />
        </div>
      </section>

      <!-- Giai đoạn -->
      <section class="card space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-semibold text-slate-700">Giai đoạn (phases)</h2>
          <button type="button" class="btn-ghost text-xs" @click="addPhase">
            <span class="material-symbols-rounded mr-1 text-[16px]">add</span>Thêm giai đoạn
          </button>
        </div>
        <div v-if="phases.length === 0" class="text-xs text-slate-400">Chưa có giai đoạn.</div>
        <div
          v-for="(phase, index) in phases"
          :key="`phase-${index}`"
          class="grid items-end gap-3 md:grid-cols-[1fr_200px_auto]"
        >
          <div>
            <label class="label">Tên giai đoạn</label>
            <input v-model="phase.title" class="input" placeholder="VD: Phân tích yêu cầu" />
          </div>
          <div>
            <label class="label">Trạng thái</label>
            <select v-model="phase.status" class="input">
              <option v-for="opt in PHASE_STATUS_OPTIONS" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>
          <button
            type="button"
            class="mb-1 text-rose-500 hover:text-rose-700"
            title="Xóa"
            @click="removePhase(index)"
          >
            <span class="material-symbols-rounded">delete</span>
          </button>
        </div>
      </section>

      <!-- Thành viên -->
      <section class="card space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-semibold text-slate-700">Thành viên (members)</h2>
          <button type="button" class="btn-ghost text-xs" @click="addMember">
            <span class="material-symbols-rounded mr-1 text-[16px]">add</span>Thêm thành viên
          </button>
        </div>
        <div v-if="members.length === 0" class="text-xs text-slate-400">Chưa có thành viên.</div>
        <div
          v-for="(member, index) in members"
          :key="`member-${index}`"
          class="grid items-end gap-3 md:grid-cols-[1fr_200px_auto]"
        >
          <div>
            <label class="label">Thành viên</label>
            <select v-model="member.userId" class="input">
              <option value="">— Chọn người dùng —</option>
              <option v-for="u in users" :key="u.id" :value="u.id">
                {{ u.fullName }}<template v-if="u.title"> · {{ u.title }}</template>
              </option>
            </select>
          </div>
          <div>
            <label class="label">Vai trò</label>
            <select v-model="member.role" class="input">
              <option v-for="opt in MEMBER_ROLE_OPTIONS" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>
          <button
            type="button"
            class="mb-1 text-rose-500 hover:text-rose-700"
            title="Xóa"
            @click="removeMember(index)"
          >
            <span class="material-symbols-rounded">delete</span>
          </button>
        </div>
      </section>

      <!-- Tệp đính kèm -->
      <section class="card">
        <AttachmentManager
          ref="attachmentRef"
          entity-type="projects"
          :entity-id="projectId"
        />
      </section>

      <div class="flex justify-end gap-3">
        <button type="button" class="btn-ghost" @click="cancel">Hủy</button>
        <button type="submit" class="btn-primary" :disabled="saving">
          <span class="material-symbols-rounded mr-1 text-[18px]">save</span>
          {{ saving ? 'Đang lưu…' : 'Lưu dự án' }}
        </button>
      </div>
    </form>
  </div>
</template>
