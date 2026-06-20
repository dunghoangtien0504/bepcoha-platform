<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { rbacApi } from '@/api/endpoints';
import type { AppModule, Permission, Role } from '@/api/types';
import { confirmDelete, confirmSubmit, toastError, toastSuccess } from '@/utils/swal';

const roles = ref<Role[]>([]);
const modules = ref<AppModule[]>([]);
const permissions = ref<Permission[]>([]);
const selectedRole = ref<Role | null>(null);
const selectedCodes = ref<Set<string>>(new Set());
const newRoleName = ref('');
const message = ref<string | null>(null);

// Gom permission theo module -> scope để hiển thị ma trận phân quyền.
const grouped = computed(() => {
  return modules.value.map((module) => ({
    module,
    scopes: module.scopes.map((scope) => ({
      scope,
      perms: permissions.value.filter((p) => p.module === module.code && p.scope === scope.code),
    })),
  }));
});

const load = async (): Promise<void> => {
  try {
    [roles.value, modules.value, permissions.value] = await Promise.all([
      rbacApi.roles(),
      rbacApi.modules(),
      rbacApi.permissions(),
    ]);
  } catch {
    message.value = 'Không tải được dữ liệu phân quyền.';
  }
};

const selectRole = (role: Role): void => {
  selectedRole.value = role;
  selectedCodes.value = new Set(role.permissionCodes);
};

const toggle = (code: string): void => {
  const next = new Set(selectedCodes.value);
  if (next.has(code)) {
    next.delete(code);
  } else {
    next.add(code);
  }
  selectedCodes.value = next;
};

const toggleScope = (codes: string[], enable: boolean): void => {
  const next = new Set(selectedCodes.value);
  codes.forEach((code) => (enable ? next.add(code) : next.delete(code)));
  selectedCodes.value = next;
};

const createRole = async (): Promise<void> => {
  if (!newRoleName.value.trim()) {
    toastError('Vui lòng nhập tên vai trò.');
    return;
  }
  const ok = await confirmSubmit({ title: 'Tạo vai trò mới?', text: `Tạo vai trò "${newRoleName.value}".` });
  if (!ok) return;
  try {
    const role = await rbacApi.createRole({ name: newRoleName.value });
    newRoleName.value = '';
    await load();
    selectRole(role);
    toastSuccess(`Đã tạo vai trò ${role.code}.`);
  } catch {
    toastError('Tạo vai trò thất bại.');
  }
};

const savePermissions = async (): Promise<void> => {
  if (!selectedRole.value) return;
  const ok = await confirmSubmit({ title: 'Lưu phân quyền?', text: `Áp dụng quyền cho vai trò ${selectedRole.value.name}.` });
  if (!ok) return;
  try {
    const updated = await rbacApi.setRolePermissions(
      selectedRole.value.id,
      Array.from(selectedCodes.value),
    );
    toastSuccess(`Đã lưu ${updated.permissionCodes.length} quyền cho ${updated.name}.`);
    await load();
  } catch {
    toastError('Lưu phân quyền thất bại (vai trò super_admin có thể bị khóa).');
  }
};

const removeRole = async (role: Role): Promise<void> => {
  const ok = await confirmDelete(`Xóa vai trò ${role.name}?`);
  if (!ok) return;
  try {
    await rbacApi.removeRole(role.id);
    if (selectedRole.value?.id === role.id) selectedRole.value = null;
    toastSuccess('Đã xóa vai trò.');
    await load();
  } catch {
    toastError('Không thể xóa vai trò này.');
  }
};

onMounted(load);
</script>

<template>
  <div class="space-y-6 p-6">
    <h1 class="text-2xl font-bold text-slate-900">Vai trò & Phân quyền</h1>
    <p v-if="message" class="rounded-lg bg-brand-light px-4 py-2 text-sm text-brand-dark">{{ message }}</p>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-4">
      <section class="card lg:col-span-1">
        <h2 class="mb-3 font-semibold text-slate-800">Vai trò</h2>
        <div class="mb-3 flex gap-2">
          <input v-model="newRoleName" class="input" placeholder="Tên vai trò mới" />
          <button class="btn-primary whitespace-nowrap" @click="createRole">Thêm</button>
        </div>
        <ul class="space-y-1">
          <li
            v-for="role in roles"
            :key="role.id"
            class="flex items-center justify-between rounded-lg px-3 py-2 text-sm"
            :class="selectedRole?.id === role.id ? 'bg-brand text-white' : 'hover:bg-slate-100'"
          >
            <button class="flex-1 text-left" @click="selectRole(role)">
              {{ role.name }}
              <span class="block text-xs opacity-70">{{ role.code }} · {{ role.permissionCodes.length }} quyền</span>
            </button>
            <button
              v-if="role.code !== 'super_admin'"
              class="text-xs hover:underline"
              :class="selectedRole?.id === role.id ? 'text-white' : 'text-rose-600'"
              @click="removeRole(role)"
            >
              Xóa
            </button>
          </li>
        </ul>
      </section>

      <section class="card lg:col-span-3">
        <div v-if="!selectedRole" class="py-10 text-center text-slate-400">
          Chọn một vai trò để cấu hình quyền.
        </div>
        <div v-else>
          <div class="mb-4 flex items-center justify-between">
            <h2 class="font-semibold text-slate-800">
              Phân quyền cho: <span class="text-brand">{{ selectedRole.name }}</span>
            </h2>
            <button class="btn-primary" @click="savePermissions">Lưu phân quyền</button>
          </div>

          <div class="space-y-5">
            <div v-for="group in grouped" :key="group.module.id">
              <h3 class="mb-2 text-sm font-bold uppercase tracking-wide text-slate-600">
                {{ group.module.name }}
              </h3>
              <div class="space-y-3">
                <div v-for="row in group.scopes" :key="row.scope.id" class="rounded-lg border border-slate-200 p-3">
                  <div class="mb-2 flex items-center justify-between">
                    <span class="text-sm font-semibold text-slate-700">{{ row.scope.name }}</span>
                    <div class="flex gap-2 text-xs">
                      <button class="text-brand hover:underline" @click="toggleScope(row.perms.map((p) => p.code), true)">
                        Chọn hết
                      </button>
                      <button class="text-slate-500 hover:underline" @click="toggleScope(row.perms.map((p) => p.code), false)">
                        Bỏ hết
                      </button>
                    </div>
                  </div>
                  <div class="grid grid-cols-2 gap-2 md:grid-cols-3">
                    <label
                      v-for="perm in row.perms"
                      :key="perm.code"
                      class="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        :checked="selectedCodes.has(perm.code)"
                        @change="toggle(perm.code)"
                      />
                      <span :title="perm.code">{{ perm.name }}</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
