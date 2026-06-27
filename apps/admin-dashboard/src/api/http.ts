import axios, { AxiosInstance } from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3900';

export const http: AxiosInstance = axios.create({ baseURL, timeout: 20000 });

const TOKEN_KEY = 'aigg_access_token';

export const setAuthToken = (token: string | null): void => {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
};

export const getAuthToken = (): string | null => localStorage.getItem(TOKEN_KEY);

// Tự động đính kèm JWT vào mọi request quản trị.
http.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Đẩy về trang đăng nhập khi phiên hết hạn.
http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !window.location.pathname.includes('/login')) {
      setAuthToken(null);
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);
