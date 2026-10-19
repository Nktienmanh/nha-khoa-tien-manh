/* Quản lý kho: vật tư, phiếu nhập/xuất, xưởng/labo */
(function () {
  const materialForm = (x = {}) => App.formModal({
    title: x.id ? 'Sửa vật tư' : 'Thêm vật tư', data: x,
    fields: [
      { name: 'code', label: 'Mã vật tư', required: true }, { name: 'name', label: 'Tên vật tư', required: true },
      { name: 'unit', label: 'Đơn vị tính', required: true }, { name: 'group', label: 'Nhóm', placeholder: 'Vật tư tiêu hao, Thuốc, Dụng cụ...' },
      { name: 'price', label: 'Giá nhập tham khảo', type: 'money' }, { name: 'minStock', label: 'Tồn tối thiểu (cảnh báo)', type: 'number', min: 0 },
      { name: 'supplier', label: 'Nhà cung cấp', full: true }, { name: 'note', label: 'Ghi chú', type: 'textarea' }
    ],
    onSubmit: async v => {
      if (App.S.materials.some(m => m.code === v.code && m.id !== x.id)) { App.toast('Mã vật tư đã tồn tại', 'error'); return false; }
      await App.save('materials', x.id, v); App.toast('Đã lưu vật tư', 'success'); App.render();
    }
  });

  const moveForm = (x = {}) => App.formModal({
    title: x.id ? 'Sửa phiếu kho' : (x.type === 'out' ? 'Phiếu xuất kho' : 'Phiếu nhập kho'), size: 'lg', data: { type: 'in', ...x },
    fields: [
      { name: 'type', label: 'Loại phiếu', type: 'select', required: true, noEmpty: true, options: [{ value: 'in', label: 'Nhập kho' }, { value: 'out', label: 'Xuất kho' }] },
      { name: 'date', label: 'Ngày', type: 'date', required: true, default: App.today },
      { name: 'materialId', label: 'Vật tư', type: 'select', required: true, full: true, options: () => App.S.materials.map(m => ({ value: m.id, label: `${m.code} - ${m.name} (tồn: ${App.stockOf(m.id)} ${m.unit})` })) },
      { name: 'qty', label: 'Số lượng', type: 'number', required: true, min: 0, step: 'any' },
      { name: 'price', label: 'Đơn giá', type: 'money' },
      { name: 'supplier', label: 'Nhà cung cấp / Bộ phận nhận' },
      { name: 'branchId', label: 'Chi nhánh', type: 'select', options: () => App.S.branches.map(b => ({ value: b.id, label: b.name })), default: App.S.branches[0]?.id },
      { name: 'createExpense', label: 'Tạo phiếu chi', type: 'checkbox', checkLabel: 'Tự động tạo phiếu chi mua vật tư', show: v => v.type === 'in' && !x.id },
      { name: 'note', label: 'Ghi chú', type: 'textarea' }
    ],
    onRender: form => {
      const mat = form.querySelector('[name=materialId]'), pr = form.querySelector('[name=price]');
      mat.addEventListener('change', () => { const m = App.byId('materials', mat.value); if (m && m.price && !pr.value) pr.value = App.money(m.price); });
    },
    onSubmit: async v => {
      if (!(v.qty > 0)) { App.toast('Số lượng phải lớn hơn 0', 'error'); return false; }
      if (v.type === 'out') {
        const stock = App.stockOf(v.materialId) + (x.id && x.type === 'out' ? Number(x.qty) : 0);
        if (v.qty > stock && !(await App.confirm(`Tồn kho chỉ còn ${stock}. Vẫn xuất?`))) return false;
      }
      const { createExpense, ...data } = v;
      await App.save('stockMoves', x.id, data);
      if (createExpense && v.price > 0) {
        const cat = App.S.txCategories.find(c => c.type === 'chi' && /vật tư/i.test(c.name)) || App.S.txCategories.find(c => c.type === 'chi');
        await App.create('transactions', { type: 'chi', date: v.date, categoryId: cat?.id, amount: Math.round(v.qty * v.price), method: 'Tiền mặt', person: v.supplier, branchId: v.branchId, content: `Mua ${App.nameOf('materials', v.materialId)} x ${v.qty}` });
      }
      App.toast('Đã lưu phiếu kho', 'success'); App.render();
    }
  });

  const ms = { q: '', low: false };
  App.routes.inventory = {
    title: 'Vật tư & tồn kho',
    render(el) {
      el.innerHTML = `<div class="card"><div class="toolbar"><input type="search" class="input" id="mq" placeholder="Tìm vật tư..." value="${App.esc(ms.q)}">
        <label class="flex"><input type="checkbox" id="mlow" ${ms.low ? 'checked' : ''}> Chỉ hiện sắp hết</label><div class="spacer"></div>
        <button class="btn" id="min">⬇ Nhập kho</button><button class="btn" id="mout">⬆ Xuất kho</button><button class="btn primary" id="madd">+ Thêm vật tư</button></div><div id="t"></div></div>`;
      const draw = () => {
        let rows = App.S.materials.filter(m => App.match(ms.q, m.code, m.name, m.group));
        if (ms.low) rows = rows.filter(m => App.stockOf(m.id) < (Number(m.minStock) || 0));
        App.table(el.querySelector('#t'), {
          rows: App.sortBy(rows, m => m.code), empty: 'Chưa có vật tư',
          columns: [
            { label: 'Mã', render: m => App.esc(m.code) }, { label: 'Tên vật tư', render: m => `<b>${App.esc(m.name)}</b>` }, { label: 'Nhóm', render: m => App.esc(m.group || '') },
            { label: 'ĐVT', render: m => App.esc(m.unit) },
            { label: 'Tồn kho', cls: 'num', render: m => { const s = App.stockOf(m.id); return `<b class="${s < (Number(m.minStock) || 0) ? 'text-red' : ''}">${s}</b>`; } },
            { label: 'Tồn tối thiểu', cls: 'num', render: m => m.minStock || 0 }, { label: 'Giá nhập', cls: 'num', render: m => App.money(m.price) },
            { label: 'Giá trị tồn', cls: 'num', render: m => App.money(App.stockOf(m.id) * (m.price || 0)), total: rs => App.money(App.sum(rs, m => App.stockOf(m.id) * (m.price || 0))) },
            { label: 'Nhà cung cấp', render: m => App.esc(m.supplier || '') },
            { label: '', cls: 'center', render: m => `<button class="icon-btn" data-act="edit" data-id="${m.id}">✏️</button><button class="icon-btn" data-act="del" data-id="${m.id}">🗑️</button>` }
          ]
        });
      };
      draw();
      el.querySelector('#mq').oninput = e => { ms.q = e.target.value; draw(); };
      el.querySelector('#mlow').onchange = e => { ms.low = e.target.checked; draw(); };
      el.querySelector('#madd').onclick = () => materialForm();
      el.querySelector('#min').onclick = () => moveForm({ type: 'in' });
      el.querySelector('#mout').onclick = () => moveForm({ type: 'out' });
      App.on(el, {
        edit: id => materialForm(App.byId('materials', id)),
        del: async id => { if (App.S.stockMoves.some(s => s.materialId === id)) return App.toast('Vật tư đã có phiếu nhập/xuất, không thể xóa', 'error'); if (await App.remove('materials', id)) draw(); }
      });
    }
  };

  const ss = { from: App.monthStart(), to: App.monthEnd(), type: '' };
  App.routes.stock = {
    title: 'Phiếu nhập / xuất kho',
    render(el) {
      el.innerHTML = `<div class="card"><div class="toolbar">${App.rangeInputs(ss.from, ss.to)}
        <select class="input" id="stype"><option value="">Tất cả</option><option value="in" ${ss.type === 'in' ? 'selected' : ''}>Nhập kho</option><option value="out" ${ss.type === 'out' ? 'selected' : ''}>Xuất kho</option></select>
        <div class="spacer"></div><button class="btn" id="sin">⬇ Nhập kho</button><button class="btn" id="sout">⬆ Xuất kho</button></div><div id="t"></div></div>`;
      const rows = App.sortBy(App.S.stockMoves.filter(s => App.inRange(s.date, ss.from, ss.to) && (!ss.type || s.type === ss.type)), s => s.date + s.createdAt, true);
      App.table(el.querySelector('#t'), {
        rows, empty: 'Chưa có phiếu kho',
        columns: [
          { label: 'Mã phiếu', render: s => App.esc(s.code) }, { label: 'Loại', render: s => s.type === 'in' ? App.badge('Nhập', 'green') : App.badge('Xuất', 'orange') },
          { label: 'Ngày', render: s => App.fmtDate(s.date) }, { label: 'Vật tư', render: s => App.esc(App.nameOf('materials', s.materialId)) },
          { label: 'SL', cls: 'num', render: s => `${s.qty} ${App.esc(App.nameOf('materials', s.materialId, 'unit'))}` },
          { label: 'Đơn giá', cls: 'num', render: s => App.money(s.price) }, { label: 'Thành tiền', cls: 'num', render: s => App.money((s.qty || 0) * (s.price || 0)), total: rs => App.money(App.sum(rs, s => (s.qty || 0) * (s.price || 0))) },
          { label: 'NCC / Bộ phận', render: s => App.esc(s.supplier || '') }, { label: 'Ghi chú', render: s => App.esc(s.note || '') },
          { label: '', cls: 'center', render: s => `<button class="icon-btn" data-act="edit" data-id="${s.id}">✏️</button><button class="icon-btn" data-act="del" data-id="${s.id}">🗑️</button>` }
        ]
      });
      App.bindRange(el, (f, t) => { ss.from = f; ss.to = t; App.render(); });
      el.querySelector('#stype').onchange = e => { ss.type = e.target.value; App.render(); };
      el.querySelector('#sin').onclick = () => moveForm({ type: 'in' });
      el.querySelector('#sout').onclick = () => moveForm({ type: 'out' });
      App.on(el, { edit: id => moveForm(App.byId('stockMoves', id)), del: async id => { if (await App.remove('stockMoves', id)) App.render(); } });
    }
  };

  /* ---------- Xưởng / Labo ---------- */
  const LAB_ST = { sent: ['Đã gửi xưởng', 'blue'], received: ['Đã nhận về', 'orange'], done: ['Đã lắp cho khách', 'green'], cancelled: ['Hủy', 'gray'] };
  App.labForm = (x = {}) => App.formModal({
    title: x.id ? 'Sửa đơn xưởng' : 'Thêm đơn xưởng / labo', size: 'lg', data: { status: 'sent', qty: 1, ...x },
    fields: [
      { name: 'patientId', label: 'Khách hàng', type: 'patient', required: true, full: true },
      { name: 'lab', label: 'Xưởng / Labo', required: true }, { name: 'item', label: 'Loại phục hình / vật tư', required: true, placeholder: 'Mão sứ Zirconia, hàm tháo lắp...' },
      { name: 'tooth', label: 'Răng số' }, { name: 'shade', label: 'Màu răng' },
      { name: 'qty', label: 'Số lượng', type: 'number', min: 1 }, { name: 'cost', label: 'Chi phí xưởng', type: 'money' },
      { name: 'date', label: 'Ngày gửi', type: 'date', required: true, default: App.today }, { name: 'dueDate', label: 'Ngày hẹn trả', type: 'date' },
      { name: 'doctorId', label: 'Bác sĩ', type: 'select', options: () => App.staffOptions(['doctor']) },
      { name: 'status', label: 'Trạng thái', type: 'select', required: true, noEmpty: true, options: Object.entries(LAB_ST).map(([value, [label]]) => ({ value, label })) },
      { name: 'note', label: 'Ghi chú', type: 'textarea' }
    ],
    onSubmit: async v => { await App.save('labOrders', x.id, v); App.toast('Đã lưu đơn xưởng', 'success'); App.render(); }
  });
  App.labTable = (container, rows, showPatient = true) => {
    App.table(container, {
      rows: App.sortBy(rows, l => l.date, true), empty: 'Chưa có đơn xưởng',
      columns: [
        { label: 'Mã', render: l => App.esc(l.code || '') }, ...(showPatient ? [{ label: 'Khách hàng', render: l => `<a href="#/patient/${l.patientId}/labs">${App.esc(App.nameOf('patients', l.patientId))}</a>` }] : []),
        { label: 'Xưởng', render: l => App.esc(l.lab) }, { label: 'Hạng mục', render: l => App.esc(l.item) }, { label: 'Răng', render: l => App.esc(l.tooth || '') },
        { label: 'SL', cls: 'num', render: l => l.qty || 1 }, { label: 'Chi phí', cls: 'num', render: l => App.money(l.cost), total: rs => App.money(App.sum(rs, l => l.cost)) },
        { label: 'Ngày gửi', render: l => App.fmtDate(l.date) },
        { label: 'Hẹn trả', render: l => `${App.fmtDate(l.dueDate)}${l.dueDate && l.dueDate < App.today() && l.status === 'sent' ? ' ' + App.badge('Trễ', 'red') : ''}` },
        { label: 'Trạng thái', render: l => { const [t, c] = LAB_ST[l.status] || LAB_ST.sent; return App.badge(t, c); } },
        { label: '', cls: 'center', render: l => `<button class="icon-btn" data-act="lab-edit" data-id="${l.id}">✏️</button><button class="icon-btn" data-act="lab-del" data-id="${l.id}">🗑️</button>` }
      ]
    });
    if (container._bound) return;
    container._bound = true;
    App.on(container, { 'lab-edit': id => App.labForm(App.byId('labOrders', id)), 'lab-del': async id => { if (await App.remove('labOrders', id)) App.render(); } });
  };
  const lsx = { status: '', q: '' };
  App.routes.labs = {
    title: 'Xưởng / Labo',
    render(el) {
      el.innerHTML = `<div class="card"><div class="toolbar"><input type="search" class="input" id="lq" placeholder="Tìm khách, xưởng, hạng mục..." value="${App.esc(lsx.q)}">
        <select class="input" id="lst"><option value="">Tất cả trạng thái</option>${Object.entries(LAB_ST).map(([k, [t]]) => `<option value="${k}" ${lsx.status === k ? 'selected' : ''}>${t}</option>`).join('')}</select>
        <div class="spacer"></div><button class="btn primary" id="ladd">+ Thêm đơn xưởng</button></div><div id="t"></div></div>`;
      const draw = () => App.labTable(el.querySelector('#t'), App.S.labOrders.filter(l => (!lsx.status || l.status === lsx.status) && App.match(lsx.q, l.lab, l.item, l.code, App.nameOf('patients', l.patientId))));
      draw();
      el.querySelector('#lq').oninput = e => { lsx.q = e.target.value; draw(); };
      el.querySelector('#lst').onchange = e => { lsx.status = e.target.value; draw(); };
      el.querySelector('#ladd').onclick = () => App.labForm();
    }
  };
})();
