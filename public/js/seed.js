/* Dữ liệu danh mục mẫu khi khởi tạo phòng khám (dùng chung cho máy chủ Node và Firebase) */
(function (root) {
  function buildSeed(uid, now) {
    const t = now();
    const out = { settings: {}, branches: [], serviceGroups: [], services: [], toothConditions: [], medicines: [], sources: [], txCategories: [], materials: [] };
    out.settings = { clinicName: 'Nha Khoa Tiến Mạnh', address: '', phone: '', email: '', slogan: 'Nụ cười khỏe - Cuộc sống vui', workStart: '08:00', workEnd: '20:00', slotMinutes: 30 };
    out.branches.push({ id: uid(), name: 'Cơ sở chính', address: '', phone: '', createdAt: t });
    const gIds = {};
    for (const g of ['Khám & Tư vấn', 'Nha khoa tổng quát', 'Nhổ răng', 'Phục hình', 'Implant', 'Chỉnh nha', 'Thẩm mỹ']) {
      const id = uid(); gIds[g] = id; out.serviceGroups.push({ id, name: g, createdAt: t });
    }
    const services = [
      ['Khám & Tư vấn', 'Khám tổng quát', 0, 'Lần'], ['Khám & Tư vấn', 'Chụp X-quang toàn cảnh', 150000, 'Phim'],
      ['Nha khoa tổng quát', 'Cạo vôi răng - đánh bóng', 300000, 'Lần'], ['Nha khoa tổng quát', 'Trám Composite', 300000, 'Răng'],
      ['Nha khoa tổng quát', 'Điều trị tủy răng cửa', 1000000, 'Răng'], ['Nha khoa tổng quát', 'Điều trị tủy răng hàm', 1800000, 'Răng'],
      ['Nhổ răng', 'Nhổ răng sữa', 100000, 'Răng'], ['Nhổ răng', 'Nhổ răng cối lớn', 400000, 'Răng'], ['Nhổ răng', 'Nhổ răng khôn hàm dưới', 1500000, 'Răng'],
      ['Phục hình', 'Mão sứ kim loại', 1500000, 'Răng'], ['Phục hình', 'Mão sứ Zirconia', 4000000, 'Răng'], ['Phục hình', 'Lấy dấu răng tạm', 1000000, 'Lần'],
      ['Implant', 'Cấy ghép Implant', 13000000, 'Trụ'], ['Implant', 'Ghép xương', 5000000, 'Lần'],
      ['Chỉnh nha', 'Niềng răng mắc cài kim loại', 30000000, 'Ca'], ['Chỉnh nha', 'Niềng răng trong suốt', 80000000, 'Ca'],
      ['Thẩm mỹ', 'Tẩy trắng răng tại phòng', 2500000, 'Lần'], ['Thẩm mỹ', 'Mặt dán sứ Veneer', 6000000, 'Răng']
    ];
    for (const [g, name, price, unit] of services) out.services.push({ id: uid(), groupId: gIds[g], name, price, unit, active: true, createdAt: t });
    for (const [code, name] of [['K01', 'Răng sâu'], ['K02', 'Sâu răng lan tủy'], ['K03', 'Viêm tủy'], ['K04', 'Răng vỡ/mẻ'], ['K05', 'Mất răng'], ['K06', 'Răng khôn mọc lệch'], ['K07', 'Viêm nướu'], ['K08', 'Vôi răng'], ['K09', 'Răng lung lay'], ['K10', 'Răng nhiễm màu'], ['K11', 'Răng mọc lệch/khấp khểnh']])
      out.toothConditions.push({ id: uid(), code, name, createdAt: t });
    for (const [name, unit, usage] of [['Amoxicillin 500mg', 'Viên', 'Uống 1 viên x 3 lần/ngày sau ăn'], ['Paracetamol 500mg', 'Viên', 'Uống 1 viên khi đau, cách 4-6 giờ'], ['Metronidazol 250mg', 'Viên', 'Uống 1 viên x 3 lần/ngày'], ['Alpha Choay', 'Viên', 'Ngậm 2 viên x 3 lần/ngày'], ['Nước súc miệng Chlorhexidine', 'Chai', 'Súc miệng 2 lần/ngày']])
      out.medicines.push({ id: uid(), name, unit, usage, createdAt: t });
    for (const s of ['Facebook', 'Zalo', 'Google', 'TikTok', 'Người quen giới thiệu', 'Vãng lai']) out.sources.push({ id: uid(), name: s, createdAt: t });
    for (const [type, name] of [['thu', 'Thu tiền điều trị'], ['thu', 'Thu khác'], ['chi', 'Tiền lương'], ['chi', 'Mặt bằng'], ['chi', 'Điện nước - Internet'], ['chi', 'Mua vật tư'], ['chi', 'Chi phí Labo'], ['chi', 'Marketing'], ['chi', 'Chi khác']])
      out.txCategories.push({ id: uid(), type, name, createdAt: t });
    for (const [code, name, unit, minStock] of [['VT001', 'Găng tay y tế', 'Hộp', 10], ['VT002', 'Khẩu trang y tế', 'Hộp', 10], ['VT003', 'Composite A2', 'Tuýp', 5], ['VT004', 'Thuốc tê Lidocain', 'Ống', 50], ['VT005', 'Kim tiêm nha khoa', 'Hộp', 5]])
      out.materials.push({ id: uid(), code, name, unit, minStock, price: 0, createdAt: t });
    return out;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { buildSeed };
  else root.NKTM_SEED = { buildSeed };
})(this);
