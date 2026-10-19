/* Quản lý khách hàng - danh sách */
(function () {
  App.MED_HISTORY = ['Tiểu đường', 'Huyết áp cao', 'Huyết áp thấp', 'Tim mạch', 'Dị ứng thuốc', 'Chảy máu lâu', 'Hen suyễn', 'Viêm gan', 'Đang mang thai', 'Đang dùng thuốc', 'Bình thường'];

  App.patientForm = function (p = {}, onSaved) {
    App.formModal({
      title: p.id ? 'Sửa thông tin khách hàng' : 'Thêm mới khách hàng', size: 'lg', data: p,
      fields: [
        { name: 'name', label: 'Họ và tên', required: true },
        { name: 'phone', label: 'Số điện thoại', type: 'tel' },
        { name: 'gender', label: 'Giới tính', type: 'select', options: ['Nam', 'Nữ', 'Khác'] },
        { name: 'dob', label: 'Ngày sinh', type: 'date' },
        { name: 'email', label: 'Email', type: 'email' },
        { name: 'idNumber', label: 'CCCD/CMND' },
        { name: 'job', label: 'Nghề nghiệp' },
        { name: 'address', label: 'Địa chỉ' },
        { name: 'sourceId', label: 'Nguồn khách', type: 'select', options: () => App.S.sources.map(s => ({ value: s.id, label: s.name })) },
        { name: 'referrer', label: 'Người giới thiệu' },
        { name: 'branchId', label: 'Chi nhánh', type: 'select', options: () => App.S.branches.map(b => ({ value: b.id, label: b.name })), default: App.S.branches[0]?.id },
        { name: 'tags', label: 'Nhãn (phân cách bằng dấu phẩy)', placeholder: 'VIP, Niềng răng...' },
        { name: 'medicalHistory', label: 'Tiền sử bệnh', type: 'checks', options: App.MED_HISTORY, full: true },
        { name: 'note', label: 'Ghi chú', type: 'textarea' }
      ],
      onSubmit: async v => {
        if (v.phone && App.S.patients.some(x => x.phone === v.phone && x.id !== p.id) && !(await App.confirm('Số điện thoại đã tồn tại ở khách hàng khác. Vẫn lưu?'))) return false;
        const saved = await App.save('patients', p.id, v);
        App.toast('Đã lưu khách hàng', 'success');
        onSaved ? onSaved(saved) : App.render();
      }
    });
  };

  const state = { q: '', source: '', branch: '', debt: '', sort: 'new' };

  App.routes.patients = {
    title: 'Quản lý khách hàng',
    render(el) {
      el.innerHTML = `<div class="card">
        <div class="toolbar">
          <input type="search" class="input" id="pq" placeholder="Tìm theo mã, họ tên, SĐT, CCCD..." value="${App.esc(state.q)}">
          <select class="input" id="psource"><option value="">Tất cả nguồn</option>${App.S.sources.map(s => `<option value="${s.id}" ${state.source === s.id ? 'selected' : ''}>${App.esc(s.name)}</option>`).join('')}</select>
          <select class="input" id="pbranch"><option value="">Tất cả chi nhánh</option>${App.S.branches.map(s => `<option value="${s.id}" ${state.branch === s.id ? 'selected' : ''}>${App.esc(s.name)}</option>`).join('')}</select>
          <select class="input" id="pdebt"><option value="">Công nợ: tất cả</option><option value="1" ${state.debt === '1' ? 'selected' : ''}>Còn nợ</option><option value="0" ${state.debt === '0' ? 'selected' : ''}>Không nợ</option></select>
          <select class="input" id="psort"><option value="new">Mới nhất</option><option value="name" ${state.sort === 'name' ? 'selected' : ''}>Tên A-Z</option><option value="debt" ${state.sort === 'debt' ? 'selected' : ''}>Nợ nhiều nhất</option></select>
          <div class="spacer"></div>
          <button class="btn" id="pexport">⬇ Xuất Excel</button>
          <button class="btn primary" id="padd">+ Thêm mới khách hàng</button>
        </div>
        <div id="ptable"></div></div>`;
      const draw = () => {
        let rows = App.S.patients.filter(p => App.match(state.q, p.name, p.code, p.phone, p.idNumber, p.address)
          && (!state.source || p.sourceId === state.source) && (!state.branch || p.branchId === state.branch));
        const fin = new Map(rows.map(p => [p.id, App.patientFinance(p.id)]));
        if (state.debt === '1') rows = rows.filter(p => fin.get(p.id).debt > 0);
        if (state.debt === '0') rows = rows.filter(p => fin.get(p.id).debt <= 0);
        rows = state.sort === 'name' ? App.sortBy(rows, p => App.norm(p.name)) : state.sort === 'debt' ? App.sortBy(rows, p => fin.get(p.id).debt, true) : App.sortBy(rows, p => p.createdAt, true);
        App.table(el.querySelector('#ptable'), {
          rows, pageSize: 20, empty: 'Chưa có khách hàng nào',
          columns: [
            { label: 'Mã hồ sơ', render: p => App.esc(p.code) },
            { label: 'Họ tên', render: p => `<a href="#/patient/${p.id}" class="bold">${App.esc(p.name)}</a>${p.tags ? `<div>${p.tags.split(',').filter(Boolean).map(t => App.badge(t.trim(), 'teal')).join(' ')}</div>` : ''}` },
            { label: 'Điện thoại', render: p => App.esc(p.phone || '') },
            { label: 'Năm sinh', render: p => p.dob ? `${p.dob.slice(0, 4)} <span class="muted small">(${App.age(p.dob)}t)</span>` : '' },
            { label: 'Địa chỉ', render: p => App.esc(p.address || '') },
            { label: 'Tiền sử bệnh', render: p => `<span class="${(p.medicalHistory || []).some(x => x !== 'Bình thường') ? 'text-red' : ''}">${App.esc((p.medicalHistory || []).join(', '))}</span>` },
            { label: 'Nguồn', render: p => App.esc(App.nameOf('sources', p.sourceId)) },
            { label: 'Công nợ', cls: 'num', render: p => { const d = fin.get(p.id).debt; return d > 0 ? `<span class="text-red bold">${App.money(d)}</span>` : '0'; } },
            { label: 'Ngày tạo', render: p => App.fmtDate(p.createdAt) },
            { label: 'Thao tác', cls: 'center', render: p => `<button class="icon-btn" data-act="edit" data-id="${p.id}" title="Sửa">✏️</button><button class="icon-btn" data-act="del" data-id="${p.id}" title="Xóa">🗑️</button>` }
          ],
          onRow: p => App.go('#/patient/' + p.id)
        });
        el._rows = rows;
      };
      draw();
      const q = el.querySelector('#pq');
      q.oninput = () => { state.q = q.value; draw(); };
      for (const [id, k] of [['psource', 'source'], ['pbranch', 'branch'], ['pdebt', 'debt'], ['psort', 'sort']]) el.querySelector('#' + id).onchange = e => { state[k] = e.target.value; draw(); };
      el.querySelector('#padd').onclick = () => App.patientForm({}, p => App.go('#/patient/' + p.id));
      el.querySelector('#pexport').onclick = () => App.exportCSV('khach-hang.csv', [
        { label: 'Mã hồ sơ', value: p => p.code }, { label: 'Họ tên', value: p => p.name }, { label: 'Điện thoại', value: p => p.phone },
        { label: 'Giới tính', value: p => p.gender }, { label: 'Ngày sinh', value: p => App.fmtDate(p.dob) }, { label: 'Email', value: p => p.email },
        { label: 'Địa chỉ', value: p => p.address }, { label: 'Nguồn', value: p => App.nameOf('sources', p.sourceId) },
        { label: 'Tiền sử bệnh', value: p => (p.medicalHistory || []).join(', ') }, { label: 'Tổng điều trị', value: p => App.patientFinance(p.id).treated },
        { label: 'Đã thanh toán', value: p => App.patientFinance(p.id).paid }, { label: 'Công nợ', value: p => App.patientFinance(p.id).debt },
        { label: 'Ngày tạo', value: p => App.fmtDate(p.createdAt) }, { label: 'Ghi chú', value: p => p.note }
      ], el._rows);
      App.on(el, {
        edit: id => App.patientForm(App.byId('patients', id)),
        del: async id => { if (await App.remove('patients', id, { confirmText: 'Xóa khách hàng sẽ xóa toàn bộ hồ sơ khám, điều trị, lịch hẹn liên quan. Tiếp tục?' })) draw(); }
      });
    }
  };
})();
