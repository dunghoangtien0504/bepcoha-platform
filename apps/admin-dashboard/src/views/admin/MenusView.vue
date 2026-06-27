<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { menusApi, rbacApi } from '@/api/endpoints';
import type { MenuNode, Permission } from '@/api/types';
import { useValidationForm } from '@/composables/useValidationForm';
import { confirmDelete, confirmSubmit, toastError, toastSuccess } from '@/utils/swal';

interface FlatMenu {
  node: MenuNode;
  depth: number;
}

const tree = ref<MenuNode[]>([]);
const permissions = ref<Permission[]>([]);
const message = ref<string | null>(null);
const editingId = ref<string | null>(null);

const blankForm = () => ({
  name: '',
  parentId: '',
  sort: 0,
  requirePermissions: '',
  routePath: '',
  iconType: 'material_symbol' as MenuNode['iconType'],
  iconValue: '',
  isActive: true,
});
const form = reactive(blankForm());

const validation = useValidationForm(form, {
  name: { required: true, label: 'Tên menu' },
});

// Làm phẳng cây để render bảng có thụt lề.
const flat = computed<FlatMenu[]>(() => {
  const out: FlatMenu[] = [];
  const walk = (nodes: MenuNode[], depth: number): void => {
    for (const node of nodes) {
      out.push({ node, depth });
      walk(node.children, depth + 1);
    }
  };
  walk(tree.value, 0);
  return out;
});

const topLevel = computed(() => tree.value);

const load = async (): Promise<void> => {
  try {
    [tree.value, permissions.value] = await Promise.all([menusApi.tree(), rbacApi.permissions()]);
  } catch {
    message.value = 'Không tải được menu.';
  }
};

const resetForm = (): void => {
  Object.assign(form, blankForm());
  editingId.value = null;
  validation.clearErrors();
};

const edit = (node: MenuNode): void => {
  editingId.value = node.id;
  validation.clearErrors();
  Object.assign(form, {
    name: node.name,
    parentId: node.parentId ?? '',
    sort: node.sort,
    requirePermissions: node.requirePermissions ?? '',
    routePath: node.routePath ?? '',
    iconType: node.iconType,
    iconValue: node.iconValue ?? '',
    isActive: node.isActive,
  });
};

const submit = async (): Promise<void> => {
  message.value = null;
  if (!validation.validate()) return;
  const ok = await confirmSubmit({
    title: editingId.value ? 'Cập nhật menu?' : 'Tạo menu mới?',
    text: 'Vui lòng kiểm tra lại thông tin trước khi lưu.',
  });
  if (!ok) return;
  try {
    const payload: Record<string, unknown> = { ...form };
    if (!payload.parentId) delete payload.parentId;
    if (!payload.requirePermissions) payload.requirePermissions = undefined;
    if (!payload.routePath) payload.routePath = undefined;
    if (editingId.value) {
      await menusApi.update(editingId.value, payload);
    } else {
      await menusApi.create(payload);
    }
    resetForm();
    await load();
    toastSuccess('Đã lưu menu.');
  } catch {
    toastError('Lưu menu thất bại.');
  }
};

const remove = async (id: string): Promise<void> => {
  const ok = await confirmDelete('Xóa menu này?');
  if (!ok) return;
  try {
    await menusApi.remove(id);
    toastSuccess('Đã xóa menu.');
    await load();
  } catch {
    toastError('Xóa menu thất bại.');
  }
};

onMounted(load);
</script>

<template>
  <div class="space-y-6 p-6">
    <h1 class="text-2xl font-bold text-slate-900">Admin Menus</h1>
    <p v-if="message" class="rounded-lg bg-brand-light px-4 py-2 text-sm text-brand-dark">{{ message }}</p>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <section class="card lg:col-span-2">
        <h2 class="mb-3 font-semibold text-slate-800">Cây menu</h2>
        <div class="table-scroll"><table class="data-table">
          <thead>
            <tr class="border-b text-left text-slate-500">
              <th class="py-2">Tên</th>
              <th>Route</th>
              <th>Quyền yêu cầu</th>
              <th>Sort</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in flat" :key="item.node.id" class="border-b last:border-0">
              <td class="py-2" :style="{ paddingLeft: `${item.depth * 20}px` }">
                <span v-if="item.node.iconType === 'material_symbol'" class="material-symbols-rounded align-middle text-[18px] text-slate-400">
                  {{ item.node.iconValue }}
                </span>
                {{ item.node.name }}
              </td>
              <td class="text-slate-500">{{ item.node.routePath ?? '—' }}</td>
              <td class="font-mono text-xs text-slate-500">{{ item.node.requirePermissions ?? '—' }}</td>
              <td>{{ item.node.sort }}</td>
              <td class="text-right">
                <button class="text-xs text-brand hover:underline" @click="edit(item.node)">Sửa</button>
                <button class="ml-2 text-xs text-rose-600 hover:underline" @click="remove(item.node.id)">Xóa</button>
              </td>
            </tr>
          </tbody>
        </table></div>
      </section>

      <section class="card">
        <h2 class="mb-3 font-semibold text-slate-800">{{ editingId ? 'Sửa menu' : 'Thêm menu' }}</h2>
        <div class="space-y-3">
          <div>
            <label class="label">Tên</label>
            <input v-model="form.name" class="input" :class="validation.fieldClass('name')" />
            <span v-if="validation.errors.name" class="mt-1 block text-xs text-rose-600">{{ validation.errors.name }}</span>
          </div>
          <div>
            <label class="label">Menu cha</label>
            <select v-model="form.parentId" class="input">
              <option value="">— Cấp 1 —</option>
              <option v-for="node in topLevel" :key="node.id" :value="node.id">{{ node.name }}</option>
            </select>
          </div>
          <div>
            <label class="label">Route path</label>
            <input v-model="form.routePath" class="input" placeholder="/dashboard" />
          </div>
          <div>
            <label class="label">Quyền yêu cầu</label>
            <select v-model="form.requirePermissions" class="input">
              <option value="">— Không yêu cầu —</option>
              <option v-for="perm in permissions" :key="perm.code" :value="perm.code">{{ perm.code }}</option>
            </select>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="label">Loại icon</label>
              <select v-model="form.iconType" class="input">
                <option value="material_symbol">material_symbol</option>
                <option value="svg">svg</option>
                <option value="letter">letter</option>
              </select>
            </div>
            <div>
              <label class="label">Icon value</label>
              <input v-model="form.iconValue" class="input" placeholder="dashboard" />
            </div>
          </div>
          <div>
            <label class="label">Sort</label>
            <input v-model.number="form.sort" type="number" class="input" />
          </div>
          <label class="flex items-center gap-2 text-sm">
            <input v-model="form.isActive" type="checkbox" /> Đang hiển thị
          </label>
          <div class="flex gap-2 pt-1">
            <button class="btn-primary flex-1" @click="submit">{{ editingId ? 'Lưu' : 'Tạo' }}</button>
            <button v-if="editingId" class="btn-ghost" @click="resetForm">Hủy</button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
