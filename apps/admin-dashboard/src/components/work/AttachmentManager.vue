<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { workApi } from '@/api/endpoints';
import { http } from '@/api/http';
import type { AttachmentEntityType, EntityAttachment } from '@/api/types';
import { confirmDelete, toastError, toastSuccess } from '@/utils/swal';

const props = defineProps<{
  entityType: AttachmentEntityType;
  entityId: number | null;
}>();

interface StagedFile {
  fileName: string;
  mimeType: string;
  contentBase64: string;
  size: number;
}

const existing = ref<EntityAttachment[]>([]);
const staged = ref<StagedFile[]>([]);
const busy = ref(false);
const error = ref<string | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

const hasStaged = computed(() => staged.value.length > 0);

const loadExisting = async (): Promise<void> => {
  if (!props.entityId) {
    existing.value = [];
    return;
  }
  try {
    existing.value = await workApi.attachments(props.entityType, props.entityId);
  } catch {
    error.value = 'Không tải được danh sách tệp đính kèm.';
  }
};

const readAsBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('read-error'));
    reader.readAsDataURL(file);
  });

const onPick = async (event: Event): Promise<void> => {
  const input = event.target as HTMLInputElement;
  if (!input.files || input.files.length === 0) return;
  error.value = null;
  const files = Array.from(input.files);
  for (const file of files) {
    try {
      const contentBase64 = await readAsBase64(file);
      const item: StagedFile = {
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        contentBase64,
        size: file.size,
      };
      if (props.entityId) {
        busy.value = true;
        await workApi.createAttachment({
          entityType: props.entityType,
          entityId: props.entityId,
          fileName: item.fileName,
          mimeType: item.mimeType,
          contentBase64: item.contentBase64,
        });
        busy.value = false;
      } else {
        staged.value.push(item);
      }
    } catch {
      error.value = `Không tải lên được tệp "${file.name}".`;
      busy.value = false;
    }
  }
  if (props.entityId) await loadExisting();
  if (fileInput.value) fileInput.value.value = '';
};

const removeExisting = async (id: number): Promise<void> => {
  const ok = await confirmDelete('Xóa tệp đính kèm này?');
  if (!ok) return;
  try {
    await workApi.removeAttachment(id);
    toastSuccess('Đã xóa tệp đính kèm.');
    await loadExisting();
  } catch {
    toastError('Xóa tệp đính kèm thất bại.');
  }
};

const removeStaged = (index: number): void => {
  staged.value.splice(index, 1);
};

const download = async (item: EntityAttachment): Promise<void> => {
  const response = await http.get(workApi.attachmentDownloadUrl(item.id), {
    responseType: 'blob',
  });
  const url = URL.createObjectURL(response.data as Blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = item.fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

/** Đẩy các tệp đang chờ (staged) lên server sau khi thực thể được tạo. */
const flush = async (newEntityId: number): Promise<void> => {
  for (const item of staged.value) {
    await workApi.createAttachment({
      entityType: props.entityType,
      entityId: newEntityId,
      fileName: item.fileName,
      mimeType: item.mimeType,
      contentBase64: item.contentBase64,
    });
  }
  staged.value = [];
};

const formatSize = (bytes: number | null): string => {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

watch(() => props.entityId, loadExisting);
onMounted(loadExisting);

defineExpose({ flush, hasStaged });
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <p class="text-sm font-semibold text-slate-700">Tệp đính kèm</p>
      <label class="btn-ghost cursor-pointer text-xs">
        <span class="material-symbols-rounded mr-1 text-[16px]">upload</span>
        Thêm tệp
        <input ref="fileInput" type="file" multiple class="hidden" @change="onPick" />
      </label>
    </div>
    <p v-if="busy" class="text-xs text-slate-400">Đang tải lên…</p>
    <p v-if="error" class="rounded bg-amber-50 px-3 py-1 text-xs text-amber-700">{{ error }}</p>

    <ul class="space-y-2">
      <li
        v-for="item in existing"
        :key="`e-${item.id}`"
        class="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
      >
        <button class="flex items-center gap-2 text-left text-brand hover:underline" @click="download(item)">
          <span class="material-symbols-rounded text-[18px] text-slate-400">attach_file</span>
          <span>{{ item.fileName }}</span>
          <span class="text-xs text-slate-400">({{ formatSize(item.fileSize) }})</span>
        </button>
        <button class="text-rose-500 hover:text-rose-700" title="Xóa" @click="removeExisting(item.id)">
          <span class="material-symbols-rounded text-[18px]">delete</span>
        </button>
      </li>
      <li
        v-for="(item, index) in staged"
        :key="`s-${index}`"
        class="flex items-center justify-between rounded-lg border border-dashed border-brand/40 bg-brand/5 px-3 py-2 text-sm"
      >
        <span class="flex items-center gap-2">
          <span class="material-symbols-rounded text-[18px] text-brand">schedule</span>
          <span>{{ item.fileName }}</span>
          <span class="text-xs text-slate-400">({{ formatSize(item.size) }}) · chờ lưu</span>
        </span>
        <button class="text-rose-500 hover:text-rose-700" title="Bỏ" @click="removeStaged(index)">
          <span class="material-symbols-rounded text-[18px]">close</span>
        </button>
      </li>
      <li
        v-if="existing.length === 0 && staged.length === 0"
        class="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400"
      >
        Chưa có tệp đính kèm.
      </li>
    </ul>
  </div>
</template>
