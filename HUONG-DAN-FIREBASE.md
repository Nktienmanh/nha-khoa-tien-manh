# Hướng dẫn đưa Nha Khoa Tiến Mạnh lên Firebase

Khi dùng Firebase, toàn bộ dữ liệu (khách hàng, hồ sơ điều trị, lịch hẹn, thu chi, ảnh…) được lưu trên **Cloud Firestore** thuộc tài khoản Google (Gmail) của chủ phòng khám. Phần mềm chạy online tại địa chỉ dạng `https://<ten-du-an>.web.app`, mở được trên máy tính, điện thoại, máy tính bảng, và nhiều máy dùng cùng lúc thì dữ liệu tự đồng bộ ngay.

> Gói **Spark (miễn phí)** của Firebase là đủ cho một phòng khám vừa và nhỏ. Không cần nhập thẻ thanh toán.

---

## Phần A — Chủ phòng khám tạo dự án Firebase (khoảng 10 phút)

Làm trên trình duyệt, đăng nhập bằng **Gmail của chủ phòng khám**.

1. **Tạo dự án**
   - Vào <https://console.firebase.google.com> → **Create a project** (Tạo dự án).
   - Đặt tên, ví dụ `nha-khoa-tien-manh` → Continue.
   - Google Analytics: có thể **tắt** → **Create project**.

2. **Bật đăng nhập bằng Email/Mật khẩu**
   - Menu trái **Build › Authentication** → **Get started**.
   - Tab **Sign-in method** → chọn **Email/Password** → bật **Enable** (dòng đầu tiên) → **Save**.

3. **Tạo tài khoản quản trị đầu tiên**
   - Vẫn trong Authentication → tab **Users** → **Add user**.
   - Nhập email + mật khẩu (tối thiểu 6 ký tự) của người quản lý phòng khám → **Add user**.
   - ⚠️ Tài khoản này sẽ là **quản trị viên** khi đăng nhập phần mềm lần đầu.

4. **Tạo cơ sở dữ liệu Firestore**
   - Menu trái **Build › Firestore Database** → **Create database**.
   - Location: chọn **asia-southeast1 (Singapore)** (gần Việt Nam, nhanh nhất). Lưu ý: không đổi được sau này.
   - Chọn **Start in production mode** → **Create**.

5. **Lấy cấu hình Web App**
   - Bấm biểu tượng ⚙️ cạnh *Project Overview* → **Project settings**.
   - Kéo xuống mục **Your apps** → bấm biểu tượng **`</>`** (Web).
   - App nickname: `Nha Khoa Web` → **Register app**.
   - Màn hình hiện đoạn mã `const firebaseConfig = { ... }` → **sao chép toàn bộ** đoạn này.

6. **Gửi cho người triển khai** đoạn `firebaseConfig` ở bước 5 (đoạn này không phải mật khẩu, có thể gửi qua Zalo/email).
   - Đồng thời **thêm người triển khai làm thành viên dự án** nếu người đó sẽ đưa phần mềm lên giúp: ⚙️ **Project settings › Users and permissions › Add member** → nhập Gmail người triển khai → vai trò **Editor**.
   - Nếu chủ phòng khám tự đưa lên thì làm tiếp Phần B.

---

## Phần B — Cài cấu hình và đưa phần mềm lên mạng

Thực hiện trên máy tính Windows đã có mã nguồn phần mềm.

### B1. Điền cấu hình

1. Mở file `public/firebase-config.js`, thay các giá trị trống bằng giá trị trong `firebaseConfig`:

   ```js
   window.FIREBASE_CONFIG = {
     apiKey: "AIza....",
     authDomain: "nha-khoa-tien-manh.firebaseapp.com",
     projectId: "nha-khoa-tien-manh",
     storageBucket: "nha-khoa-tien-manh.firebasestorage.app",
     messagingSenderId: "1234567890",
     appId: "1:1234567890:web:abcdef"
   };
   ```

2. Mở file `.firebaserc`, thay `DIEN-PROJECT-ID-CUA-PHONG-KHAM` bằng **projectId** (ví dụ `nha-khoa-tien-manh`).

### B2. Cài công cụ Firebase (chỉ làm 1 lần)

1. Cài **Node.js** bản LTS tại <https://nodejs.org> (Next → Next → Finish).
2. Mở **Command Prompt** (hoặc PowerShell) và chạy:

   ```bash
   npm install -g firebase-tools
   ```

3. Đăng nhập Google (trình duyệt sẽ mở ra, chọn Gmail của chủ phòng khám hoặc Gmail đã được thêm làm thành viên):

   ```bash
   firebase login
   ```

### B3. Đưa lên mạng

Trong cửa sổ lệnh, chuyển vào thư mục phần mềm rồi chạy:

```bash
cd "đường-dẫn-tới\nha-khoa-tien-manh"
firebase deploy --only hosting,firestore
```

