# Hướng dẫn đưa EngStep lên mạng

Làm lần lượt 3 phần. Phần 1 đủ để có web chạy được. Phần 2 và 3 bật tài khoản và đăng nhập Google.

| Phần | Kết quả | Thời gian | Chi phí |
|---|---|---|---|
| 1. Đưa web lên Vercel hoặc Netlify | Có địa chỉ web, ai cũng vào học được, tiến độ lưu trên máy từng người | 10 phút | Miễn phí |
| 2. Bật tài khoản bằng Supabase | Đăng ký/đăng nhập email, đồng bộ tiến độ, trang quản trị | 20 phút | Miễn phí (gói Free) |
| 3. Đăng nhập bằng Google | Nút "Tiếp tục với Google" | 15 phút | Miễn phí |

---

## Phần 1 – Đưa web lên mạng

### Cách A (khuyên dùng): Vercel kết nối GitHub

Mỗi lần bạn đẩy code lên GitHub, Vercel tự cập nhật web.

1. Vào <https://vercel.com>, chọn **Sign Up → Continue with GitHub**.
2. Bấm **Add New… → Project**, chọn kho `hoc-co-so-du-lieu-sql-sieu-nhanh-co-code-san-` → **Import**.
3. Ở màn hình cấu hình:
   - **Framework Preset**: `Other`
   - **Root Directory**: bấm *Edit* và chọn thư mục `hoc-tieng-anh`
   - Không cần *Build Command* hay *Output Directory*.
4. Bấm **Deploy**. Khoảng 1 phút sau bạn có địa chỉ dạng `https://ten-du-an.vercel.app`.
5. Vercel chỉ tự cập nhật theo nhánh chính (`main`). Nếu code mới nằm ở nhánh khác, hãy gộp nhánh đó vào `main` trước (tạo Pull Request rồi bấm Merge trên GitHub).

### Cách B (nhanh nhất, không cần GitHub): Netlify Drop

1. Vào <https://app.netlify.com/drop> và đăng ký tài khoản miễn phí.
2. Kéo **cả thư mục `hoc-tieng-anh`** thả vào trang.
3. Có ngay địa chỉ `https://ten-ngau-nhien.netlify.app`. Bạn đổi tên ở *Site configuration → Change site name*.
4. Mỗi lần sửa web, kéo thả lại thư mục vào mục *Deploys* của site.

### Cách C: GitHub Pages

1. Trên GitHub, mở kho → **Settings → Pages**.
2. *Source*: **Deploy from a branch**, *Branch*: `main` và thư mục `/ (root)` → **Save**.
3. Vài phút sau web có ở `https://<tên-github>.github.io/hoc-co-so-du-lieu-sql-sieu-nhanh-co-code-san-/hoc-tieng-anh/`.

### Tên miền riêng (không bắt buộc)

Mua tên miền (ví dụ `engstep.vn` hoặc `.com`) ở nhà cung cấp tên miền, rồi trong Vercel vào **Settings → Domains → Add** và làm theo hướng dẫn trỏ DNS. Vercel và Netlify cấp HTTPS miễn phí. Micro và chức năng cài như app chỉ hoạt động trên HTTPS.

### Kiểm tra sau khi đưa lên

- Mở web trên điện thoại bằng Chrome, chọn menu ⋮ → **Thêm vào màn hình chính** để cài như app.
- Tắt mạng rồi mở lại app: bài học vẫn hoạt động.
- Vào *Học → Nói* và cho phép dùng micro để thử chấm phát âm.

---

## Phần 2 – Bật tài khoản và đồng bộ (Supabase)

Supabase là dịch vụ cơ sở dữ liệu kèm hệ thống đăng nhập. Gói miễn phí đủ cho hàng chục nghìn người dùng.

### 2.1. Tạo dự án

1. Vào <https://supabase.com> → **Start your project** → đăng nhập bằng GitHub.
2. **New project**:
   - *Name*: `engstep`
   - *Database Password*: bấm *Generate* và lưu lại mật khẩu ở nơi an toàn
   - *Region*: **Southeast Asia (Singapore)** để nhanh nhất cho người dùng ở Việt Nam
3. Đợi khoảng 2 phút để dự án khởi tạo xong.

### 2.2. Tạo bảng dữ liệu

1. Mở tệp `supabase/schema.sql` trong thư mục dự án. Ở **dòng cuối**, thay `email-cua-ban@gmail.com` bằng email bạn sẽ dùng làm quản trị viên.
2. Trong Supabase, vào **SQL Editor → New query**, dán toàn bộ nội dung tệp và bấm **Run**. Kết quả báo *Success* là xong.

Tệp này tạo 3 bảng:

- `progress`: tiến độ học của mỗi người. Mỗi người chỉ đọc và ghi được dòng của chính mình.
- `word_overrides`: chỉnh sửa từ vựng từ trang quản trị. Ai cũng đọc được, chỉ quản trị viên được ghi.
- `admins`: danh sách email quản trị.

Ngoài ra còn hàm `admin_stats` để trang quản trị lấy số liệu thống kê.

### 2.3. Điền cấu hình vào web

1. Trong Supabase vào **Project Settings → API** (hoặc *Data API*), sao chép:
   - **Project URL**, dạng `https://abcdxyz.supabase.co`
   - **anon public key**, một chuỗi dài bắt đầu bằng `eyJ…`
