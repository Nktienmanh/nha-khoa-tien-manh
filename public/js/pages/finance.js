/* Quản lý thu/chi & hoa hồng */
(function () {
  App.txForm = function (x = {}) {
    if (x.id && x.patientId) return App.paymentForm(x.patientId, x);
    App.formModal({
      title: x.id ? 'Sửa phiếu ' + (x.type === 'chi' ? 'chi' : 'thu') : 'Thêm phiếu thu/chi', size: 'lg', data: { type: 'thu', method: 'Tiền mặt', ...x },
      fields: [
        { name: 'type', label: 'Loại phiếu', type: 'select', required: true, noEmpty: true, options: [{ value: 'thu', label: 'Phiếu thu' }, { value: 'chi', label: 'Phiếu chi' }] },
        { name: 'date', label: 'Ngày', type: 'date', required: true, default: App.today },
        { name: 'categoryId', label: 'Danh mục', type: 'select', required: true, options: () => App.S.txCategories.map(c => ({ value: c.id, label: `${c.type === 'thu' ? '[Thu]' : '[Chi]'} ${c.name}` })) },
        { name: 'amount', label: 'Số tiền', type: 'money', required: true },
        { name: 'method', label: 'Phương thức', type: 'select', required: true, noEmpty: true, options: App.PAY_METHODS },
        { name: 'person', label: 'Người nộp / người nhận' },
        { name: 'staffId', label: 'Nhân viên lập phiếu', type: 'select', options: () => App.staffOptions() },
        { name: 'branchId', label: 'Chi nhánh', type: 'select', options: () => App.S.branches.map(b => ({ value: b.id, label: b.name })), default: App.S.branches[0]?.id },
        { name: 'content', label: 'Nội dung', type: 'textarea' }
      ],
      onSubmit: async v => {
        const cat = App.byId('txCategories', v.categoryId);
        if (cat && cat.type !== v.type) { App.toast('Danh mục không khớp loại phiếu', 'error'); return false; }
        if (!(v.amount > 0)) { App.toast('Số tiền phải lớn hơn 0', 'error'); return false; }
        await App.save('transactions', x.id, v); App.toast('Đã lưu phiếu', 'success'); App.render();
      }
    });
  };

  const st = { from: App.monthStart(), to: App.monthEnd(), type: '', cat: '', method: '', q: '' };
  App.routes.finance = {
    title: 'Quản lý thu/chi',
    render(el) {
      el.innerHTML = `<div id="stats" class="grid g3 mb"></div><div class="card"><div class="toolbar">
        <input type="search" class="input" id="fq" placeholder="Mã phiếu, người nộp, nội dung..." value="${App.esc(st.q)}">${App.rangeInputs(st.from, st.to)}
        <select class="input" id="ftype"><option value="">Loại phiếu</option><option value="thu" ${st.type === 'thu' ? 'selected' : ''}>Phiếu thu</option><option value="chi" ${st.type === 'chi' ? 'selected' : ''}>Phiếu chi</option></select>
        <select class="input" id="fcat"><option value="">Danh mục</option>${App.S.txCategories.map(c => `<option value="${c.id}" ${st.cat === c.id ? 'selected' : ''}>${App.esc(c.name)}</option>`).join('')}</select>
        <select class="input" id="fmethod"><option value="">Phương thức</option>${App.PAY_METHODS.map(m => `<option ${st.method === m ? 'selected' : ''}>${m}</option>`).join('')}</select>
        <div class="spacer"></div><button class="btn" id="fexp">⬇ Export</button><button class="btn primary" id="fadd">+ Thêm mới</button></div><div id="t"></div></div>`;
      let rows = [];
      const draw = () => {
        rows = App.sortBy(App.S.transactions.filter(t => App.inRange(t.date, st.from, st.to) && (!st.type || t.type === st.type) && (!st.cat || t.categoryId === st.cat) && (!st.method || t.method === st.method)
          && App.match(st.q, t.code, t.person, t.content, App.nameOf('patients', t.patientId))), t => t.date + t.createdAt, true);
        const thu = App.sum(rows.filter(t => t.type === 'thu'), t => t.amount), chi = App.sum(rows.filter(t => t.type === 'chi'), t => t.amount);
        el.querySelector('#stats').innerHTML = `<div class="stat"><div class="label">Tổng thu</div><div class="value">${App.money(thu)}</div></div><div class="stat red"><div class="label">Tổng chi</div><div class="value">${App.money(chi)}</div></div><div class="stat blue"><div class="label">Chênh lệch</div><div class="value">${App.money(thu - chi)}</div></div>`;
        App.table(el.querySelector('#t'), {
          rows, empty: 'Chưa có dữ liệu',
          columns: [
            { label: 'Mã phiếu', render: t => App.esc(t.code) }, { label: 'Loại phiếu', render: t => t.type === 'thu' ? App.badge('Thu', 'green') : App.badge('Chi', 'red') },
            { label: 'Ngày', render: t => App.fmtDate(t.date) }, { label: 'Nhóm', render: t => App.esc(t.patientId ? 'Khách hàng' : (t.group || 'Phòng khám')) },
            { label: 'Danh mục', render: t => App.esc(App.nameOf('txCategories', t.categoryId)) },
            { label: 'Số tiền', cls: 'num', render: t => `<b class="${t.type === 'chi' ? 'text-red' : ''}">${App.money(t.amount)}</b>` },
            { label: 'Phương thức', render: t => App.esc(t.method || '') },
            { label: 'Người nộp/nhận', render: t => t.patientId ? `<a href="#/patient/${t.patientId}/pay">${App.esc(App.nameOf('patients', t.patientId))}</a>` : App.esc(t.person || '') },
            { label: 'Người tạo', render: t => App.esc(App.nameOf('staff', t.staffId) || App.nameOf('users', t.createdBy)) },
            { label: 'Nội dung', render: t => App.esc(t.content || '') },
            { label: 'Thao tác', cls: 'center', render: t => `<button class="icon-btn" data-act="print" data-id="${t.id}">🖨</button><button class="icon-btn" data-act="edit" data-id="${t.id}">✏️</button><button class="icon-btn" data-act="del" data-id="${t.id}">🗑️</button>` }
          ]
        });
      };
      draw();
      App.bindRange(el, (f, t) => { st.from = f; st.to = t; draw(); });
      el.querySelector('#fq').oninput = e => { st.q = e.target.value; draw(); };
      for (const [id, k] of [['ftype', 'type'], ['fcat', 'cat'], ['fmethod', 'method']]) el.querySelector('#' + id).onchange = e => { st[k] = e.target.value; draw(); };
      el.querySelector('#fadd').onclick = () => App.txForm();
      el.querySelector('#fexp').onclick = () => App.exportCSV('thu-chi.csv', [
        { label: 'Mã phiếu', value: t => t.code }, { label: 'Loại', value: t => t.type === 'thu' ? 'Thu' : 'Chi' }, { label: 'Ngày', value: t => App.fmtDate(t.date) },
        { label: 'Danh mục', value: t => App.nameOf('txCategories', t.categoryId) }, { label: 'Số tiền', value: t => t.amount }, { label: 'Phương thức', value: t => t.method },
        { label: 'Người nộp/nhận', value: t => t.person || App.nameOf('patients', t.patientId) }, { label: 'Nội dung', value: t => t.content }
      ], rows);
      App.on(el, {
        edit: id => App.txForm(App.byId('transactions', id)),
        del: async id => { if (await App.remove('transactions', id)) draw(); },
        print: id => App.printReceipt(App.byId('transactions', id))
      });
    }
  };

  /* ---------- Hoa hồng ---------- */
  App.commissionFor = (staffId, from, to) => {
    const s = App.byId('staff', staffId) || {};
    const asDoc = App.S.treatmentSessions.filter(x => x.doctorId === staffId && App.inRange(x.date, from, to));
    const asAst = App.S.treatmentSessions.filter(x => x.assistantId === staffId && x.doctorId !== staffId && App.inRange(x.date, from, to));
    const docRev = App.sum(asDoc, x => x.amount), astRev = App.sum(asAst, x => x.amount);
    const commission = docRev * (Number(s.commissionRate) || 0) / 100 + astRev * (Number(s.assistantRate) || 0) / 100;
    return { asDoc, asAst, docRev, astRev, commission };
  };
  const cs = { from: App.monthStart(), to: App.monthEnd() };
  App.routes.commission = {
    title: 'Quản lý hoa hồng',
    render(el) {
      const rows = App.S.staff.filter(s => s.active !== false || App.commissionFor(s.id, cs.from, cs.to).commission > 0).map(s => ({ s, ...App.commissionFor(s.id, cs.from, cs.to) }));
      el.innerHTML = `<div class="card"><div class="toolbar">${App.rangeInputs(cs.from, cs.to)}<div class="spacer"></div><span class="muted small">Tỷ lệ hoa hồng cài đặt trong từng nhân viên (Quản lý nhân sự)</span></div><div id="t"></div></div>`;
      App.bindRange(el, (f, t) => { cs.from = f; cs.to = t; App.render(); });
      App.table(el.querySelector('#t'), {
        rows: App.sortBy(rows, r => r.commission, true), empty: 'Chưa có nhân viên',
        columns: [
          { label: 'Nhân viên', render: r => `<b>${App.esc(r.s.name)}</b>` }, { label: 'Chức vụ', render: r => App.esc(App.ROLES[r.s.role] || '') },
          { label: 'Số ca (BS)', cls: 'num', render: r => r.asDoc.length }, { label: 'Doanh thu BS', cls: 'num', render: r => App.money(r.docRev), total: rs => App.money(App.sum(rs, r => r.docRev)) },
          { label: '% HH', cls: 'num', render: r => (r.s.commissionRate || 0) + '%' },
          { label: 'Số ca (TT)', cls: 'num', render: r => r.asAst.length }, { label: 'Doanh thu TT', cls: 'num', render: r => App.money(r.astRev) },
          { label: '% TT', cls: 'num', render: r => (r.s.assistantRate || 0) + '%' },
          { label: 'Hoa hồng', cls: 'num', render: r => `<b class="text-green">${App.money(r.commission)}</b>`, total: rs => App.money(App.sum(rs, r => r.commission)) },
          { label: '', cls: 'center', render: r => `<button class="btn sm" data-act="detail" data-id="${r.s.id}">Chi tiết</button> ${r.commission > 0 ? `<button class="btn sm primary" data-act="pay" data-id="${r.s.id}">Chi trả</button>` : ''}` }
        ]
      });
      App.on(el, {
        detail: id => {
          const r = App.commissionFor(id, cs.from, cs.to);
          const list = [...r.asDoc.map(x => ({ ...x, role: 'Bác sĩ' })), ...r.asAst.map(x => ({ ...x, role: 'Trợ thủ' }))];
          const m = App.modal({ title: 'Chi tiết hoa hồng - ' + App.nameOf('staff', id), size: 'xl', body: '<div id="d"></div>' });
          App.table(m.body.querySelector('#d'), {
            rows: App.sortBy(list, x => x.date), pageSize: 50,
            columns: [
              { label: 'Ngày', render: x => App.fmtDate(x.date) }, { label: 'Khách hàng', render: x => App.esc(App.nameOf('patients', x.patientId)) },
              { label: 'Thủ thuật', render: x => App.esc(x.serviceName || '') }, { label: 'Vai trò', render: x => x.role },
              { label: 'Thành tiền', cls: 'num', render: x => App.money(x.amount), total: rs => App.money(App.sum(rs, x => x.amount)) }
            ]
          });
        },
        pay: id => {
          const r = App.commissionFor(id, cs.from, cs.to);
          const cat = App.S.txCategories.find(c => c.type === 'chi' && /lương/i.test(c.name)) || App.S.txCategories.find(c => c.type === 'chi');
          App.txForm({ type: 'chi', categoryId: cat?.id, amount: Math.round(r.commission), person: App.nameOf('staff', id), content: `Chi hoa hồng ${App.fmtDate(cs.from)} - ${App.fmtDate(cs.to)}` });
        }
      });
    }
  };
})();
