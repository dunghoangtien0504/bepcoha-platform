export const formatVnd = (value: number): string =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);

export const formatUsd = (value: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

export const formatNumber = (value: number): string =>
  new Intl.NumberFormat('vi-VN').format(value);

export const formatDateTime = (value: string | null): string =>
  value ? new Date(value).toLocaleString('vi-VN') : '—';
