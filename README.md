# BỘ CÔNG CỤ THÊM CHỮ KÝ BÁO CÁO HỌC SINH (CHUẨN NĐ 30/2020/NĐ-CP)
### Chèn Địa Danh, Ngày Tháng, Chức Vụ, Chữ Ký, Họ Tên & Tự Động Tách Bảng Khi Không Đủ Chỗ

Ứng dụng web HTML/JavaScript trực quan giúp bạn thêm khối chữ ký và ngày tháng chuẩn thể thức văn bản Việt Nam vào trang cuối của các báo cáo nhận xét học sinh định dạng PDF. Đặc biệt, công cụ tích hợp giải thuật **phân tích không gian & tách hàng thông minh (Smart Table Split)**: nếu trang cuối chứa quá nhiều học sinh không đủ chỗ cho phần chữ ký, công cụ sẽ tự động tách một số hàng học sinh sang trang mới, lặp lại tiêu đề bảng, đánh số trang liên tục và chèn chữ ký đẹp mắt.

---

## 🌟 TÍNH NĂNG NỔI BẬT

1. **Chuẩn Thể Thức Văn Bản Việt Nam (Nghị định 30/2020/NĐ-CP)**:
   - Phông chữ chuẩn: **Times New Roman** (nhúng sẵn bản quyền vector, hỗ trợ 100% đầy đủ dấu tiếng Việt Unicode).
   - Khối chữ ký nằm ở nửa bên phải trang giấy (Right-aligned block), các dòng trong khối được canh giữa so với nhau.
   - **Địa danh, ngày tháng**: Chữ in thường nghiêng (*TP. Hồ Chí Minh, Thứ Sáu, ngày 09 tháng 10 năm 2026*).
   - **Chức danh / Tiêu đề**: Chữ in thường hoặc in hoa đứng đậm (**Giám đốc Chương trình**).
   - **Chữ ký**: Khoảng trống chừa sẵn 25-35mm (75pt) để ký tay và đóng dấu, hoặc chèn file ảnh con dấu/chữ ký điện tử dạng PNG trong suốt.
   - **Họ và tên người ký**: Chữ đứng đậm (**Võ Ngọc Thu**).

2. **Phân Tích Không Gian & Tự Động Tách Hàng Thông Minh (Smart Table Split)**:
   - Tự động quét và phát hiện số lượng học sinh, số thứ tự (STT), tên học sinh và vị trí kết thúc của bảng trên trang cuối.
   - **Trường hợp đủ chỗ**: Đặt khối chữ ký ngay dưới chân bảng trên trang cuối hiện tại.
   - **Trường hợp không đủ chỗ (quá tải hàng)**: Hệ thống cảnh báo màu vàng và tự động kích hoạt tính năng tách bảng:
     - Tự động chuyển các học sinh cuối sang trang mới (ví dụ chuyển từ học sinh số 20 hoặc 22 sang trang mới).
     - Lặp lại tiêu đề bảng (`No/STT`, `Name of Student`, `Comment regarding ability`, `Comment regarding behaviour`) ở đầu trang mới giống hệt các trang trước.
     - Đóng khung chân bảng ở cả trang cũ và trang mới bằng đường viền kẻ sắc nét.
     - Tự động đánh số trang liên tục (ví dụ trang 5) ở chân trang.
     - Cho phép người dùng tùy chọn điểm ngắt bằng dropdown danh sách học sinh hoặc thanh trượt điều chỉnh vị trí đường cắt đỏ trực quan.

3. **Xem Trước Trực Quan Thời Gian Thực (Live Interactive Preview)**:
   - Xem trước toàn bộ trang PDF trên Canvas độ phân giải Retina sắc nét.
   - Chuyển đổi giữa các trang (Trang 1, 2, 3, 4, và Trang 5 mới tách).
   - Thấy ngay đường cắt ngắt bảng và khối chữ ký ngay khi vừa nhập chữ hoặc kéo thanh trượt.

4. **100% Vector Crisp – Không Giảm Chất Lượng**:
   - Sử dụng giải pháp Native PDF Clipping bằng `pdf-lib` và `fontkit`.
   - Giữ nguyên 100% độ nét vector gốc của PDF nguồn, các chữ và đường nét không bị mờ hay vỡ hình.

5. **Chạy 100% Offline – Không Cần Cài Đặt Phức Tạp**:
   - Đã tích hợp sẵn toàn bộ thư viện và phông chữ Base64 trong thư mục.

---

## 🚀 HƯỚNG DẪN KHỞI ĐỘNG VÀ SỬ DỤNG

