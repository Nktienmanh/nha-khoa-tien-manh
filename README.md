# 🦷 Nha Khoa Tiến Mạnh — Phần mềm quản lý phòng khám nha khoa

Phần mềm quản lý phòng khám nha khoa chạy trên trình duyệt (máy tính, điện thoại, máy tính bảng), tiếng Việt hoàn toàn.

## Chức năng

| Phân hệ | Nội dung |
|---|---|
| **Trang chủ** | Tổng doanh thu, thực thu, chi phí, công nợ; lịch hẹn hôm nay; biểu đồ thu–chi 6 tháng; việc cần làm (chăm sóc đến hạn, sinh nhật, vật tư sắp hết, labo chờ trả) |
| **Quản lý khách hàng** | Hồ sơ (mã KH tự động), tiền sử bệnh, nguồn khách, nhãn, công nợ; tìm kiếm không dấu, lọc, xuất Excel |
| **Hồ sơ điều trị** | Thông tin cơ bản · **Khám & Điều trị** (phiếu khám, chỉ định, chẩn đoán, **sơ đồ răng** người lớn/răng sữa, kế hoạch điều trị có giảm giá & khách đồng ý, tiến trình điều trị) · Đơn thuốc (in) · Thư viện ảnh · Xưởng/Labo · Lịch hẹn · Thanh toán (in phiếu thu, hoàn tiền) · Chăm sóc · Lịch sử thao tác |
| **Chăm sóc khách hàng** | Lịch chăm sóc, nhắc lịch hẹn, nhắc uống thuốc, hỏi thăm sau điều trị, chúc mừng sinh nhật |
| **Lịch hẹn** | Xem theo ngày / tuần / tháng, lọc bác sĩ & chi nhánh, cảnh báo trùng lịch, tạo nhanh khách mới; danh sách lịch hẹn đổi trạng thái nhanh |
| **Nhân sự** | Bác sĩ, trợ thủ, lễ tân…; lương cơ bản, % hoa hồng |
| **Thu/chi** | Phiếu thu/chi tự đánh số (PT/PC), danh mục, phương thức thanh toán, xuất Excel, in phiếu |
| **Hoa hồng** | Tự tính theo doanh thu điều trị của bác sĩ/trợ thủ, xem chi tiết, tạo phiếu chi trả |
| **Kho** | Vật tư & tồn kho (cảnh báo tồn tối thiểu), phiếu nhập/xuất, đơn xưởng/labo |
| **Báo cáo** | Doanh thu – thu chi theo ngày/tháng, theo thủ thuật, theo bác sĩ, khách hàng (nguồn, giới tính, độ tuổi), công nợ, lịch hẹn |
| **Chi nhánh** | Nhiều cơ sở, doanh thu từng cơ sở |
| **Cài đặt** | Thông tin phòng khám, thủ thuật & bảng giá, tình trạng răng, thuốc, nguồn khách, danh mục thu chi, tài khoản & phân quyền, sao lưu/khôi phục |

## Lưu trữ dữ liệu — 2 chế độ

Phần mềm tự chọn chế độ theo file `public/firebase-config.js`:

| | **Firebase (khuyên dùng)** | **Máy chủ nội bộ** |
|---|---|---|
| Khi nào | `firebase-config.js` đã điền cấu hình | `firebase-config.js` để trống |
| Dữ liệu lưu ở | Cloud Firestore trên tài khoản Google của phòng khám | Thư mục `data/` trên máy tính chạy phần mềm |
| Truy cập | Mọi nơi có Internet, địa chỉ `https://<du-an>.web.app` | Các máy cùng mạng LAN của phòng khám |
| Đăng nhập | Email + mật khẩu (Firebase Authentication) | Tên đăng nhập + mật khẩu |
| Hướng dẫn | 👉 [HUONG-DAN-FIREBASE.md](HUONG-DAN-FIREBASE.md) | Xem bên dưới |

### Chạy chế độ máy chủ nội bộ

1. Cài [Node.js](https://nodejs.org) (bản LTS, từ 18 trở lên). Không cần cài thêm thư viện nào.
2. Nhấp đúp **`start.bat`** (hoặc chạy `node server.js`).
3. Mở <http://localhost:3000>. Đăng nhập lần đầu: **`admin` / `admin123`** — phần mềm sẽ bắt đổi mật khẩu ngay.
4. Các máy khác trong phòng khám mở địa chỉ LAN hiện trong cửa sổ máy chủ (vd. `http://192.168.1.10:3000`).

Dữ liệu nằm trong `data/db.json`, ảnh trong `data/uploads/`, bản sao lưu tự động (khi khởi động và mỗi 6 giờ) trong `data/backups/`. Thư mục `data/` **không** được đưa lên GitHub.

## Cấu trúc mã nguồn

```
nha-khoa-tien-manh/
├── server.js                 # Máy chủ nội bộ (Node.js thuần, không phụ thuộc thư viện)
├── start.bat                 # Chạy nhanh trên Windows
├── firebase.json             # Cấu hình Firebase Hosting + Firestore
├── firestore.rules           # Quy tắc bảo mật dữ liệu trên Firestore
├── .firebaserc               # Mã dự án Firebase
├── HUONG-DAN-FIREBASE.md     # Hướng dẫn đưa lên Firebase
└── public/                   # Giao diện (được đưa lên Firebase Hosting)
    ├── index.html
    ├── firebase-config.js    # ← dán cấu hình Firebase vào đây
    ├── css/style.css
    └── js/
        ├── core.js           # API, tiện ích, form, bảng
        ├── firebase-adapter.js  # Lưu trữ trên Firebase Auth + Firestore (realtime)
        ├── seed.js           # Danh mục mẫu khi khởi tạo
        ├── main.js           # Đăng nhập, menu, điều hướng
        └── pages/            # Từng phân hệ chức năng
```
