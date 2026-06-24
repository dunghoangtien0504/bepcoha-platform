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
  <div class="flex min-h-screen items-center justify-center bg-stone-900 p-4">
    <!-- Background pattern -->
    <div class="absolute inset-0 opacity-5" style="background-image: repeating-linear-gradient(45deg, #d97706 0, #d97706 1px, transparent 0, transparent 50%); background-size: 20px 20px;"></div>

    <div class="relative w-full max-w-md">
      <!-- Logo card -->
      <div class="mb-6 text-center">
        <div class="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500 shadow-lg shadow-amber-500/30">
          <span class="text-2xl font-black text-white">HC</span>
        </div>
        <h1 class="text-2xl font-black text-white tracking-tight">HACO-food-OS</h1>
        <p class="mt-1 text-sm text-stone-400">Hệ thống quản trị AI · Bếp Cô Hạ</p>
      </div>

      <!-- Login form -->
      <div class="rounded-2xl bg-white p-8 shadow-2xl">
        <h2 class="mb-1 text-lg font-bold text-slate-900">Đăng nhập</h2>
        <p class="mb-6 text-xs text-slate-400">Dành cho quản trị viên hệ thống</p>

        <form class="space-y-4" @submit.prevent="handleSubmit">
          <div>
            <label class="label">Email</label>
            <input v-model="email" type="email" class="input" autocomplete="username" placeholder="admin@hacofood.vn" />
          </div>
          <div>
            <label class="label">Mật khẩu</label>
            <input v-model="password" type="password" class="input" autocomplete="current-password" />
          </div>

          <p v-if="auth.error" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">
            {{ auth.error }}
          </p>

          <button type="submit" class="btn-primary w-full py-2.5" :disabled="auth.loading">
            {{ auth.loading ? 'Đang đăng nhập…' : 'Đăng nhập' }}
          </button>
        </form>

        <p class="mt-5 border-t border-slate-100 pt-4 text-center text-xs text-slate-400">
          Hacofood.vn &mdash; Bếp Cô Hạ &copy; 2026
        </p>
      </div>
    </div>
  </div>
</template>
