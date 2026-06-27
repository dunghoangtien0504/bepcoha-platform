import Swal from 'sweetalert2';

/** Toast nhỏ góc trên–phải, tự ẩn. Dùng cho thông báo thành công/thất bại. */
const toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 2600,
  timerProgressBar: true,
  didOpen: (el) => {
    el.addEventListener('mouseenter', Swal.stopTimer);
    el.addEventListener('mouseleave', Swal.resumeTimer);
  },
});

export const toastSuccess = (title: string): void => {
  void toast.fire({ icon: 'success', title });
};

export const toastError = (title: string): void => {
  void toast.fire({ icon: 'error', title });
};

export const toastWarning = (title: string): void => {
  void toast.fire({ icon: 'warning', title });
};

export interface ConfirmOptions {
  title?: string;
  text?: string;
  confirmText?: string;
  cancelText?: string;
}

/** Hộp xác nhận trước khi submit/ xử lý dữ liệu. Trả về true nếu người dùng đồng ý. */
export const confirmSubmit = async (options?: ConfirmOptions): Promise<boolean> => {
  const result = await Swal.fire({
    icon: 'question',
    title: options?.title ?? 'Xác nhận',
    text: options?.text ?? 'Bạn có chắc muốn lưu thay đổi này?',
    showCancelButton: true,
    confirmButtonText: options?.confirmText ?? 'Đồng ý',
    cancelButtonText: options?.cancelText ?? 'Hủy',
    confirmButtonColor: '#2563eb',
    cancelButtonColor: '#64748b',
    reverseButtons: true,
  });
  return result.isConfirmed;
};

/** Hộp xác nhận xóa (màu đỏ, cảnh báo không thể hoàn tác). */
export const confirmDelete = async (text?: string): Promise<boolean> => {
  const result = await Swal.fire({
    icon: 'warning',
    title: 'Xác nhận xóa',
    text: text ?? 'Hành động này không thể hoàn tác.',
    showCancelButton: true,
    confirmButtonText: 'Xóa',
    cancelButtonText: 'Hủy',
    confirmButtonColor: '#e11d48',
    cancelButtonColor: '#64748b',
    reverseButtons: true,
  });
  return result.isConfirmed;
};
