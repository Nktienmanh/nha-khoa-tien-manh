/*
 * CẤU HÌNH FIREBASE CỦA PHÒNG KHÁM
 * --------------------------------
 * Dán cấu hình lấy từ Firebase Console › Project settings › Your apps › Web app (firebaseConfig).
 * - Khi apiKey để trống: app chạy chế độ MÁY CHỦ NỘI BỘ (node server.js, dữ liệu trong thư mục data/).
 * - Khi điền đủ: app lưu toàn bộ dữ liệu trên FIREBASE (Cloud Firestore) và đăng nhập bằng Firebase Authentication.
 * Xem hướng dẫn chi tiết trong file HUONG-DAN-FIREBASE.md
 */
window.FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};
