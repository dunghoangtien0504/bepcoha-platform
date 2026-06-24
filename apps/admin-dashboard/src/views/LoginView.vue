<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';

const auth = useAuthStore();
const router = useRouter();

const email = ref('');
const password = ref('');

const handleSubmit = async (): Promise<void> => {
  const ok = await auth.login(email.value, password.value);
  if (ok) {
    await router.push({ name: 'dashboard' });
  }
};
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-slate-900 p-4">
    <div class="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
      <h1 class="text-2xl font-bold text-slate-900">HACO-food-OS</h1>
      <p class="mt-1 text-sm text-slate-500">Hệ thống quản trị AI — Bếp Cô Hạ</p>

      <form class="mt-6 space-y-4" @submit.prevent="handleSubmit">
        <div>
          <label class="label">Email</label>
          <input v-model="email" type="email" class="input" autocomplete="username" />
        </div>
        <div>
          <label class="label">Mật khẩu</label>
          <input v-model="password" type="password" class="input" autocomplete="current-password" />
        </div>

        <p v-if="auth.error" class="text-sm text-rose-600">{{ auth.error }}</p>

        <button type="submit" class="btn-primary w-full" :disabled="auth.loading">
          {{ auth.loading ? 'Đang đăng nhập…' : 'Đăng nhập' }}
        </button>
      </form>

      <p class="mt-4 text-center text-xs text-slate-400">
        Dùng tài khoản admin đã cấu hình trong biến môi trường.
      </p>
    </div>
  </div>
</template>
