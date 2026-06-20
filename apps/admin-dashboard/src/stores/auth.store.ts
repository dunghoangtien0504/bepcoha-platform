import { defineStore } from 'pinia';
import { ref } from 'vue';
import { authApi, menusApi } from '@/api/endpoints';
import { getAuthToken, setAuthToken } from '@/api/http';
import type { AuthUser, MenuNode } from '@/api/types';

const USER_KEY = 'aigg_user';
const ONBOARDED_KEY = 'aigg_onboarded';

const loadUser = (): AuthUser | null => {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as AuthUser) : null;
};

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(loadUser());
  const token = ref<string | null>(getAuthToken());
  const menus = ref<MenuNode[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const isAuthenticated = (): boolean => Boolean(token.value);

  const hasPermission = (code: string): boolean => {
    if (!user.value) return false;
    return user.value.permissions.includes('*') || user.value.permissions.includes(code);
  };

  const persist = (next: AuthUser): void => {
    user.value = next;
    localStorage.setItem(USER_KEY, JSON.stringify(next));
  };

  const loadMenus = async (): Promise<void> => {
    try {
      menus.value = await menusApi.my();
    } catch {
      menus.value = [];
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    loading.value = true;
    error.value = null;
    try {
      const result = await authApi.login(email, password);
      token.value = result.accessToken;
      setAuthToken(result.accessToken);
      persist(result.user);
      await loadMenus();
      return true;
    } catch {
      error.value = 'Đăng nhập thất bại. Kiểm tra lại email/mật khẩu.';
      return false;
    } finally {
      loading.value = false;
    }
  };

  // Khôi phục phiên: xác thực lại token và nạp menu khi refresh trang.
  const hydrate = async (): Promise<void> => {
    if (!token.value) return;
    try {
      persist(await authApi.me());
      await loadMenus();
    } catch {
      logout();
    }
  };

  const logout = (): void => {
    token.value = null;
    user.value = null;
    menus.value = [];
    setAuthToken(null);
    localStorage.removeItem(USER_KEY);
  };

  const needsOnboarding = (): boolean => localStorage.getItem(ONBOARDED_KEY) !== 'true';
  const markOnboarded = (): void => localStorage.setItem(ONBOARDED_KEY, 'true');

  return {
    user,
    token,
    menus,
    loading,
    error,
    isAuthenticated,
    hasPermission,
    login,
    hydrate,
    logout,
    loadMenus,
    needsOnboarding,
    markOnboarded,
  };
});
