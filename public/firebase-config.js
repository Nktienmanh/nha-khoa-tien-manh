/*
 * CẤU HÌNH FIREBASE CỦA PHÒNG KHÁM
 * --------------------------------
 * Dán cấu hình lấy từ Firebase Console › Project settings › Your apps › Web app (firebaseConfig).
 * - Khi apiKey để trống: app chạy chế độ MÁY CHỦ NỘI BỘ (node server.js, dữ liệu trong thư mục data/).
 * - Khi điền đủ: app lưu toàn bộ dữ liệu trên FIREBASE (Cloud Firestore) và đăng nhập bằng Firebase Authentication.
 * Xem hướng dẫn chi tiết trong file HUONG-DAN-FIREBASE.md
 */
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyAFsgwPb5Guxz0ve3Xe9dKkVGJ9fVzLG4I",
  authDomain: "nha-khoa-tien-manh.firebaseapp.com",
  projectId: "nha-khoa-tien-manh",
  storageBucket: "nha-khoa-tien-manh.firebasestorage.app",
  messagingSenderId: "477475224528",
  appId: "1:477475224528:web:ea3ff81bba2cf0ac6ad7d5"
};