Lệnh này làm 2 việc:
- Đưa **quy tắc bảo mật** (`firestore.rules`) lên Firestore — chỉ tài khoản được cấp quyền mới xem/sửa được dữ liệu. **Bắt buộc**, nếu thiếu phần mềm sẽ báo "Không có quyền".
- Đưa **giao diện phần mềm** lên Firebase Hosting.

Khi xong, màn hình hiện dòng `Hosting URL: https://nha-khoa-tien-manh.web.app` — đó là địa chỉ phần mềm.

---

## Phần C — Sử dụng lần đầu

1. Mở địa chỉ `https://<projectId>.web.app`.
2. Đăng nhập bằng **email + mật khẩu đã tạo ở bước A3**.
   - Lần đăng nhập đầu tiên, phần mềm tự đặt tài khoản này làm **Quản trị viên** và tạo sẵn danh mục mẫu (thủ thuật & bảng giá, tình trạng răng, thuốc, nguồn khách, danh mục thu chi, vật tư).
3. Vào **Cài đặt › Thông tin phòng khám** để nhập địa chỉ, hotline (in trên phiếu thu, đơn thuốc).
4. Vào **Quản lý nhân sự** thêm bác sĩ, trợ thủ, lễ tân (kèm % hoa hồng).
5. Vào **Cài đặt › Tài khoản người dùng** tạo tài khoản đăng nhập cho nhân viên (dùng email thật của nhân viên, mật khẩu ≥ 6 ký tự).
   - Quyền **Nhân viên**: dùng mọi chức năng nghiệp vụ; không sửa cài đặt, chi nhánh, tài khoản.
   - Quên mật khẩu: quản trị viên mở tài khoản đó, nhập bất kỳ vào ô mật khẩu → hệ thống gửi email đặt lại mật khẩu.
   - Nghỉ việc: bỏ chọn **Kích hoạt** để khóa tài khoản.

---

## Cập nhật phần mềm về sau

Khi có phiên bản mới, chỉ cần chạy lại trong thư mục phần mềm:

```bash
firebase deploy --only hosting,firestore
```

Dữ liệu trên Firestore **không bị ảnh hưởng** khi cập nhật.

---

## Sao lưu dữ liệu

- Vào **Cài đặt › Sao lưu & khôi phục › Tải file sao lưu về máy** — nên làm **mỗi tuần** và cất file ở nơi an toàn (Google Drive, USB).
- File sao lưu gồm toàn bộ dữ liệu và ảnh; có thể khôi phục lại bằng nút **Chọn file sao lưu**.
- File sao lưu từ chế độ máy chủ nội bộ cũng khôi phục được sang Firebase để chuyển dữ liệu cũ lên mạng (riêng ảnh trong thư mục `data/uploads` không tự chuyển theo, cần tải lên lại nếu cần).

---

## Giới hạn gói miễn phí (Spark) cần biết

| Hạng mục | Giới hạn miễn phí | Ghi chú |
|---|---|---|
| Dung lượng Firestore | 1 GB | Ảnh được nén (~200–400 KB/ảnh) và lưu trong Firestore → khoảng vài nghìn ảnh |
| Lượt đọc | 50.000 / ngày | Mỗi lần mở phần mềm tải dữ liệu 1 lần, sau đó chỉ nhận phần thay đổi |
| Lượt ghi | 20.000 / ngày | Dư sức cho phòng khám vài chục khách/ngày |
| Hosting | 10 GB lưu trữ, 360 MB/ngày truyền tải | Phần mềm chỉ ~200 KB |

Theo dõi mức dùng tại Firebase Console › **Usage and billing**. Khi phòng khám lớn hơn, có thể nâng lên gói **Blaze** (trả theo mức dùng, thường chỉ vài chục nghìn đồng/tháng).

---

## Câu hỏi thường gặp

**Đăng nhập báo "Tài khoản chưa được cấp quyền"?**
Phòng khám đã có quản trị viên. Tài khoản tạo thẳng trong Firebase Console sẽ không tự có quyền — hãy tạo tài khoản nhân viên từ **Cài đặt › Tài khoản người dùng** trong phần mềm.

**Báo "Không có quyền thực hiện thao tác này"?**
Chưa đưa quy tắc bảo mật lên. Chạy `firebase deploy --only firestore`.

**Dùng tên miền riêng (vd. quanly.nhakhoatienmanh.vn)?**
Firebase Console › Hosting › **Add custom domain**, làm theo hướng dẫn trỏ DNS. Sau đó vào Authentication › Settings › **Authorized domains** thêm tên miền đó.

**`apiKey` trong file cấu hình có lộ không?**
Không sao — đây là mã định danh công khai của dự án Firebase. Dữ liệu được bảo vệ bằng đăng nhập và quy tắc trong `firestore.rules`.
