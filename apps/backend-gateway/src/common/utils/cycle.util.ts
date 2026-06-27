export type QuotaCycle = 'DAILY' | 'WEEKLY' | 'MONTHLY';

const pad = (value: number): string => value.toString().padStart(2, '0');

export const formatDateOnly = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const formatMonth = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

/**
 * ISO-8601 week number để khóa chu kỳ tuần ổn định qua các năm.
 */
export const getIsoWeek = (date: Date): string => {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNumber + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((target.getTime() - firstThursday.getTime()) / 86400000 -
        3 +
        ((firstThursday.getUTCDay() + 6) % 7)) /
        7,
    );
  return `${target.getUTCFullYear()}-W${pad(week)}`;
};

export const buildCycleKey = (userId: string, cycle: QuotaCycle, at: Date): string => {
  switch (cycle) {
    case 'DAILY':
      return `quota:${userId}:daily:${formatDateOnly(at)}`;
    case 'WEEKLY':
      return `quota:${userId}:weekly:${getIsoWeek(at)}`;
    case 'MONTHLY':
      return `quota:${userId}:monthly:${formatMonth(at)}`;
  }
};

export const buildTaskKey = (userId: string, taskId: string): string =>
  `quota:${userId}:task:${taskId}`;

export const CYCLE_TTL_SECONDS: Record<QuotaCycle, number> = {
  DAILY: 60 * 60 * 48,
  WEEKLY: 60 * 60 * 24 * 9,
  MONTHLY: 60 * 60 * 24 * 33,
};
