import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router';
import { useAuthStore } from './stores/auth.store';
import './assets/main.css';

async function bootstrap(): Promise<void> {
  const app = createApp(App);
  app.use(createPinia());

  // Khôi phục phiên (xác thực lại token + nạp menu) trước khi mount để guard có dữ liệu.
  const auth = useAuthStore();
  await auth.hydrate();

  app.use(router);
  app.mount('#app');
}

void bootstrap();
