<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { workApi } from '@/api/endpoints';
import { http } from '@/api/http';
import type { EntityAttachment } from '@/api/types';
import { toastError, toastSuccess } from '@/utils/swal';

const props = defineProps<{ projectId: number }>();
const emit = defineEmits<{ (e: 'open-task', id: number): void }>();

type Cat = 'project' | 'task' | 'recent';
const cat = ref<Cat>('project');
const projectFiles = ref<EntityAttachment[]>([]);
const taskFiles = ref<EntityAttachment[]>([]);
const loading = ref(false);
const uploading = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

const load = async (): Promise<void> => {
  loading.value = true;
  try {
    const data = await workApi.projectAttachments(props.projectId);
    projectFiles.value = data.projectFiles;
    taskFiles.value = data.taskFiles;
  } catch {
    /* ignore */
  } finally {
    loading.value = false;
  }
};

const recentFiles = computed<EntityAttachment[]>(() =>
  [...projectFiles.value, ...taskFiles.value].sort((a, b) => b.id - a.id).slice(0, 20),
);
const rows = computed<EntityAttachment[]>(() =>
  cat.value === 'project' ? projectFiles.value : cat.value === 'task' ? taskFiles.value : recentFiles.value,
);
const showTaskCol = computed<boolean>(() => cat.value === 'task' || cat.value === 'recent');

const fileType = (a: EntityAttachment): string => {
  if (a.storageUrl) return 'Link';
  return (a.fileExtension ?? a.mimeType?.split('/').pop() ?? '—').toUpperCase();
};
const humanSize = (bytes: number | null): string => {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

// --- Tải xuống (fetch blob có kèm JWT) ---
const fetchBlobUrl = async (id: number): Promise<string> => {
  const res = await http.get(workApi.attachmentDownloadUrl(id), { responseType: 'blob' });
  return URL.createObjectURL(res.data as Blob);
};
const download = async (a: EntityAttachment): Promise<void> => {
  try {
    const url = await fetchBlobUrl(a.id);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = a.fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  } catch {
    toastError('Tải xuống thất bại.');
  }
};

// --- Xem trước (modal full màn hình) ---
type PreviewKind = 'image' | 'pdf' | 'text' | 'youtube' | 'embed' | 'office' | 'other';
const previewOpen = ref(false);
const previewKind = ref<PreviewKind>('other');
const previewUrl = ref<string>('');
const previewName = ref<string>('');
let previewObjectUrl: string | null = null;

const IMG = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'];
const TXT = ['txt', 'csv', 'json', 'md', 'log', 'xml', 'html', 'htm'];
const OFFICE = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];

const youtubeEmbed = (url: string): string | null => {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
};

const openPreview = async (a: EntityAttachment): Promise<void> => {
  previewName.value = a.fileName;
  if (previewObjectUrl) {
    URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = null;
  }
  // Link ngoài (youtube / web)
  if (a.storageUrl) {
    const yt = youtubeEmbed(a.storageUrl);
    previewKind.value = yt ? 'youtube' : 'embed';
    previewUrl.value = yt ?? a.storageUrl;
    previewOpen.value = true;
    return;
  }
  const ext = (a.fileExtension ?? '').toLowerCase();
  if (IMG.includes(ext) || a.mimeType?.startsWith('image/')) previewKind.value = 'image';
  else if (ext === 'pdf' || a.mimeType === 'application/pdf') previewKind.value = 'pdf';
  else if (TXT.includes(ext)) previewKind.value = 'text';
  else if (OFFICE.includes(ext)) previewKind.value = 'office';
  else previewKind.value = 'other';

  if (previewKind.value === 'office' || previewKind.value === 'other') {
    previewOpen.value = true; // chỉ hiển thị thông báo + nút tải
    return;
  }
  try {
    previewObjectUrl = await fetchBlobUrl(a.id);
    previewUrl.value = previewObjectUrl;
    previewOpen.value = true;
  } catch {
    toastError('Không xem trước được tệp.');
  }
};
const closePreview = (): void => {
  previewOpen.value = false;
  if (previewObjectUrl) {
    URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = null;
  }
};

// --- Tải lên (Project Files) ---
const triggerUpload = (): void => fileInput.value?.click();
const onFileChosen = async (e: Event): Promise<void> => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  uploading.value = true;
  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('read'));
      reader.readAsDataURL(file);
    });
    await workApi.createAttachment({
      entityType: 'projects',
      entityId: props.projectId,
      fileName: file.name,
      mimeType: file.type || undefined,
      contentBase64: dataUrl,
    });
    toastSuccess('Đã tải lên tệp.');
    await load();
  } catch {
    toastError('Tải lên thất bại.');
  } finally {
    uploading.value = false;
    input.value = '';
  }
};

onMounted(load);
</script>

