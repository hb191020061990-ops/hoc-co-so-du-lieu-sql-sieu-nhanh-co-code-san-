// Cấu hình trang web. Xem HUONG-DAN-TRIEN-KHAI.md để biết cách lấy các giá trị này.
//
// Để TRỐNG supabaseUrl và supabaseAnonKey thì web chạy ở chế độ "chỉ trên máy":
// mọi bài học đều mở, tiến độ lưu trong trình duyệt, không có đăng nhập.
// Điền vào thì bật tài khoản (email + Google), đồng bộ tiến độ và trang quản trị.

export const CONFIG = {
  siteName: 'EngStep',
  siteSlogan: 'Học tiếng Anh từng bước, từ A1 đến B2',

  supabaseUrl: '',      // ví dụ: 'https://abcdxyz.supabase.co'
  supabaseAnonKey: '',  // khóa "anon public" trong Supabase → Project Settings → API

  // Email được vào trang quản trị (phải trùng với bảng admins trong Supabase).
  adminEmails: [],

  // Khách chưa đăng nhập được học thử bao nhiêu chủ đề đầu tiên của mỗi cấp độ.
  // Chỉ áp dụng khi đã cấu hình Supabase.
  guestFreeTopics: 2,
};

export const hasBackend = () => Boolean(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);
