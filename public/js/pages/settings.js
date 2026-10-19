/* Cài đặt: thông tin phòng khám, danh mục, tài khoản, sao lưu */
(function () {
  const TABS = [['clinic', 'Thông tin phòng khám'], ['services', 'Thủ thuật & bảng giá'], ['conditions', 'Tình trạng răng'], ['medicines', 'Thuốc'], ['sources', 'Nguồn khách'], ['txcat', 'Danh mục thu chi'], ['users', 'Tài khoản người dùng'], ['backup', 'Sao lưu & khôi phục']];

  /* Bảng danh mục dùng chung: thêm / sửa / xóa */
  function catalog(el, { col, title, fields, columns, filter = () => true, defaults = {}, canDelete }) {
    el.innerHTML = `<div class="card"><div class="card-head"><h3>${title}</h3><div class="spacer"></div><input type="search" class="input" id="cq" placeholder="Tìm..."><button class="btn primary" id="cadd">+ Thêm mới</button></div><div id="t"></div></div>`;
    const form = (x = {}) => App.formModal({ title: (x.id ? 'Sửa ' : 'Thêm ') + title.toLowerCase(), data: { ...defaults, ...x }, fields, onSubmit: async v => { await App.save(col, x.id, v); App.toast('Đã lưu', 'success'); draw(); } });
    const draw = () => {
      const q = el.querySelector('#cq').value;
      App.table(el.querySelector('#t'), {
        rows: App.S[col].filter(x => filter(x) && App.match(q, ...fields.map(f => x[f.name]))), pageSize: 50,
        columns: [...columns, { label: '', cls: 'center', render: x => `<button class="icon-btn" data-act="edit" data-id="${x.id}">✏️</button><button class="icon-btn" data-act="del" data-id="${x.id}">🗑️</button>` }]
      });
    };
    draw();
    el.querySelector('#cq').oninput = draw;
    el.querySelector('#cadd').onclick = () => form();
    App.on(el, {
      edit: id => form(App.byId(col, id)),
      del: async id => { const why = canDelete && canDelete(id); if (why) return App.toast(why, 'error'); if (await App.remove(col, id)) draw(); }
    });
  }

  App.routes.settings = {
    title: 'Cài đặt',
    render(el, [tab = 'clinic']) {
      el.innerHTML = `<div class="tabs">${TABS.map(([k, l]) => `<a class="tab ${tab === k ? 'active' : ''}" href="#/settings/${k}">${l}</a>`).join('')}</div><div id="sb"></div>`;
      const sb = el.querySelector('#sb');
      const S = App.S;
      const adminOnly = () => { sb.innerHTML = '<div class="card">Chỉ quản trị viên mới truy cập được mục này.</div>'; };

      if (tab === 'clinic') {
        const fields = [
          { name: 'clinicName', label: 'Tên phòng khám', required: true }, { name: 'phone', label: 'Hotline' },
          { name: 'address', label: 'Địa chỉ', full: true }, { name: 'email', label: 'Email' }, { name: 'website', label: 'Website / Fanpage' },
          { name: 'taxCode', label: 'Mã số thuế' }, { name: 'slogan', label: 'Khẩu hiệu' },
          { name: 'workStart', label: 'Giờ mở cửa', type: 'time' }, { name: 'workEnd', label: 'Giờ đóng cửa', type: 'time' },
          { name: 'slotMinutes', label: 'Khoảng thời gian mỗi ô lịch (phút)', type: 'number', min: 5, step: 5 },
          { name: 'bankInfo', label: 'Thông tin chuyển khoản (in trên phiếu)', type: 'textarea' }
        ];
        sb.innerHTML = `<div class="card"><form id="cf"><div class="form-grid">${fields.map(f => App.fieldHtml(f, S.settings[f.name])).join('')}</div><div class="mt"><button class="btn primary" ${App.isAdmin() ? '' : 'disabled'}>Lưu cài đặt</button></div></form></div>`;
        const f = sb.querySelector('#cf');
        f.onsubmit = async e => {
          e.preventDefault();
          try { App.S.settings = await App.api('PUT', 'settings', App.readForm(f, fields)); App.toast('Đã lưu cài đặt', 'success'); document.querySelector('.brand div').firstChild.textContent = App.S.settings.clinicName; }
          catch (err) { App.toast(err.message, 'error'); }
        };
      }

      if (tab === 'services') {
        sb.innerHTML = '<div class="grid" style="grid-template-columns:minmax(0,1fr) minmax(0,2.4fr)"><div id="g"></div><div id="s"></div></div>';
        catalog(sb.querySelector('#g'), {
          col: 'serviceGroups', title: 'Nhóm thủ thuật', fields: [{ name: 'name', label: 'Tên nhóm', required: true, full: true }],
          columns: [{ label: 'Tên nhóm', render: x => App.esc(x.name) }, { label: 'Số TT', cls: 'num', render: x => S.services.filter(s => s.groupId === x.id).length }],
          canDelete: id => S.services.some(s => s.groupId === id) ? 'Nhóm còn thủ thuật, không thể xóa' : ''
        });
        catalog(sb.querySelector('#s'), {
          col: 'services', title: 'Thủ thuật', defaults: { active: true, unit: 'Răng' },
          fields: [
            { name: 'name', label: 'Tên thủ thuật', required: true, full: true },
            { name: 'groupId', label: 'Nhóm', type: 'select', required: true, options: () => S.serviceGroups.map(g => ({ value: g.id, label: g.name })) },
            { name: 'unit', label: 'Đơn vị' }, { name: 'price', label: 'Đơn giá', type: 'money', required: true },
            { name: 'warranty', label: 'Bảo hành' }, { name: 'active', label: 'Đang áp dụng', type: 'checkbox' }, { name: 'description', label: 'Mô tả', type: 'textarea' }
          ],
          columns: [
            { label: 'Tên thủ thuật', render: x => `<b>${App.esc(x.name)}</b>` }, { label: 'Nhóm', render: x => App.esc(App.nameOf('serviceGroups', x.groupId)) },
            { label: 'Đơn vị', render: x => App.esc(x.unit || '') }, { label: 'Đơn giá', cls: 'num', render: x => App.money(x.price) },
            { label: 'Bảo hành', render: x => App.esc(x.warranty || '') }, { label: 'Trạng thái', render: x => x.active !== false ? App.badge('Áp dụng', 'green') : App.badge('Ngừng', 'gray') }
          ]
        });
      }
      if (tab === 'conditions') catalog(sb, {
        col: 'toothConditions', title: 'Tình trạng răng', fields: [{ name: 'code', label: 'Mã', required: true }, { name: 'name', label: 'Tên tình trạng', required: true }],
        columns: [{ label: 'Mã', render: x => App.esc(x.code) }, { label: 'Tên tình trạng', render: x => App.esc(x.name) }]
      });
      if (tab === 'medicines') catalog(sb, {
        col: 'medicines', title: 'Thuốc', defaults: { unit: 'Viên' },
        fields: [{ name: 'name', label: 'Tên thuốc', required: true, full: true }, { name: 'unit', label: 'Đơn vị' }, { name: 'ingredient', label: 'Hoạt chất' }, { name: 'usage', label: 'Cách dùng mặc định', full: true }],
        columns: [{ label: 'Tên thuốc', render: x => `<b>${App.esc(x.name)}</b>` }, { label: 'Hoạt chất', render: x => App.esc(x.ingredient || '') }, { label: 'Đơn vị', render: x => App.esc(x.unit || '') }, { label: 'Cách dùng', render: x => App.esc(x.usage || '') }]
      });
      if (tab === 'sources') catalog(sb, {
        col: 'sources', title: 'Nguồn khách', fields: [{ name: 'name', label: 'Tên nguồn', required: true, full: true }],
        columns: [{ label: 'Tên nguồn', render: x => App.esc(x.name) }, { label: 'Số khách', cls: 'num', render: x => S.patients.filter(p => p.sourceId === x.id).length }]
      });
      if (tab === 'txcat') catalog(sb, {
        col: 'txCategories', title: 'Danh mục thu chi', defaults: { type: 'chi' },
        fields: [{ name: 'type', label: 'Loại', type: 'select', required: true, noEmpty: true, options: [{ value: 'thu', label: 'Thu' }, { value: 'chi', label: 'Chi' }] }, { name: 'name', label: 'Tên danh mục', required: true }],
        columns: [{ label: 'Loại', render: x => x.type === 'thu' ? App.badge('Thu', 'green') : App.badge('Chi', 'red') }, { label: 'Tên danh mục', render: x => App.esc(x.name) }],
        canDelete: id => S.transactions.some(t => t.categoryId === id) ? 'Danh mục đã được sử dụng, không thể xóa' : ''
      });

      if (tab === 'users') {
        if (!App.isAdmin()) return adminOnly();
        sb.innerHTML = '<div class="card"><div class="card-head"><h3>Tài khoản người dùng</h3><div class="spacer"></div><button class="btn primary" id="uadd">+ Thêm tài khoản</button></div><div id="t"></div></div>';
        const form = (x = {}) => App.formModal({
          title: x.id ? 'Sửa tài khoản' : 'Thêm tài khoản', data: { role: 'staff', active: true, ...x },
          fields: [
            { name: 'username', label: App.fb ? 'Email đăng nhập' : 'Tên đăng nhập', type: App.fb ? 'email' : 'text', required: true, show: () => !(App.fb && x.id) }, { name: 'name', label: 'Tên hiển thị', required: true },
            { name: 'password', label: x.id ? (App.fb ? 'Đặt lại mật khẩu: nhập bất kỳ để gửi email đặt lại' : 'Mật khẩu mới (để trống nếu không đổi)') : 'Mật khẩu (tối thiểu 6 ký tự)', type: 'password', required: !x.id },
            { name: 'role', label: 'Quyền', type: 'select', required: true, noEmpty: true, options: [{ value: 'admin', label: 'Quản trị viên' }, { value: 'staff', label: 'Nhân viên' }] },
            { name: 'staffId', label: 'Liên kết nhân viên', type: 'select', options: () => App.staffOptions() },
            { name: 'active', label: 'Kích hoạt', type: 'checkbox' }
          ],
          onSubmit: async v => {
            if (v.password && v.password.length < 6 && !(App.fb && x.id)) { App.toast('Mật khẩu tối thiểu 6 ký tự', 'error'); return false; }
            if (!v.password) delete v.password;
            await App.save('users', x.id, v); App.toast('Đã lưu tài khoản', 'success'); App.render();
          }
        });
        App.table(sb.querySelector('#t'), {
          rows: S.users, columns: [
            { label: 'Tên đăng nhập', render: u => `<b>${App.esc(u.username)}</b>` }, { label: 'Tên hiển thị', render: u => App.esc(u.name || '') },
            { label: 'Quyền', render: u => u.role === 'admin' ? App.badge('Quản trị viên', 'teal') : App.badge('Nhân viên', 'gray') },
            { label: 'Nhân viên', render: u => App.esc(App.nameOf('staff', u.staffId)) },
            { label: 'Trạng thái', render: u => u.active !== false ? App.badge('Hoạt động', 'green') : App.badge('Khóa', 'red') },
            { label: '', cls: 'center', render: u => `<button class="icon-btn" data-act="edit" data-id="${u.id}">✏️</button><button class="icon-btn" data-act="del" data-id="${u.id}">🗑️</button>` }
          ]
        });
        sb.querySelector('#uadd').onclick = () => form();
        App.on(sb, { edit: id => form(App.byId('users', id)), del: async id => { if (await App.remove('users', id)) App.render(); } });
      }

      if (tab === 'backup') {
        if (!App.isAdmin()) return adminOnly();
        const fb = App.mode === 'firebase';
        sb.innerHTML = `<div class="grid g2"><div class="card"><div class="card-head"><h3>Sao lưu dữ liệu</h3></div>
          ${fb ? '<p class="muted">Dữ liệu đang lưu trên <b>Firebase (Cloud Firestore)</b> của phòng khám. Nên tải file sao lưu về máy định kỳ (ví dụ mỗi tuần).</p>'
               : '<p class="muted">Dữ liệu được lưu trên máy chủ tại thư mục <code>data/</code>. Hệ thống tự sao lưu khi khởi động và mỗi 6 giờ (giữ 60 bản gần nhất trong <code>data/backups</code>).</p>'}
          <div class="flex wrap">${fb ? '' : '<button class="btn primary" id="bk-now">💾 Tạo bản sao lưu ngay</button>'}<button class="btn" id="bk-dl">⬇ Tải file sao lưu về máy</button></div>
          <h4 class="mt mb">Khôi phục từ file</h4><p class="text-red small">Cảnh báo: khôi phục sẽ thay thế toàn bộ dữ liệu hiện tại.</p>
          <label class="btn danger">⬆ Chọn file sao lưu (.json)<input type="file" id="bk-file" accept=".json,application/json" hidden></label></div>
          ${fb ? '' : '<div class="card"><div class="card-head"><h3>Các bản sao lưu trên máy chủ</h3></div><div id="bk-list" class="muted">Đang tải...</div></div>'}</div>`;
        if (!fb) {
          const loadList = async () => {
            const files = await App.api('GET', 'backup');
            sb.querySelector('#bk-list').innerHTML = files.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Tên file</th><th class="num">Dung lượng</th></tr></thead><tbody>${files.slice(0, 30).map(f => `<tr><td>${App.esc(f.name)}</td><td class="num">${(f.size / 1024).toFixed(1)} KB</td></tr>`).join('')}</tbody></table></div>` : 'Chưa có bản sao lưu';
          };
          loadList();
          sb.querySelector('#bk-now').onclick = async () => { const r = await App.api('POST', 'backup/create'); App.toast('Đã tạo ' + r.name, 'success'); loadList(); };
        }
        sb.querySelector('#bk-dl').onclick = () => App.downloadBackup().catch(err => App.toast(err.message, 'error'));
        sb.querySelector('#bk-file').onchange = async e => {
          const file = e.target.files[0]; if (!file) return;
          if (!(await App.confirm('Khôi phục sẽ thay thế toàn bộ dữ liệu hiện tại. Tiếp tục?'))) return;
          try { const data = JSON.parse(await file.text()); await App.api('POST', 'backup/restore', data); App.toast('Khôi phục thành công', 'success'); await App.refresh(); }
          catch (err) { App.toast('Lỗi: ' + err.message, 'error'); }
        };
      }
    }
  };
})();
