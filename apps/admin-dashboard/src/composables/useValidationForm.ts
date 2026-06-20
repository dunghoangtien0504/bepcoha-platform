import { reactive, watch } from 'vue';

/** Quy tắc kiểm tra cho 1 field. */
export interface FieldRule {
  /** Bắt buộc nhập (không được rỗng). */
  required?: boolean;
  /** Nhãn hiển thị trong thông báo lỗi. */
  label?: string;
  /** Validator tùy biến: trả về chuỗi lỗi nếu sai, hoặc null nếu hợp lệ. */
  validator?: (value: unknown, form: Record<string, unknown>) => string | null;
}

export type ValidationRules = Record<string, FieldRule>;

/** Giá trị được coi là "rỗng" (chưa nhập). 0 vẫn được coi là có giá trị. */
const isEmpty = (value: unknown): boolean =>
  value === null ||
  value === undefined ||
  value === '' ||
  (typeof value === 'number' && Number.isNaN(value));

/**
 * Composable validate form dùng chung cho mọi form tạo/sửa.
 * - validate(): kiểm tra toàn bộ, trả về true/false.
 * - errors: map field -> chuỗi lỗi (hoặc null).
 * - fieldClass(name): trả về class viền đỏ khi field đang lỗi.
 * - Tự gỡ viền đỏ (reactive) ngay khi field có giá trị hợp lệ.
 */
export function useValidationForm<T extends Record<string, unknown>>(
  form: T,
  rules: ValidationRules,
) {
  const errors = reactive<Record<string, string | null>>({});
  for (const key of Object.keys(rules)) errors[key] = null;

  const validateField = (name: string): boolean => {
    const rule = rules[name];
    if (!rule) return true;
    const value = (form as Record<string, unknown>)[name];
    if (rule.required && isEmpty(value)) {
      errors[name] = `${rule.label ?? 'Trường này'} là bắt buộc`;
      return false;
    }
    if (rule.validator) {
      const msg = rule.validator(value, form as Record<string, unknown>);
      if (msg) {
        errors[name] = msg;
        return false;
      }
    }
    errors[name] = null;
    return true;
  };

  const validate = (): boolean => {
    let ok = true;
    for (const name of Object.keys(rules)) {
      if (!validateField(name)) ok = false;
    }
    return ok;
  };

  const hasError = (name: string): boolean => Boolean(errors[name]);

  const fieldClass = (name: string): string =>
    errors[name] ? 'border-rose-500 ring-1 ring-rose-300 focus:border-rose-500' : '';

  const clearErrors = (): void => {
    for (const key of Object.keys(errors)) errors[key] = null;
  };

  // Reactive: khi field đang lỗi mà người dùng nhập giá trị -> gỡ viền đỏ ngay.
  watch(
    () => Object.keys(rules).map((key) => (form as Record<string, unknown>)[key]),
    () => {
      for (const name of Object.keys(rules)) {
        if (errors[name] && !isEmpty((form as Record<string, unknown>)[name])) {
          errors[name] = null;
        }
      }
    },
    { deep: true },
  );

  return { errors, validate, validateField, hasError, fieldClass, clearErrors };
}