<template>
  <div class="flex gap-4">
    <input ref="fileInput" type="file" class="hidden" @change="onFileChosen" />

    <!-- Panel trái -->
    <aside class="w-56 flex-shrink-0 space-y-1 rounded-xl border border-slate-200 bg-white p-2">
      <button
        v-for="c in ([
          { key: 'project', label: 'Project Files', icon: 'folder', count: projectFiles.length },
          { key: 'task', label: 'Task Attachments', icon: 'task_alt', count: taskFiles.length },
          { key: 'recent', label: 'Recent Uploads', icon: 'schedule', count: recentFiles.length },
        ] as const)"
        :key="c.key"
        class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm"
        :class="cat === c.key ? 'bg-brand-light/60 font-semibold text-brand' : 'text-slate-600 hover:bg-slate-50'"
        @click="cat = c.key"
      >
        <span class="material-symbols-rounded text-[18px]">{{ c.icon }}</span>
        <span class="flex-1 text-left">{{ c.label }}</span>
        <span class="rounded-full bg-slate-100 px-2 text-xs text-slate-500">{{ c.count }}</span>
      </button>
    </aside>

    <!-- Bảng file -->
    <div class="card flex-1 space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <span class="material-symbols-rounded text-[18px]">folder_open</span>
          {{ cat === 'project' ? 'Project Files' : cat === 'task' ? 'Task Attachments' : 'Recent Uploads' }}
          <span class="text-xs font-normal text-slate-400">{{ rows.length }} tệp</span>
        </h2>
        <button v-if="cat === 'project'" class="btn-primary" :disabled="uploading" @click="triggerUpload">
          <span class="material-symbols-rounded mr-1 text-[18px]">upload</span>{{ uploading ? 'Đang tải…' : 'Tải lên' }}
        </button>
      </div>

      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr class="border-b text-left text-slate-500">
              <th class="py-2">Tên tệp</th>
              <th v-if="showTaskCol">Task</th>
              <th>Loại</th>
              <th>Dung lượng</th>
              <th class="text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in rows" :key="a.id" class="border-b last:border-0 hover:bg-slate-50">
              <td class="py-2 font-medium text-slate-800">
                <span class="flex items-center gap-2">
                  <span class="material-symbols-rounded text-[18px] text-slate-400">{{ a.storageUrl ? 'link' : 'description' }}</span>
                  {{ a.fileName }}
                </span>
              </td>
              <td v-if="showTaskCol">
                <button v-if="a.taskName" class="text-brand hover:underline" @click="emit('open-task', a.entityId)">
                  #{{ a.entityId }} · {{ a.taskName }}
                </button>
                <span v-else class="text-slate-400">—</span>
              </td>
              <td><span class="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{{ fileType(a) }}</span></td>
              <td class="text-slate-500">{{ humanSize(a.fileSize) }}</td>
              <td class="whitespace-nowrap text-right">
                <button class="text-brand hover:underline" @click="openPreview(a)">Xem trước</button>
                <button class="ml-3 text-slate-600 hover:underline" @click="download(a)">Tải xuống</button>
              </td>
            </tr>
            <tr v-if="rows.length === 0 && !loading">
              <td :colspan="showTaskCol ? 5 : 4" class="py-10 text-center text-slate-400">
                Chưa có tệp nào.
                <button v-if="cat === 'project'" class="ml-1 text-brand hover:underline" @click="triggerUpload">Tải lên tệp đầu tiên</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal xem trước full màn hình -->
    <div v-if="previewOpen" class="fixed inset-0 z-50 flex flex-col bg-black/70" @click.self="closePreview">
      <div class="flex items-center justify-between bg-white px-5 py-3">
        <span class="truncate font-medium text-slate-800">{{ previewName }}</span>
        <button class="rounded-lg p-1 text-slate-500 hover:bg-slate-100" @click="closePreview">
          <span class="material-symbols-rounded">close</span>
        </button>
      </div>
      <div class="flex flex-1 items-center justify-center overflow-auto p-4">
        <img v-if="previewKind === 'image'" :src="previewUrl" class="max-h-full max-w-full rounded-lg bg-white" alt="preview" />
        <iframe
          v-else-if="['pdf', 'text', 'youtube', 'embed'].includes(previewKind)"
          :src="previewUrl"
          class="h-full w-full rounded-lg border-0 bg-white"
          :allow="previewKind === 'youtube' ? 'autoplay; encrypted-media; fullscreen' : undefined"
        ></iframe>
        <div v-else class="rounded-xl bg-white p-8 text-center text-sm text-slate-500">
          <span class="material-symbols-rounded mb-2 block text-4xl text-slate-300">{{ previewKind === 'office' ? 'description' : 'draft' }}</span>
          Không thể xem trước trực tiếp loại tệp này trong trình duyệt.
        </div>
      </div>
    </div>
  </div>
</template>
