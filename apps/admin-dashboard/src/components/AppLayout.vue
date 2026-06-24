<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { MenuNode } from '@/api/types';
import { useAuthStore } from '@/stores/auth.store';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const panelOpen = ref(true);
const activeRootId = ref<string | null>(null);

const iconLetter = (menu: MenuNode): string =>
  (menu.iconValue ?? menu.name).charAt(0).toUpperCase();

// Tìm menu gốc (rail) chứa đường dẫn hiện tại để tự kích hoạt panel tương ứng.
const matchRoot = (path: string): MenuNode | null => {
  for (const root of auth.menus) {
    if (root.routePath && path.startsWith(root.routePath)) return root;
    if (root.children?.some((c) => c.routePath && path.startsWith(c.routePath))) return root;
  }
  return null;
};

watch(
  () => [route.path, auth.menus.length],
  () => {
    const matched = matchRoot(route.path);
    if (matched) activeRootId.value = matched.id;
    else if (!activeRootId.value && auth.menus.length) activeRootId.value = auth.menus[0].id;
  },
  { immediate: true },
);

const activeRoot = computed<MenuNode | null>(
  () => auth.menus.find((m) => m.id === activeRootId.value) ?? null,
);

// Mục hiển thị trong panel: các con của menu gốc, hoặc chính nó nếu là menu lá.
const panelItems = computed<MenuNode[]>(() => {
  const root = activeRoot.value;
  if (!root) return [];
  return root.children.length ? root.children : [root];
});

const pageTitle = computed<string>(() => {
  for (const root of auth.menus) {
    for (const child of root.children) {
      if (child.routePath && route.path.startsWith(child.routePath)) return child.name;
    }
    if (root.routePath && route.path.startsWith(root.routePath)) return root.name;
  }
  return 'Bảng điều khiển';
});

const selectRoot = (menu: MenuNode): void => {
  activeRootId.value = menu.id;
  panelOpen.value = true;
  if (!menu.children.length && menu.routePath) {
    void router.push(menu.routePath);
  }
};

const handleLogout = (): void => {
  auth.logout();
  void router.push({ name: 'login' });
};
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-slate-100">
    <!-- Aside rail: menu gốc/nhóm dạng icon, cố định -->
    <aside class="flex w-16 flex-shrink-0 flex-col items-center gap-1 rail-bg py-3 text-slate-300">
      <div class="mb-2 flex h-10 w-10 items-center justify-center rounded-lg rail-bg-brand text-sm font-bold text-white" title="HACO-food-OS">
        HC
      </div>
      <button
        v-for="menu in auth.menus"
        :key="menu.id"
        class="group relative flex h-11 w-11 items-center justify-center rounded-lg transition hover:rail-item-bg"
        :class="{ 'rail-item-bg text-white': menu.id === activeRootId }"
        :data-tip="menu.name"
        @click="selectRoot(menu)"
      >
        <span v-if="menu.iconType === 'material_symbol'" class="material-symbols-rounded text-[22px]">
          {{ menu.iconValue }}
        </span>
        <span v-else class="flex h-6 w-6 items-center justify-center rounded bg-slate-700 text-xs">
          {{ iconLetter(menu) }}
        </span>
        <!-- data-tip tooltip -->
        <span
          class="pointer-events-none absolute left-full top-1/2 z-20 ml-2 -translate-y-1/2 whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-xs text-white opacity-0 shadow-lg transition group-hover:opacity-100"
        >
          {{ menu.name }}
        </span>
      </button>
    </aside>

    <!-- Panel: menu con của nhóm đang chọn, cố định + cuộn dọc -->
    <div
      v-show="panelOpen"
      class="flex w-60 flex-shrink-0 flex-col border-r border-slate-200 bg-white"
    >
      <div class="border-b border-slate-100 px-4 py-4">
        <p class="text-xs font-semibold uppercase tracking-wider text-slate-400">Khu vực</p>
        <p class="text-base font-bold text-slate-900">{{ activeRoot?.name ?? '—' }}</p>
      </div>
      <nav class="flex-1 space-y-1 overflow-y-auto p-3">
        <RouterLink
          v-for="item in panelItems"
          :key="item.id"
          :to="item.routePath ?? '/'"
          class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          active-class="bg-brand text-white hover:!bg-brand"
        >
          <span v-if="item.iconType === 'material_symbol'" class="material-symbols-rounded text-[20px]">
            {{ item.iconValue }}
          </span>
          <span v-else class="flex h-5 w-5 items-center justify-center rounded bg-slate-200 text-xs text-slate-600">
            {{ iconLetter(item) }}
          </span>
          <span>{{ item.name }}</span>
        </RouterLink>
      </nav>
    </div>

    <!-- Main: topbar cố định + content cuộn dọc & ngang -->
    <div class="flex flex-1 flex-col overflow-hidden">
      <header class="flex h-14 flex-shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4">
        <button
          class="toggle-panel-btn flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
          @click="panelOpen = !panelOpen"
        >
          <span class="material-symbols-rounded text-[22px]">{{ panelOpen ? 'menu_open' : 'menu' }}</span>
        </button>
        <h1 class="topbar-title text-lg font-semibold text-slate-900">{{ pageTitle }}</h1>
        <div class="topbar-spacer flex-1"></div>
        <button
          class="guide-btn flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-brand/10 hover:text-brand"
          title="Hướng dẫn đo lường AI Usage"
          @click="router.push({ name: 'guide' })"
        >
          <span class="material-symbols-rounded text-[22px]">menu_book</span>
        </button>
        <div class="notif-wrap flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
          <span class="material-symbols-rounded text-[22px]">notifications</span>
        </div>
        <div class="topbar-user flex items-center gap-3 border-l border-slate-200 pl-3">
          <div class="text-right">
            <p class="text-sm font-medium text-slate-900">{{ auth.user?.displayName }}</p>
            <p class="text-xs text-slate-500">{{ auth.user?.role?.name ?? '—' }}</p>
          </div>
          <button
            class="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600"
            title="Đăng xuất"
            @click="handleLogout"
          >
            <span class="material-symbols-rounded text-[22px]">logout</span>
          </button>
        </div>
      </header>

      <div class="content flex-1 overflow-auto">
        <RouterView />
      </div>
    </div>
  </div>
</template>
