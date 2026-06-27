<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import * as XLSX from 'xlsx';
import { workApi } from '@/api/endpoints';
import type { ProjectCategory, ProjectStatus, WorkProject } from '@/api/types';
import { formatDateTime } from '@/utils/format';
import { PROJECT_STATUS_OPTIONS, projectStatusClass, PROJECT_STATUS_LABELS } from '@/utils/work-labels';
import { usePolicy } from '@/composables/usePolicy';
import { confirmDelete, toastError, toastSuccess } from '@/utils/swal';

const router = useRouter();
const { ensureLoaded, projectVisual, badgeStyle, projectThreshold } = usePolicy();

/** Màu tiến độ KPI theo ngưỡng policy (Rủi ro/Gần đạt/Đạt mục tiêu). */
const progressStyle = (progress: number): Record<string, string> => {
  const t = projectThreshold(progress);
  return t ? { color: t.color } : {};
};
const rows = ref<WorkProject[]>([]);
const categories = ref<ProjectCategory[]>([]);
const total = ref(0);
const message = ref<string | null>(null);
const loading = ref(false);

const filters = reactive({
  q: '',
  status: '',
  categoryId: '',
  fromDate: '',
  toDate: '',
  page: 1,
  pageSize: 10,
  sort: 'id',
  order: 'DESC' as 'ASC' | 'DESC',
});

/** Tham số filter dùng chung cho list & export. */
const filterParams = (): Record<string, string | number | undefined> => ({
  q: filters.q || undefined,
  status: filters.status || undefined,
  categoryId: filters.categoryId || undefined,
  fromDate: filters.fromDate || undefined,
  toDate: filters.toDate || undefined,
});

const totalPages = (): number => Math.max(1, Math.ceil(total.value / filters.pageSize));

const load = async (): Promise<void> => {
  loading.value = true;
  try {
    const result = await workApi.projects({
      ...filterParams(),
      page: filters.page,
      pageSize: filters.pageSize,
      sort: filters.sort,
      order: filters.order,
    });
    rows.value = result.rows;
    total.value = result.total;
  } catch {
    message.value = 'Không tải được danh sách dự án.';
  } finally {
    loading.value = false;
  }
};

const applyFilters = (): void => {
  filters.page = 1;
  void load();
};

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

const openDetail = (id: number): void => {
  void router.push({ name: 'work-project-detail', params: { id } });
};

const openCreate = (): void => {
  void router.push({ name: 'work-project-create' });
};

const openEdit = (id: number): void => {
  void router.push({ name: 'work-project-edit', params: { id } });
};

const remove = async (project: WorkProject): Promise<void> => {
  const ok = await confirmDelete(`Xóa dự án "${project.title ?? project.name}"?`);
  if (!ok) return;
  try {
    await workApi.removeProject(project.id);
    toastSuccess('Đã xóa dự án.');
    await load();
  } catch {
    toastError('Xóa dự án thất bại.');
  }
};

