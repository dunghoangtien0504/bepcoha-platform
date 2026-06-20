import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';

const routes: RouteRecordRaw[] = [
  { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue') },
  {
    path: '/',
    component: () => import('@/components/AppLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', redirect: '/dashboard' },
      { path: 'dashboard', name: 'dashboard', component: () => import('@/views/DashboardView.vue') },
      {
        path: 'work/projects',
        name: 'work-projects',
        component: () => import('@/views/work/projects/list.vue'),
      },
      {
        path: 'work/projects/new',
        name: 'work-project-create',
        component: () => import('@/views/work/projects/edit.vue'),
      },
      {
        path: 'work/projects/:id/edit',
        name: 'work-project-edit',
        component: () => import('@/views/work/projects/edit.vue'),
      },
      {
        path: 'work/projects/:id',
        name: 'work-project-detail',
        component: () => import('@/views/work/projects/detail.vue'),
      },
      {
        path: 'work/tasks',
        name: 'work-tasks',
        component: () => import('@/views/work/tasks/list.vue'),
      },
      {
        path: 'work/tasks/new',
        name: 'work-task-create',
        component: () => import('@/views/work/tasks/edit.vue'),
      },
      {
        path: 'work/tasks/:id/edit',
        name: 'work-task-edit',
        component: () => import('@/views/work/tasks/edit.vue'),
      },
      {
        path: 'tokens/allocations',
        name: 'token-allocations',
        component: () => import('@/views/tokens/AllocationsView.vue'),
      },
      {
        path: 'tokens/allocations/:userId',
        name: 'token-allocation-detail',
        component: () => import('@/views/tokens/AllocationDetailView.vue'),
      },
      {
        path: 'me/quota',
        name: 'my-quota',
        component: () => import('@/views/MyQuotaView.vue'),
      },
      { path: 'usage', name: 'usage', component: () => import('@/views/UsageView.vue') },
      {
        path: 'prompts/performance',
        name: 'prompt-performance',
        component: () => import('@/views/prompts/PerformanceView.vue'),
      },
      { path: 'prompts/list', name: 'prompt-list', component: () => import('@/views/prompts/ListView.vue') },
      { path: 'prompts/cache', name: 'prompt-cache', component: () => import('@/views/prompts/CachingView.vue') },
      { path: 'guide', name: 'guide', component: () => import('@/views/GuideView.vue') },
      {
        path: 'integrations',
        name: 'integrations',
        component: () => import('@/views/IntegrationsView.vue'),
      },
      { path: 'settings', name: 'settings', component: () => import('@/views/SettingsView.vue') },
      {
        path: 'admin/users',
        name: 'admin-users',
        component: () => import('@/views/admin/UsersView.vue'),
      },
      {
        path: 'admin/roles',
        name: 'admin-roles',
        component: () => import('@/views/admin/RolesView.vue'),
      },
      {
        path: 'admin/menus',
        name: 'admin-menus',
        component: () => import('@/views/admin/MenusView.vue'),
      },
    ],
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to) => {
  const auth = useAuthStore();
  if (to.meta.requiresAuth && !auth.isAuthenticated()) {
    return { name: 'login' };
  }
  if (to.name === 'login' && auth.isAuthenticated()) {
    return { name: 'dashboard' };
  }
  return true;
});
