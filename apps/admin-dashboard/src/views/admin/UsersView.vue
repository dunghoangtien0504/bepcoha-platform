<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { rbacApi, usersApi } from '@/api/endpoints';
import type { AdminUser, Role } from '@/api/types';
import { useValidationForm } from '@/composables/useValidationForm';
import { confirmDelete, confirmSubmit, toastError, toastSuccess } from '@/utils/swal';

const users = ref<AdminUser[]>([]);
const roles = ref<Role[]>([]);
const message = ref<string | null>(null);
const editingId = ref<string | null>(null);

const blankForm = (): Record<string, unknown> => ({
  roleId: '',
  fullName: '',
  displayName: '',
  email: '',
  password: '',
  phone: '',
  gender: 'unknow',
  birthday: '',
  title: '',
  isAdmin: false,
  isActive: true,
  reportToId: '',
});

const form = reactive<Record<string, unknown>>(blankForm());

const validation = useValidationForm(form, {
  roleId: { required: true, label: 'Vai trò' },
  fullName: { required: true, label: 'Họ tên' },
  email: { required: true, label: 'Email' },
  password: {
    label: 'Mật khẩu',
    validator: (v) => (editingId.value || (typeof v === 'string' && v.length > 0) ? null : 'Mật khẩu là bắt buộc'),
  },
});

const load = async (): Promise<void> => {
  try {
    [users.value, roles.value] = await Promise.all([usersApi.list(), rbacApi.roles()]);
  } catch {
    message.value = 'Không tải được dữ liệu người dùng.';
  }
};

const resetForm = (): void => {
  Object.assign(form, blankForm());
  editingId.value = null;
  validation.clearErrors();
};

const edit = (user: AdminUser): void => {
  editingId.value = user.id;
  validation.clearErrors();
  Object.assign(form, {
    roleId: user.roleId,
    fullName: user.fullName,
    displayName: user.displayName,
    email: user.email,
    password: '',
    phone: user.phone ?? '',
    gender: user.gender ?? 'unknow',
    birthday: user.birthday ?? '',
    title: user.title ?? '',
    isAdmin: user.isAdmin,
    isActive: user.isActive,
    reportToId: user.reportToId ?? '',
  });
};

const submit = async (): Promise<void> => {
  message.value = null;
  if (!validation.validate()) return;
  const ok = await confirmSubmit({
    title: editingId.value ? 'Cập nhật người dùng?' : 'Tạo người dùng mới?',
    text: 'Vui lòng kiểm tra lại thông tin trước khi lưu.',
  });
  if (!ok) return;
  try {
    const payload: Record<string, unknown> = { ...form };
    Object.keys(payload).forEach((key) => {
      if (payload[key] === '' || payload[key] === null) delete payload[key];
    });
    if (editingId.value) {
      await usersApi.update(editingId.value, payload);
      toastSuccess('Đã cập nhật người dùng.');
    } else {
      await usersApi.create(payload);
      toastSuccess('Đã tạo người dùng mới.');
    }
    resetForm();
    await load();
  } catch {
    toastError('Thao tác thất bại (email trùng hoặc thiếu trường bắt buộc).');
  }
};

const remove = async (id: string): Promise<void> => {
  const ok = await confirmDelete('Xóa người dùng này?');
  if (!ok) return;
  try {
    await usersApi.remove(id);
    toastSuccess('Đã xóa người dùng.');
    await load();
  } catch {
    toastError('Xóa người dùng thất bại.');
  }
};

onMounted(load);
</script>