// --- Xuất XLS (2 sheet) theo filter, focus vào dự án ---
const exporting = ref(false);
const exportXls = async (): Promise<void> => {
  exporting.value = true;
  try {
    const all = (await workApi.projects({ ...filterParams(), page: 1, pageSize: 1000, sort: 'id', order: 'DESC' })).rows;

    // Tổng hợp client-side cho sheet báo cáo.
    const byStatus = new Map<string, number>();
    const byCategory = new Map<string, number>();
    let progressSum = 0;
    for (const p of all) {
      byStatus.set(p.status, (byStatus.get(p.status) ?? 0) + 1);
      const cat = p.category?.title ?? 'Chưa phân loại';
      byCategory.set(cat, (byCategory.get(cat) ?? 0) + 1);
      progressSum += Number(p.progress) || 0;
    }
    const avgProgress = all.length ? Math.round(progressSum / all.length) : 0;
    const completed = all.filter((p) => p.status === 'completed').length;

    const s1: (string | number)[][] = [
      ['BÁO CÁO TỔNG QUAN DỰ ÁN'],
      ['Khoảng thời gian', `${filters.fromDate || '—'}  →  ${filters.toDate || '—'}`],
      ['Xuất lúc', new Date().toLocaleString('vi-VN')],
      [],
      ['Tổng dự án', all.length],
      ['Hoàn thành', completed],
      ['Tiến độ trung bình (%)', avgProgress],
      [],
      ['Phân bố theo trạng thái', ''],
      ...Array.from(byStatus.entries()).map(
        ([k, v]) => [PROJECT_STATUS_LABELS[k as ProjectStatus] ?? k, v] as [string, number],
      ),
      [],
      ['Phân bố theo nhóm dự án', ''],
      ...Array.from(byCategory.entries()).map(([k, v]) => [k, v] as [string, number]),
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(s1);
    ws1['!cols'] = [{ wch: 28 }, { wch: 26 }];

    const header = ['ID', 'Mã', 'Tên dự án', 'Nhóm dự án', 'Chủ sở hữu', 'Tiến độ (%)', 'Trạng thái', 'Bắt đầu', 'Kết thúc'];
    const detail = all.map((p) => [
      p.id,
      p.code ?? '',
      p.title ?? p.name,
      p.category?.title ?? '',
      p.owner?.fullName ?? '',
      Number(p.progress) || 0,
      PROJECT_STATUS_LABELS[p.status] ?? p.status,
      p.startDate ? p.startDate.slice(0, 10) : '',
      p.endDate ? p.endDate.slice(0, 10) : '',
    ]);
    const ws2 = XLSX.utils.aoa_to_sheet([header, ...detail]);
    ws2['!cols'] = [{ wch: 6 }, { wch: 14 }, { wch: 36 }, { wch: 22 }, { wch: 20 }, { wch: 11 }, { wch: 16 }, { wch: 12 }, { wch: 12 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, 'Báo cáo tổng quan');
    XLSX.utils.book_append_sheet(wb, ws2, 'Chi tiết danh sách dự án');
    XLSX.writeFile(wb, `bao-cao-du-an-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toastSuccess('Đã xuất file Excel.');
  } catch {
    toastError('Xuất Excel thất bại.');
  } finally {
    exporting.value = false;
  }
};

onMounted(async () => {
  void ensureLoaded();
  try {
    categories.value = await workApi.projectCategories();
  } catch {
    /* ignore */
  }
  await load();
});
</script>

<template>
  <div class="space-y-6 p-6">
    <header class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Dự án</h1>
        <p class="text-sm text-slate-500">Quản lý vòng đời dự án: giai đoạn, thành viên, công việc.</p>
      </div>
      <div class="flex gap-2">
        <button class="btn-ghost" :disabled="exporting" @click="exportXls">
          <span class="material-symbols-rounded mr-1 text-[18px]">download</span>{{ exporting ? 'Đang xuất…' : 'Xuất Excel' }}
        </button>
        <button class="btn-primary" @click="openCreate">
          <span class="material-symbols-rounded mr-1 text-[18px]">add</span>Thêm dự án
        </button>
      </div>
    </header>
    <p v-if="message" class="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-700">{{ message }}</p>

    <!-- Bộ lọc -->
    <section class="card">
      <div class="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <input
          v-model="filters.q"
          class="input"
          placeholder="Tìm theo tên / mã dự án"
          @keyup.enter="applyFilters"
        />
        <select v-model="filters.status" class="input" @change="applyFilters">
          <option value="">— Tất cả trạng thái —</option>
          <option v-for="opt in PROJECT_STATUS_OPTIONS" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
        <select v-model="filters.categoryId" class="input" @change="applyFilters">
          <option value="">— Tất cả nhóm dự án —</option>
          <option v-for="c in categories" :key="c.id" :value="String(c.id)">{{ c.title }}</option>
        </select>
        <div>
          <label class="label">Từ ngày</label>
          <input v-model="filters.fromDate" type="date" class="input" @change="applyFilters" />
        </div>
        <div>
          <label class="label">Đến ngày</label>
          <input v-model="filters.toDate" type="date" class="input" @change="applyFilters" />
        </div>
        <button class="btn-ghost self-end" @click="applyFilters">
          <span class="material-symbols-rounded mr-1 text-[18px]">search</span>Lọc
        </button>
      </div>
    </section>

    <section class="card">
      <div class="table-scroll">
      <table class="data-table min-w-[900px]">
        <thead>
          <tr class="border-b text-left text-slate-500">
            <th class="cursor-pointer py-2" @click="toggleSort('code')">Mã</th>
            <th class="cursor-pointer" @click="toggleSort('title')">Tên dự án</th>
            <th>Danh mục</th>
            <th>Chủ sở hữu</th>
            <th class="cursor-pointer text-right" @click="toggleSort('progress')">Tiến độ</th>
            <th class="cursor-pointer" @click="toggleSort('status')">Trạng thái</th>
            <th class="cursor-pointer" @click="toggleSort('startDate')">Bắt đầu</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id" class="border-b last:border-0 hover:bg-slate-50">
            <td class="py-2 text-slate-500">{{ row.code ?? '—' }}</td>
            <td class="cursor-pointer font-medium text-slate-800" @click="openDetail(row.id)">
              {{ row.title ?? row.name }}
            </td>
            <td>{{ row.category?.title ?? '—' }}</td>
            <td>{{ row.owner?.fullName ?? '—' }}</td>
            <td class="text-right">
              <span class="font-medium" :style="progressStyle(Number(row.progress))">{{ Number(row.progress) }}%</span>
            </td>
            <td>
              <span
                v-if="projectVisual(row.status)"
                class="rounded px-2 py-0.5 text-xs font-medium"
                :style="badgeStyle(projectVisual(row.status))"
              >{{ projectVisual(row.status)?.icon }} {{ projectVisual(row.status)?.label }}</span>
              <span v-else class="rounded px-2 py-0.5 text-xs" :class="projectStatusClass(row.status)">
                {{ PROJECT_STATUS_LABELS[row.status] }}
              </span>
            </td>
            <td class="text-slate-500">{{ formatDateTime(row.startDate) }}</td>
            <td class="whitespace-nowrap text-right">
              <button class="text-brand hover:underline" @click="openEdit(row.id)">Sửa</button>
              <button class="ml-3 text-rose-600 hover:underline" @click="remove(row)">Xóa</button>
            </td>
          </tr>
          <tr v-if="rows.length === 0 && !loading">
            <td colspan="8" class="py-6 text-center text-slate-400">Chưa có dự án.</td>
          </tr>
        </tbody>
      </table>
      </div>

      <!-- Phân trang -->
      <div class="mt-4 flex items-center justify-between text-sm text-slate-500">
        <span>Tổng {{ total }} dự án</span>
        <div class="flex items-center gap-2">
          <button class="btn-ghost px-2 py-1" :disabled="filters.page <= 1" @click="changePage(-1)">
            <span class="material-symbols-rounded text-[18px]">chevron_left</span>
          </button>
          <span>Trang {{ filters.page }} / {{ totalPages() }}</span>
          <button
            class="btn-ghost px-2 py-1"
            :disabled="filters.page >= totalPages()"
            @click="changePage(1)"
          >
            <span class="material-symbols-rounded text-[18px]">chevron_right</span>
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
