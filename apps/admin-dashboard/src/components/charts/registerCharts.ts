import {
  BarElement,
  CategoryScale,
  Chart,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';

let registered = false;

/** Đăng ký một lần các thành phần Chart.js cần dùng (tree-shaking friendly). */
export const ensureChartsRegistered = (): void => {
  if (registered) return;
  Chart.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
  );
  registered = true;
};