2. Mở `js/config.js` và điền:

```js
supabaseUrl: 'https://abcdxyz.supabase.co',
supabaseAnonKey: 'eyJhbGciOi...',
adminEmails: ['email-cua-ban@gmail.com'],
guestFreeTopics: 2,   // số chủ đề khách được học thử ở mỗi cấp
```

> Khóa *anon public* được thiết kế để đặt công khai trong trang web; dữ liệu được bảo vệ bằng phân quyền (RLS) đã tạo ở bước 2.2. **Tuyệt đối không** dán khóa `service_role` vào web.

3. Trong `sw.js`, tăng `VERSION` (ví dụ `engstep-v2`), rồi đưa web lên lại (đẩy lên GitHub hoặc kéo thả lại vào Netlify).

### 2.4. Cấu hình địa chỉ đăng nhập

Trong Supabase, vào **Authentication → URL Configuration**:

- **Site URL**: địa chỉ web của bạn, ví dụ `https://engstep.vercel.app`
- **Redirect URLs**: bấm *Add URL* và thêm `https://engstep.vercel.app/**`. Nếu muốn thử trên máy, thêm cả `http://localhost:8000/**`.

### 2.5. Email xác nhận

- Mặc định Supabase gửi email xác nhận khi đăng ký (*Authentication → Providers → Email → Confirm email*).
- Máy chủ email có sẵn của Supabase chỉ gửi được **vài email mỗi giờ**, đủ để thử nghiệm. Khi mở cho nhiều người dùng, hãy cấu hình SMTP riêng ở **Project Settings → Authentication → SMTP Settings**. Brevo hoặc Resend có gói miễn phí vài trăm email/ngày.
- Có thể sửa nội dung email sang tiếng Việt ở **Authentication → Email Templates**.

### 2.6. Kiểm tra

1. Mở web, vào **Tài khoản → Đăng ký ngay**, tạo tài khoản bằng email quản trị.
2. Xác nhận email, đăng nhập. Biểu tượng 🛡️ xuất hiện ở góc trên.
3. Vào **Tài khoản → Trang quản trị**: thấy số người dùng và kho từ vựng là thành công.
4. Đăng nhập cùng tài khoản trên một thiết bị khác: tiến độ được đồng bộ.

---

## Phần 3 – Đăng nhập bằng Google

### 3.1. Tạo khóa OAuth trên Google Cloud

1. Vào <https://console.cloud.google.com> → tạo dự án mới (ví dụ `EngStep`).
2. **APIs & Services → OAuth consent screen**:
   - *User Type*: **External** → Create
   - Điền *App name* (EngStep), *User support email*, *Developer contact* → Save
   - Ở bước *Publishing status*, bấm **Publish app** để mọi người đăng nhập được, không chỉ tài khoản thử nghiệm.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - *Application type*: **Web application**
   - *Authorized JavaScript origins*: `https://engstep.vercel.app` (địa chỉ web của bạn)
   - *Authorized redirect URIs*: `https://abcdxyz.supabase.co/auth/v1/callback` (thay `abcdxyz` bằng mã dự án Supabase; Supabase hiển thị sẵn đường dẫn này ở bước 3.2)
4. Bấm **Create** và sao chép **Client ID** và **Client secret**.

### 3.2. Bật Google trong Supabase

1. **Authentication → Providers → Google** → bật **Enable**.
2. Dán *Client ID* và *Client secret* → **Save**.
3. Mở web, bấm **Tiếp tục với Google** để thử.

---

## Cập nhật web về sau

1. Sửa nội dung hoặc mã nguồn (xem README.md, mục *Sửa hoặc thêm nội dung*).
2. Tăng `VERSION` trong `sw.js`.
3. Đẩy lên GitHub (Vercel tự cập nhật) hoặc kéo thả lại vào Netlify.

Sửa từ vựng trên **trang quản trị** thì không cần làm ba bước trên: thay đổi có hiệu lực ngay.

## Gặp sự cố?

| Hiện tượng | Cách xử lý |
|---|---|
| Mở `index.html` trực tiếp thấy trang trắng | Phải mở qua máy chủ web (xem README) hoặc qua địa chỉ đã đưa lên mạng. |
| Sửa web rồi nhưng máy vẫn hiện bản cũ | Chưa tăng `VERSION` trong `sw.js`, hoặc cần tải lại trang 2 lần. |
| Đăng nhập Google báo `redirect_uri_mismatch` | Kiểm tra lại *Authorized redirect URIs* ở bước 3.1 phải đúng địa chỉ `…supabase.co/auth/v1/callback`. |
| Đăng ký xong không nhận được email | Xem thư mục Spam; máy chủ email mặc định của Supabase giới hạn số email mỗi giờ (xem 2.5). |
| Trang quản trị báo "không có quyền" | Email đăng nhập phải có trong cả `adminEmails` (config.js) và bảng `admins` (chạy lại dòng `insert` cuối tệp schema.sql). |
| Phần Nói không chấm được phát âm | Dùng Chrome hoặc Edge, cho phép micro, và cần có mạng. Trên iPhone, web chuyển sang chế độ ghi âm tự đánh giá nếu trình duyệt không hỗ trợ. |
