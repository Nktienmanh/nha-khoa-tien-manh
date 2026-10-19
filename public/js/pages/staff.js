/* Quản lý nhân sự & chi nhánh */
(function () {
  App.staffForm = function (x = {}) {
    App.formModal({
      title: x.id ? 'Sửa nhân viên' : 'Thêm nhân viên', size: 'lg', data: { active: true, commissionRate: 0, ...x },
      fields: [
        { name: 'name', label: 'Họ tên', required: true },
        { name: 'role', label: 'Chức vụ', type: 'select', required: true, noEmpty: true, options: Object.entries(App.ROLES).map(([value, label]) => ({ value, label })) },
        { name: 'phone', label: 'Điện thoại', type: 'tel' },
        { name: 'email', label: 'Email', type: 'email' },
        { name: 'dob', label: 'Ngày sinh', type: 'date' },
        { name: 'startDate', label: 'Ngày vào làm', type: 'date' },
        { name: 'branchId', label: 'Chi nhánh', type: 'select', options: () => App.S.branches.map(b => ({ value: b.id, label: b.name })), default: App.S.branches[0]?.id },
        { name: 'salary', label: 'Lương cơ bản (VNĐ/tháng)', type: 'money' },
        { name: 'commissionRate', label: 'Hoa hồng điều trị (%)', type: 'number', min: 0, step: 'any', hint: 'Tính trên giá trị điều trị bác sĩ thực hiện' },
        { name: 'assistantRate', label: 'Hoa hồng trợ thủ (%)', type: 'number', min: 0, step: 'any', hint: 'Khi tham gia làm trợ thủ' },
        { name: 'active', label: 'Đang làm việc', type: 'checkbox' },
        { name: 'address', label: 'Địa chỉ' },
        { name: 'note', label: 'Ghi chú', type: 'textarea' }
      ],
      onSubmit: async v => { await App.save('staff', x.id, v); App.toast('Đã lưu nhân viên', 'success'); App.render(); }
    });
  };

  const st = { q: '', role: '', active: '1' };
  App.routes.staff = {
    title: 'Quản lý nhân sự',
    render(el) {
      el.innerHTML = `<div class="card"><div class="toolbar">
        <input type="search" class="input" id="sq" placeholder="Tìm nhân viên..." value="${App.esc(st.q)}">
        <select class="input" id="srole"><option value="">Tất cả chức vụ</option>${Object.entries(App.ROLES).map(([k, v]) => `<option value="${k}" ${st.role === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
        <select class="input" id="sact"><option value="1" ${st.active === '1' ? 'selected' : ''}>Đang làm việc</option><option value="0" ${st.active === '0' ? 'selected' : ''}>Đã nghỉ</option><option value="" ${st.active === '' ? 'selected' : ''}>Tất cả</option></select>
        <div class="spacer"></div><button class="btn primary" id="sadd">+ Thêm nhân viên</button></div><div id="t"></div>
        <p class="small muted mt">Để nhân viên đăng nhập phần mềm, tạo tài khoản tại <a href="#/settings/users">Cài đặt › Tài khoản người dùng</a>.</p></div>`;
      const draw = () => {
        const rows = App.sortBy(App.S.staff.filter(s => App.match(st.q, s.name, s.phone) && (!st.role || s.role === st.role) && (st.active === '' || (st.active === '1') === (s.active !== false))), s => App.norm(s.name));
        App.table(el.querySelector('#t'), {
          rows, empty: 'Chưa có nhân viên. Hãy thêm bác sĩ, trợ thủ, lễ tân...',
          columns: [
            { label: 'Họ tên', render: s => `<b>${App.esc(s.name)}</b>` }, { label: 'Chức vụ', render: s => App.badge(App.ROLES[s.role] || s.role, s.role === 'doctor' ? 'teal' : 'gray') },
            { label: 'Điện thoại', render: s => App.esc(s.phone || '') }, { label: 'Chi nhánh', render: s => App.esc(App.nameOf('branches', s.branchId)) },
            { label: 'Ngày vào làm', render: s => App.fmtDate(s.startDate) }, { label: 'Lương CB', cls: 'num', render: s => App.money(s.salary) },
            { label: 'Hoa hồng', cls: 'num', render: s => `${s.commissionRate || 0}%${s.assistantRate ? ` / TT ${s.assistantRate}%` : ''}` },
            { label: 'Trạng thái', render: s => s.active !== false ? App.badge('Đang làm', 'green') : App.badge('Đã nghỉ', 'gray') },
            { label: '', cls: 'center', render: s => `<button class="icon-btn" data-act="edit" data-id="${s.id}">✏️</button><button class="icon-btn" data-act="del" data-id="${s.id}">🗑️</button>` }
          ],
          onRow: s => App.staffForm(s)
        });
      };
      draw();
      el.querySelector('#sq').oninput = e => { st.q = e.target.value; draw(); };
      el.querySelector('#srole').onchange = e => { st.role = e.target.value; draw(); };
      el.querySelector('#sact').onchange = e => { st.active = e.target.value; draw(); };
      el.querySelector('#sadd').onclick = () => App.staffForm();
      App.on(el, {
        edit: id => App.staffForm(App.byId('staff', id)),
        del: async id => { if (await App.remove('staff', id, { confirmText: 'Xóa nhân viên? (Nên chuyển sang "Đã nghỉ" để giữ lịch sử)' })) draw(); }
      });
    }
  };

  App.routes.branches = {
    title: 'Quản lý chi nhánh',
    render(el) {
      el.innerHTML = `<div class="card"><div class="toolbar"><div class="spacer"></div>${App.isAdmin() ? '<button class="btn primary" id="badd">+ Thêm chi nhánh</button>' : ''}</div><div id="t"></div></div>`;
      const form = (x = {}) => App.formModal({
        title: x.id ? 'Sửa chi nhánh' : 'Thêm chi nhánh', data: x,
        fields: [{ name: 'name', label: 'Tên chi nhánh', required: true, full: true }, { name: 'address', label: 'Địa chỉ', full: true }, { name: 'phone', label: 'Điện thoại' }, { name: 'manager', label: 'Người quản lý' }],
        onSubmit: async v => { await App.save('branches', x.id, v); App.toast('Đã lưu', 'success'); App.render(); }
      });
      App.table(el.querySelector('#t'), {
        rows: App.S.branches,
        columns: [
          { label: 'Tên chi nhánh', render: b => `<b>${App.esc(b.name)}</b>` }, { label: 'Địa chỉ', render: b => App.esc(b.address || '') },
          { label: 'Điện thoại', render: b => App.esc(b.phone || '') }, { label: 'Quản lý', render: b => App.esc(b.manager || '') },
          { label: 'Khách hàng', cls: 'num', render: b => App.S.patients.filter(p => p.branchId === b.id).length },
          { label: 'Nhân viên', cls: 'num', render: b => App.S.staff.filter(s => s.branchId === b.id && s.active !== false).length },
          { label: 'Doanh thu tháng này', cls: 'num', render: b => App.money(App.sum(App.S.transactions.filter(t => t.type === 'thu' && t.branchId === b.id && App.inRange(t.date, App.monthStart(), App.monthEnd())), t => t.amount)) },
          { label: '', cls: 'center', render: b => App.isAdmin() ? `<button class="icon-btn" data-act="edit" data-id="${b.id}">✏️</button><button class="icon-btn" data-act="del" data-id="${b.id}">🗑️</button>` : '' }
        ]
      });
      el.querySelector('#badd')?.addEventListener('click', () => form());
      App.on(el, {
        edit: id => form(App.byId('branches', id)),
        del: async id => { if (App.S.branches.length <= 1) return App.toast('Phải có ít nhất 1 chi nhánh', 'error'); if (await App.remove('branches', id)) App.render(); }
      });
    }
  };
})();