<template>
  <div class="space-y-6 p-6">
    <h1 class="text-2xl font-bold text-slate-900">Quản lý Người dùng</h1>
    <p v-if="message" class="rounded-lg bg-brand-light px-4 py-2 text-sm text-brand-dark">{{ message }}</p>

    <div class="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <section class="card xl:col-span-2">
        <h2 class="mb-3 font-semibold text-slate-800">Danh sách</h2>
        <div class="table-scroll"><table class="data-table">
          <thead>
            <tr class="border-b text-left text-slate-500">
              <th class="py-2">Họ tên</th>
              <th>Email</th>
              <th>Vai trò</th>
              <th>Báo cáo đến</th>
              <th>Admin</th>
              <th>Trạng thái</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user.id" class="border-b last:border-0">
              <td class="py-2">
                <p class="font-medium text-slate-800">{{ user.displayName }}</p>
                <p class="text-xs text-slate-500">{{ user.fullName }}</p>
              </td>
              <td>{{ user.email }}</td>
              <td>{{ user.roleName }}</td>
              <td>{{ user.reportToName ?? '—' }}</td>
              <td>{{ user.isAdmin ? '✔' : '—' }}</td>
              <td>
                <span :class="user.isActive ? 'text-emerald-600' : 'text-rose-600'">
                  {{ user.isActive ? 'Active' : 'Khóa' }}
                </span>
              </td>
              <td class="text-right">
                <button class="text-xs text-brand hover:underline" @click="edit(user)">Sửa</button>
                <button class="ml-2 text-xs text-rose-600 hover:underline" @click="remove(user.id)">Xóa</button>
              </td>
            </tr>
          </tbody>
        </table></div>
      </section>

      <section class="card">
        <h2 class="mb-3 font-semibold text-slate-800">
          {{ editingId ? 'Sửa người dùng' : 'Thêm người dùng' }}
        </h2>
        <div class="space-y-3">
          <div>
            <label class="label">Vai trò</label>
            <select v-model="form.roleId" class="input" :class="validation.fieldClass('roleId')">
              <option value="">— Chọn vai trò —</option>
              <option v-for="role in roles" :key="role.id" :value="role.id">{{ role.name }}</option>
            </select>
            <span v-if="validation.errors.roleId" class="mt-1 block text-xs text-rose-600">{{ validation.errors.roleId }}</span>
          </div>
          <div>
            <label class="label">Họ tên</label>
            <input v-model="form.fullName" class="input" :class="validation.fieldClass('fullName')" />
            <span v-if="validation.errors.fullName" class="mt-1 block text-xs text-rose-600">{{ validation.errors.fullName }}</span>
          </div>
          <div>
            <label class="label">Tên hiển thị (tự điền nếu trống)</label>
            <input v-model="form.displayName" class="input" />
          </div>
          <div>
            <label class="label">Email</label>
            <input v-model="form.email" type="email" class="input" :class="validation.fieldClass('email')" :disabled="!!editingId" />
            <span v-if="validation.errors.email" class="mt-1 block text-xs text-rose-600">{{ validation.errors.email }}</span>
          </div>
          <div>
            <label class="label">{{ editingId ? 'Mật khẩu mới (bỏ trống nếu giữ nguyên)' : 'Mật khẩu' }}</label>
            <input v-model="form.password" type="password" class="input" :class="validation.fieldClass('password')" />
            <span v-if="validation.errors.password" class="mt-1 block text-xs text-rose-600">{{ validation.errors.password }}</span>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="label">Giới tính</label>
              <select v-model="form.gender" class="input">
                <option value="male">Nam</option>
                <option value="female">Nữ</option>
                <option value="both">Both</option>
                <option value="unknow">Unknow</option>
              </select>
            </div>
            <div>
              <label class="label">Ngày sinh</label>
              <input v-model="form.birthday" type="date" class="input" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="label">Điện thoại</label>
              <input v-model="form.phone" class="input" />
            </div>
            <div>
              <label class="label">Chức danh</label>
              <input v-model="form.title" class="input" />
            </div>
          </div>
          <div>
            <label class="label">Báo cáo đến (quản lý trực tiếp)</label>
            <select v-model="form.reportToId" class="input">
              <option value="">— Không có —</option>
              <option
                v-for="u in users"
                :key="u.id"
                :value="u.id"
                :disabled="editingId === u.id"
              >
                {{ u.fullName }}
              </option>
            </select>
          </div>
          <label class="flex items-center gap-2 text-sm">
            <input v-model="form.isAdmin" type="checkbox" /> Là Admin (toàn quyền)
          </label>
          <label class="flex items-center gap-2 text-sm">
            <input v-model="form.isActive" type="checkbox" /> Đang hoạt động
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
