# EngStep – Web học tiếng Anh từng bước (A1 → B2)

Trang web học tiếng Anh miễn phí cho người Việt, đi từ người mới bắt đầu đến trung cao cấp.

## Tính năng

| Phần | Nội dung |
|---|---|
| **Từ vựng** | 3.000 từ thông dụng, 750 từ mỗi cấp A1 – A2 – B1 – B2, chia thành 64 chủ đề. Mỗi từ có phiên âm, loại từ, nghĩa, câu ví dụ kèm dịch, phát âm, emoji minh họa cho từ cụ thể. |
| **Cách học một bài** | Chọn chủ đề → chọn **15 / 25 / 50 câu** → thẻ từ → trắc nghiệm Anh→Việt → gõ từ tiếng Anh → nghe chọn từ. Câu sai được đưa xuống cuối và làm lại đến khi đúng hết. |
| **Nghe** | Nghe chọn từ, nghe chép từ, nghe chọn câu, chép chính tả cả câu; có nút nghe chậm. |
| **Nói** | Đọc to từ và câu, máy nhận diện giọng nói chấm điểm và tô màu từ đọc sai (Chrome/Edge). Trình duyệt không hỗ trợ thì chuyển sang ghi âm và tự đánh giá. |
| **Đọc** | 20 bài đọc theo cấp độ, chạm vào từ để nghe và xem nghĩa, có bản dịch và câu hỏi đọc hiểu kèm giải thích. |
| **Viết** | Dịch từ, điền từ vào câu, sắp xếp câu theo chủ đề; 12 đề viết đoạn văn, có đếm từ, danh sách tự kiểm tra và bài mẫu. |
| **Ôn tập ngắt quãng** | Từ trả lời đúng hết sẽ giãn lịch ôn (1 → 2 → 4 → 7 → 15 → 30 → 60 ngày); trả lời sai thì hạ mức để ôn sớm hơn. |
| **Chuỗi ngày học** | Không có tim hay điểm XP, chỉ giữ chuỗi ngày học và lịch 12 tuần. |
| **Tài khoản** | Email + mật khẩu và Google, đồng bộ tiến độ giữa các thiết bị. Khách chưa đăng ký học thử được 2 chủ đề đầu mỗi cấp. |
| **Quản trị** | Xem số người học, thêm/sửa/xóa từ vựng trực tiếp trên web, xuất JSON/Excel. |
| **Ứng dụng (PWA)** | Cài lên màn hình điện thoại như app, học được khi không có mạng. Giao diện sáng/tối, chỉnh cỡ chữ. |

> Trang web chạy được ngay mà **không cần máy chủ**: khi chưa cấu hình Supabase, mọi bài học đều mở và tiến độ lưu trong trình duyệt (có nút sao lưu/khôi phục). Khi điền cấu hình Supabase, web bật tài khoản, đồng bộ và trang quản trị.

## Chạy thử trên máy

Trang dùng JavaScript module nên cần mở qua một máy chủ web nhỏ (mở thẳng tệp `index.html` sẽ không chạy):

```bash
cd hoc-tieng-anh
python3 -m http.server 8000
# mở http://localhost:8000
```

## Đưa lên mạng

Xem **[HUONG-DAN-TRIEN-KHAI.md](HUONG-DAN-TRIEN-KHAI.md)**. Hướng dẫn đi từng bước, từ đưa web lên Netlify/Vercel đến bật đăng nhập Google.

## Cấu trúc thư mục

```
hoc-tieng-anh/
├── index.html              Trang chính
├── manifest.webmanifest    Thông tin để cài như app
├── sw.js                   Service worker (học offline)
├── css/app.css             Giao diện
├── js/
│   ├── config.js           ⚙️ Cấu hình: Supabase, email quản trị, số chủ đề học thử
│   ├── main.js             Điều hướng giữa các trang
│   ├── data.js             Nạp và tra cứu từ vựng
│   ├── store.js            Tiến độ, ôn tập ngắt quãng, chuỗi ngày, sao lưu
│   ├── sync.js             Đăng nhập & đồng bộ qua Supabase
│   ├── speech.js           Phát âm & nhận diện giọng nói
│   └── views/              Các màn hình (trang chủ, bài học, đọc, viết, tiến độ, tài khoản, quản trị)
├── data/
│   ├── words.json          Kho 3.000 từ (được tạo từ data-src)
│   └── skills.json         Bài đọc & đề viết (được tạo từ data-src/reading.py)
├── data-src/               Nguồn nội dung, dễ sửa bằng tay
│   ├── 1-a1.txt … 4-b2.txt Từ vựng theo cấp độ
│   └── reading.py          Bài đọc và đề viết
├── tools/build_data.py     Dựng lại data/words.json từ data-src
└── supabase/schema.sql     Tạo bảng và phân quyền trên Supabase
```

## Sửa hoặc thêm nội dung

**Cách 1 – trên web (khuyên dùng khi đã có Supabase):** đăng nhập bằng email quản trị → *Tài khoản* → *Trang quản trị* → tìm từ, bấm ✏️ để sửa hoặc *Thêm từ*. Thay đổi có hiệu lực ngay cho mọi người.

**Cách 2 – sửa tệp nguồn:** mỗi dòng trong `data-src/*.txt` là một từ:

```
từ|loại từ|nghĩa|emoji|câu ví dụ|dịch câu ví dụ|phiên âm (không bắt buộc)
apple|n|quả táo|🍎|An apple a day is good for you.|Mỗi ngày một quả táo rất tốt cho bạn.
```

Chủ đề bắt đầu bằng dòng `@ mã | Tên chủ đề | biểu tượng`. Loại từ dùng các mã: `n v adj adv prep pron conj det num int phr modal`.

Sau khi sửa, chạy:

```bash
python3 tools/build_data.py                          # giữ phiên âm cũ
python3 tools/build_data.py --cmudict cmudict.dict   # tạo phiên âm cho từ mới
```

Phiên âm tự động lấy từ [CMU Pronouncing Dictionary](https://github.com/cmusphinx/cmudict) (giọng Mỹ, giấy phép BSD). Tải tệp `cmudict.dict` về rồi truyền đường dẫn như trên, hoặc tự ghi phiên âm ở cột thứ 7. Công cụ sẽ báo từ bị trùng, sai định dạng và những câu ví dụ không chứa từ cần học (các từ đó sẽ không có trong bài điền từ).

Bài đọc và đề viết nằm trong `data-src/reading.py`; sửa xong chạy `python3 data-src/reading.py`.

**Mỗi lần cập nhật web**, tăng số phiên bản ở dòng `const VERSION = 'engstep-v1'` trong `sw.js` (ví dụ `engstep-v2`) để máy người học tải bản mới thay vì dùng bản đã lưu offline.

## Lưu ý về nội dung

Toàn bộ 3.000 từ, câu ví dụ, bản dịch, 20 bài đọc và 12 đề viết được soạn mới cho dự án này. Trước khi mở rộng công khai, bạn nên rà lại nghĩa và câu ví dụ, đặc biệt ở cấp B1–B2.