### Cách 1: Chạy bằng file Start_Tool.bat (Khuyến nghị)
1. Mở thư mục:
   `C:\Users\dulv\.gemini\antigravity\scratch\pdf-signature-tool`
2. Bấm đúp chuột vào file **`Start_Tool.bat`**.
3. Trình duyệt web mặc định (Chrome/Edge) sẽ tự động mở trang web công cụ tại địa chỉ `http://localhost:8080/index.html`.

### Cách 2: Mở trực tiếp (Không cần web server)
1. Bấm đúp chuột vào file **`Open_Directly.bat`** hoặc bấm đúp vào **`index.html`**.
2. Công cụ sẽ mở trực tiếp trên trình duyệt web.

---

## 📖 CÁC BƯỚC THAO TÁC TRÊN GIAO DIỆN

1. **Bước 1: Tải tệp PDF**
   - Kéo thả tệp PDF cần ký vào khung hoặc bấm để duyệt file từ máy tính.
   - Để trải nghiệm ngay, bạn có thể bấm vào nút **"File mẫu (4 trang - Cần tách)"** hoặc **"File mẫu (5 trang - Đủ chỗ)"**.

2. **Bước 2: Thiết lập thông tin ký**
   - **Địa danh & Ngày tháng**: Nhập tùy ý hoặc bấm nút nhanh:
     - `📅 Hôm nay (Thứ, ngày...)`: Tạo tự động theo thứ và ngày hiện tại.
     - `📅 Hôm nay (ngày...)`: Tạo theo ngày hiện tại.
     - `📅 Cuối tháng này`: Tạo theo ngày cuối cùng của tháng.
   - **Chức danh**: Nhập chức vụ (ví dụ: `Giám đốc Chương trình`, `Hiệu trưởng`, `Trưởng bộ môn`...)
   - **Khoảng trống ký tên**: Kéo thanh trượt để tăng/giảm độ rộng chừa chỗ cho chữ ký tay (mặc định 75pt).
   - **Họ và tên người ký**: Nhập họ tên đầy đủ (ví dụ: `Võ Ngọc Thu`).
   - *(Tùy chọn)*: Tải lên hình ảnh con dấu/chữ ký dạng PNG nếu muốn chèn sẵn.

3. **Bước 3: Phân tích & Tách hàng**
   - Quan sát ô trạng thái phân tích:
     - Nếu trang cuối không đủ chỗ: Hệ thống sẽ tự động bật công tắc **"Tách hàng sang trang mới"**.
     - Bạn có thể chọn học sinh bắt đầu tách tại mục **"Điểm ngắt: Chuyển từ học sinh"** (ví dụ chuyển từ học sinh số 20 hoặc số 22).
     - Điều chỉnh thanh trượt **"Vi chỉnh đường cắt bảng"** để căn đường kẻ đứt nét màu đỏ trùng khớp với chân hàng mong muốn.

4. **Bước 4: Xem trước & Tải xuống**
   - Bấm vào các thẻ `Trang 1`, `Trang 2`... `Trang mới` ở thanh công cụ bên phải để xem trước toàn diện kết quả.
   - Bấm nút **"💾 TẢI XUỐNG PDF ĐÃ KÝ"** để nhận ngay tệp PDF thành phẩm hoàn chỉnh!

---

## 📁 CẤU TRÚC THƯ MỤC

```
pdf-signature-tool/
├── index.html                   # Giao diện chính của công cụ
├── style.css                    # Tệp định dạng giao diện chuẩn
├── app.js                       # Logic xử lý PDF, nhận diện bảng và tạo tài liệu
├── Start_Tool.bat               # File chạy ứng dụng tự động bằng web server nội bộ
├── Open_Directly.bat            # File mở trực tiếp index.html trên trình duyệt
├── README.md                    # Hướng dẫn chi tiết
├── fonts/
│   ├── fonts.js                 # Font Times New Roman mã hóa Base64 dùng offline
│   ├── times.ttf                # Times New Roman Regular
│   ├── timesbd.ttf              # Times New Roman Bold
│   └── timesi.ttf               # Times New Roman Italic
├── libs/
│   ├── pdf-lib.min.js           # Thư viện xử lý PDF vector
│   ├── fontkit.umd.min.js       # Thư viện nhúng font TrueType Unicode
│   ├── pdf.umd.min.js           # Thư viện đọc và trích xuất PDF (PDF.js)
│   └── pdf.worker.umd.min.js    # Worker xử lý song song của PDF.js
├── sample_report_page4_full.pdf # Tệp PDF mẫu 4 trang (trang cuối nhiều học sinh cần tách)
└── sample_report_page5_spacious.pdf # Tệp PDF mẫu 5 trang gốc
```
