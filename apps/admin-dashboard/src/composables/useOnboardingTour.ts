import { driver } from 'driver.js';

const CONTINUE_CONFIG = `{
  "models": [
    {
      "title": "Claude 3.5 Sonnet (STORO Gateway)",
      "provider": "openai",
      "model": "claude-3-5-sonnet",
      "apiBase": "http://localhost:3900/v1",
      "apiKey": "storo_live_your_internal_token_here",
      "requestOptions": { "headers": { "X-Task-ID": "TERO-102" } }
    }
  ]
}`;

/**
 * Bộ hướng dẫn 4 bước (driver.js) cấu hình hệ thống cho Developer mới đăng nhập lần đầu.
 */
export const useOnboardingTour = (onFinish: () => void): { start: () => void } => {
  const start = (): void => {
    const guide = driver({
      showProgress: true,
      nextBtnText: 'Tiếp tục',
      prevBtnText: 'Quay lại',
      doneBtnText: 'Hoàn tất',
      onDestroyed: onFinish,
      steps: [
        {
          element: '#tour-intro',
          popover: {
            title: 'Bước 1 — Giới thiệu nguyên lý',
            description:
              'Hệ thống AI Governance Gateway tự động điều phối, quản trị hạn ngạch token và bảo mật nguồn dữ liệu của bạn ngay tại môi trường mạng nội bộ local.',
          },
        },
        {
          element: '#tour-token',
          popover: {
            title: 'Bước 2 — Thẻ căn cước nội bộ',
            description:
              'Đây là Mã Token định danh cá nhân duy nhất (storo_live_...). Sao chép chuỗi này để cấu hình xác thực vào IDE trên máy của bạn.',
          },
        },
        {
          element: '#tour-ide',
          popover: {
            title: 'Bước 3 — Cấu hình trên VS Code',
            description: `Mở tệp cấu hình extension (Continue.dev) và trỏ apiBase về Gateway nội bộ:<pre class="mt-2 max-h-48 overflow-auto rounded bg-slate-900 p-2 text-xs text-emerald-300">${escapeHtml(
              CONTINUE_CONFIG,
            )}</pre>`,
          },
        },
        {
          element: '#tour-discipline',
          popover: {
            title: 'Bước 4 — Kỷ luật vận hành hằng ngày',
            description:
              'Trước khi chat/refactor cho một đầu việc mới, đổi giá trị X-Task-ID trùng mã thẻ công việc trên Jira (hoặc dùng Git Hook đi kèm để tự bóc tách tên branch). Nhấn Enter và hệ thống sẽ tự đo lường hiệu suất của bạn!',
          },
        },
      ],
    });
    guide.drive();
  };

  return { start };
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
