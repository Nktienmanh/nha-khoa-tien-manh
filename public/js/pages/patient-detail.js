/* Hồ sơ khách hàng - chi tiết với các tab */
(function () {
  const TABS = [
    ['info', 'Thông tin cơ bản'], ['exam', 'Khám & Điều trị'], ['rx', 'Đơn thuốc'], ['images', 'Thư viện ảnh'],
    ['labs', 'Xưởng/Vật tư'], ['appts', 'Lịch hẹn'], ['pay', 'Thanh toán'], ['care', 'Chăm sóc'], ['history', 'Lịch sử thao tác']
  ];
  const INDICATIONS = ['Chụp X-quang quanh chóp', 'Chụp X-quang toàn cảnh (Panorama)', 'Chụp Cephalo', 'Chụp CT Cone Beam', 'Xét nghiệm máu', 'Chụp ảnh trong miệng', 'Lấy dấu mẫu hàm'];
  const IMG_CATS = ['Trước điều trị', 'Trong điều trị', 'Sau điều trị', 'X-quang', 'Giấy tờ', 'Khác'];
  const ADULT = [[18, 17, 16, 15, 14, 13, 12, 11], [21, 22, 23, 24, 25, 26, 27, 28], [48, 47, 46, 45, 44, 43, 42, 41], [31, 32, 33, 34, 35, 36, 37, 38]];
  const CHILD = [[55, 54, 53, 52, 51], [61, 62, 63, 64, 65], [85, 84, 83, 82, 81], [71, 72, 73, 74, 75]];
  let selectedTeeth = new Set();
  let childMode = false;
  let lastPid = null;

  App.planStatus = p => p.status === 'done' ? 'done' : App.S.treatmentSessions.some(s => s.planId === p.id) ? 'in_progress' : 'planned';
  const PLAN_ST = { planned: ['Chưa điều trị', 'gray'], in_progress: ['Đang điều trị', 'orange'], done: ['Hoàn thành', 'green'] };

  App.routes.patient = {
    title: () => 'Hồ sơ khách hàng',
    render(el, [pid, tab = 'exam']) {
      const p = App.byId('patients', pid);
      if (!p) { el.innerHTML = '<div class="card">Không tìm thấy khách hàng. <a href="#/patients">Quay lại danh sách</a></div>'; return; }
      if (lastPid !== pid) { selectedTeeth = new Set(); lastPid = pid; }
      document.getElementById('page-title').textContent = p.name;
      const fin = App.patientFinance(pid);
      const warn = (p.medicalHistory || []).filter(x => x !== 'Bình thường');
      el.innerHTML = `
        <div class="card">
          <div class="patient-head">
            <div class="avatar">${App.initials(p.name)}</div>
            <div class="info">
              <h2>${App.esc(p.name)} <span class="muted small">${App.esc(p.code)}</span></h2>
              <div class="muted">${[p.gender, p.dob ? `${App.fmtDate(p.dob)} (${App.age(p.dob)} tuổi)` : '', p.phone, p.address].filter(Boolean).map(App.esc).join(' · ')}</div>
              ${warn.length ? `<div class="text-red small mt">⚠ Tiền sử: ${App.esc(warn.join(', '))}</div>` : ''}
            </div>
            <div class="money-row">
              <div><span>Tổng chi phí KH</span><b>${App.money(fin.planTotal)}</b></div>
              <div><span>Đã điều trị</span><b>${App.money(fin.treated)}</b></div>
              <div><span>Đã thanh toán</span><b class="text-green">${App.money(fin.paid)}</b></div>
              <div><span>Còn nợ</span><b class="${fin.debt > 0 ? 'text-red' : ''}">${App.money(fin.debt)}</b></div>
            </div>
            <div class="flex wrap">
              <button class="btn" data-act="edit">✏️ Sửa</button>
              <button class="btn" data-act="appt">📅 Đặt hẹn</button>
              <button class="btn primary" data-act="pay">💳 Thanh toán</button>
            </div>
          </div>
        </div>
        <div class="tabs">${TABS.map(([k, l]) => `<a class="tab ${k === tab ? 'active' : ''}" href="#/patient/${pid}/${k}">${l}</a>`).join('')}</div>
        <div id="tab-body"></div>`;
      App.on(el.querySelector('.patient-head'), {
        edit: () => App.patientForm(p),
        appt: () => App.appointmentForm({ patientId: pid }),
        pay: () => App.paymentForm(pid)
      });
      const body = el.querySelector('#tab-body');
      ({ info: tabInfo, exam: tabExam, rx: tabRx, images: tabImages, labs: tabLabs, appts: tabAppts, pay: tabPay, care: tabCare, history: tabHistory }[tab] || tabExam)(body, p);
    }
  };

  /* ---------- Thông tin cơ bản ---------- */
  function tabInfo(el, p) {
    const row = (k, v) => `<div class="k">${k}</div><div>${v || '<span class="muted">—</span>'}</div>`;
    el.innerHTML = `<div class="grid g2"><div class="card"><div class="card-head"><h3>Thông tin cá nhân</h3><div class="spacer"></div><button class="btn sm" data-act="edit">✏️ Sửa</button></div><div class="kv">
      ${row('Mã hồ sơ', App.esc(p.code))}${row('Họ tên', App.esc(p.name))}${row('Giới tính', App.esc(p.gender))}${row('Ngày sinh', App.fmtDate(p.dob))}
      ${row('Điện thoại', App.esc(p.phone))}${row('Email', App.esc(p.email))}${row('CCCD', App.esc(p.idNumber))}${row('Nghề nghiệp', App.esc(p.job))}
      ${row('Địa chỉ', App.esc(p.address))}${row('Nguồn khách', App.esc(App.nameOf('sources', p.sourceId)))}${row('Người giới thiệu', App.esc(p.referrer))}
      ${row('Chi nhánh', App.esc(App.nameOf('branches', p.branchId)))}${row('Nhãn', App.esc(p.tags))}${row('Ngày tạo', App.fmtDateTime(p.createdAt))}</div></div>
      <div class="card"><div class="card-head"><h3>Tiền sử bệnh & ghi chú</h3></div>
      <div class="mb">${(p.medicalHistory || []).map(x => App.badge(x, x === 'Bình thường' ? 'green' : 'red')).join(' ') || '<span class="muted">Chưa ghi nhận</span>'}</div>
      <div style="white-space:pre-wrap">${App.esc(p.note || '')}</div></div></div>`;
    App.on(el, { edit: () => App.patientForm(p) });
  }

  /* ---------- Khám & Điều trị ---------- */
  function odontogram(pid) {
    const plans = App.S.treatmentPlans.filter(x => x.patientId === pid);
    const toothState = {};
    for (const pl of plans) for (const t of String(pl.tooth || '').split(/[,\s]+/).filter(Boolean)) {
      const st = App.planStatus(pl);
      if (st === 'done') toothState[t] = toothState[t] || 'has-done'; else toothState[t] = 'has-plan';
    }
    const missing = new Set((App.byId('patients', pid).missingTeeth || []));
    const set = childMode ? CHILD : ADULT;
    const tooth = n => `<div class="tooth ${toothState[n] || ''} ${missing.has(String(n)) ? 'missing' : ''} ${selectedTeeth.has(String(n)) ? 'selected' : ''}" data-tooth="${n}" title="Răng ${n}">${n}</div>`;
    return `<div class="odonto">
      <div class="jaw-label">Hàm trên</div>
      <div class="row">${set[0].map(tooth).join('')}<div class="gap"></div>${set[1].map(tooth).join('')}</div>
      <div class="row lower">${set[2].map(tooth).join('')}<div class="gap"></div>${set[3].map(tooth).join('')}</div>
      <div class="jaw-label">Hàm dưới</div>
      <div class="legend"><span><i style="background:#fef3c7;border-color:#f59e0b"></i>Có kế hoạch điều trị</span><span><i style="background:#dcfce7;border-color:#16a34a"></i>Đã hoàn thành</span><span><i style="background:#f3f4f6"></i>Mất răng</span><span><i style="background:var(--primary)"></i>Đang chọn</span></div>
    </div>`;
  }

  function tabExam(el, p) {
    const pid = p.id;
    const exams = App.sortBy(App.S.exams.filter(x => x.patientId === pid), x => x.date + x.createdAt, true);
    const plans = App.sortBy(App.S.treatmentPlans.filter(x => x.patientId === pid), x => x.createdAt);
    const sessions = App.sortBy(App.S.treatmentSessions.filter(x => x.patientId === pid), x => x.date + x.createdAt, true);
    const est = App.sum(plans, x => (Number(x.qty) || 1) * (Number(x.price) || 0));
    const disc = est - App.sum(plans, App.planAmount);
    const doneAmt = App.sum(sessions, s => s.amount);
    el.innerHTML = `
      <div class="card">
        <div class="card-head"><h3>Phiếu khám</h3><div class="spacer"></div><button class="btn primary" data-act="add-exam">+ Thêm phiếu khám</button></div>
        ${exams.length ? exams.map(x => `<div class="exam-block"><div class="eh"><b>NGÀY KHÁM: ${App.fmtDate(x.date)}</b><span class="muted">· BS: ${App.esc(App.nameOf('staff', x.doctorId) || '—')}</span><div class="spacer" style="flex:1"></div>
          <button class="btn sm" data-act="print-exam" data-id="${x.id}">🖨 In</button><button class="icon-btn" data-act="edit-exam" data-id="${x.id}">✏️</button><button class="icon-btn" data-act="del-exam" data-id="${x.id}">🗑️</button></div>
          <div class="eb kv">
            <div class="k">Lý do khám</div><div>${App.esc(x.reason || '—')}</div>
            <div class="k">Khám tổng quát</div><div style="white-space:pre-wrap">${App.esc(x.general || '—')}</div>
            <div class="k">Chỉ định</div><div>${(x.indications || []).map(i => App.badge(i, 'blue')).join(' ') || '—'} ${App.esc(x.indicationNote || '')}</div>
            <div class="k">Chẩn đoán</div><div style="white-space:pre-wrap">${App.esc(x.diagnosis || '—')}</div>
            <div class="k">Hướng điều trị</div><div style="white-space:pre-wrap">${App.esc(x.direction || '—')}</div>
          </div></div>`).join('') : '<div class="muted">Chưa có phiếu khám. Bấm "Thêm phiếu khám" để bắt đầu.</div>'}
      </div>
      <div class="card">
        <div class="card-head"><h3>Sơ đồ răng</h3><div class="spacer"></div>
          <label class="flex small"><input type="checkbox" id="child-mode" ${childMode ? 'checked' : ''}> Răng sữa</label>
          <button class="btn sm" data-act="mark-missing">Đánh dấu mất răng</button>
          <button class="btn sm" data-act="clear-sel">Bỏ chọn</button>
        </div>
        <div class="small muted">Bấm vào răng để chọn (có thể chọn nhiều), sau đó bấm "Thêm kế hoạch điều trị".</div>
        <div id="odonto">${odontogram(pid)}</div>
      </div>
      <div class="card">
        <div class="card-head"><h3>KẾ HOẠCH ĐIỀU TRỊ</h3><div class="spacer"></div><button class="btn" data-act="print-plan">🖨 In kế hoạch</button><button class="btn primary" data-act="add-plan">+ Thêm kế hoạch điều trị</button></div>
        <div id="plan-table"></div>
        <div class="money-row mt">
          <div><span>Chi phí dự kiến</span><b>${App.money(est)}</b></div>
          <div><span>Tiền giảm giá</span><b>${App.money(disc)}</b></div>
          <div><span>Tổng chi phí dự kiến</span><b>${App.money(est - disc)}</b></div>
          <div><span>Đã hoàn thành</span><b class="text-green">${App.money(doneAmt)}</b></div>
          <div><span>Chưa hoàn thành</span><b class="text-red">${App.money(est - disc - doneAmt)}</b></div>
        </div>
      </div>
      <div class="card">
        <div class="card-head"><h3>TIẾN TRÌNH ĐIỀU TRỊ</h3><div class="spacer"></div><button class="btn primary" data-act="add-session">+ Thêm ngày điều trị</button></div>
        <div id="session-table"></div>
      </div>`;

    App.table(el.querySelector('#plan-table'), {
      rows: plans, pageSize: 50, empty: 'Chưa có kế hoạch điều trị',
      columns: [
        { label: 'Răng số', render: x => App.esc(x.tooth || '') },
        { label: 'Tình trạng răng', render: x => App.esc(App.nameOf('toothConditions', x.toothConditionId) || x.toothConditionText || '') },
        { label: 'Tên thủ thuật', render: x => App.esc(x.serviceName) },
        { label: 'KH đồng ý', cls: 'center', render: x => `<input type="checkbox" data-act="toggle-agree" data-id="${x.id}" ${x.agreed !== false ? 'checked' : ''}>` },
        { label: 'S.L', cls: 'num', render: x => x.qty || 1 },
        { label: 'Đơn giá', cls: 'num', render: x => App.money(x.price) },
        { label: 'Thành tiền', cls: 'num', render: x => App.money((x.qty || 1) * x.price) },
        { label: 'Giảm (%)', cls: 'num', render: x => x.discountPct || 0 },
        { label: 'Tiền giảm', cls: 'num', render: x => App.money((x.qty || 1) * x.price - App.planAmount(x)) },
        { label: 'Tổng chi phí', cls: 'num', render: x => `<b>${App.money(App.planAmount(x))}</b>` },
        { label: 'Đã điều trị', cls: 'num', render: x => App.money(App.planDone(x)) },
        { label: 'Ghi chú', render: x => App.esc(x.note || '') },
        { label: 'Tình trạng', cls: 'center', render: x => { const s = App.planStatus(x); return s === 'done' ? App.badge('Hoàn thành', 'green') : `<button class="btn sm link" data-act="treat" data-id="${x.id}">Điều trị →</button>${s === 'in_progress' ? '<div>' + App.badge('Đang điều trị', 'orange') + '</div>' : ''}`; } },
        { label: '', cls: 'center', render: x => `<button class="icon-btn" data-act="edit-plan" data-id="${x.id}">✏️</button><button class="icon-btn" data-act="del-plan" data-id="${x.id}">🗑️</button>` }
      ]
    });
    App.table(el.querySelector('#session-table'), {
      rows: sessions, pageSize: 30, empty: 'Chưa có tiến trình điều trị',
      columns: [
        { label: 'Ngày', render: s => App.fmtDate(s.date) },
        { label: 'Răng số', render: s => App.esc(s.tooth || '') },
        { label: 'Tên thủ thuật', render: s => App.esc(s.serviceName || '') },
        { label: 'Nội dung thủ thuật', render: s => App.esc(s.content || '') },
        { label: 'Bác sĩ', render: s => App.esc(App.nameOf('staff', s.doctorId)) },
        { label: 'Trợ thủ', render: s => App.esc(App.nameOf('staff', s.assistantId)) },
        { label: 'Thành tiền', cls: 'num', render: s => App.money(s.amount), total: rows => App.money(App.sum(rows, s => s.amount)) },
        { label: '', cls: 'center', render: s => `<button class="icon-btn" data-act="edit-session" data-id="${s.id}">✏️</button><button class="icon-btn" data-act="del-session" data-id="${s.id}">🗑️</button>` }
      ]
    });

    const odo = el.querySelector('#odonto');
    odo.addEventListener('click', e => {
      const t = e.target.closest('[data-tooth]'); if (!t) return;
      const n = t.dataset.tooth;
      selectedTeeth.has(n) ? selectedTeeth.delete(n) : selectedTeeth.add(n);
      t.classList.toggle('selected');
    });
    el.querySelector('#child-mode').onchange = e => { childMode = e.target.checked; odo.innerHTML = odontogram(pid); };
    const rerender = () => App.render();
    App.on(el, {
      'add-exam': () => examForm(pid),
      'edit-exam': id => examForm(pid, App.byId('exams', id)),
      'del-exam': async id => { if (await App.remove('exams', id)) rerender(); },
      'print-exam': id => printExam(p, App.byId('exams', id)),
      'add-plan': () => planForm(pid, { tooth: [...selectedTeeth].join(', ') }),
      'edit-plan': id => planForm(pid, App.byId('treatmentPlans', id)),
      'del-plan': async id => { if (await App.remove('treatmentPlans', id, { confirmText: 'Xóa kế hoạch sẽ xóa cả tiến trình điều trị liên quan. Tiếp tục?' })) rerender(); },
      'toggle-agree': async (id, cb) => { await App.update('treatmentPlans', id, { agreed: cb.checked }); rerender(); },
      treat: id => sessionForm(pid, { planId: id }),
      'add-session': () => sessionForm(pid, {}),
      'edit-session': id => sessionForm(pid, App.byId('treatmentSessions', id)),
      'del-session': async id => { if (await App.remove('treatmentSessions', id)) rerender(); },
      'clear-sel': () => { selectedTeeth.clear(); odo.innerHTML = odontogram(pid); },
      'mark-missing': async () => {
        if (!selectedTeeth.size) return App.toast('Hãy chọn răng trên sơ đồ trước', 'error');
        const cur = new Set(p.missingTeeth || []);
        for (const t of selectedTeeth) cur.has(t) ? cur.delete(t) : cur.add(t);
        await App.update('patients', pid, { missingTeeth: [...cur] }); selectedTeeth.clear(); rerender();
      },
      'print-plan': () => printPlan(p, plans)
    });
  }

  function examForm(pid, x = {}) {
    App.formModal({
      title: x.id ? 'Sửa phiếu khám' : 'Thêm phiếu khám', size: 'lg', data: x,
      fields: [
        { name: 'date', label: 'Ngày khám', type: 'date', required: true, default: App.today },
        { name: 'doctorId', label: 'Bác sĩ khám', type: 'select', options: () => App.staffOptions(['doctor']) },
        { name: 'reason', label: 'Lý do khám', full: true },
        { name: 'general', label: 'Khám tổng quát', type: 'textarea', placeholder: 'Tình trạng răng miệng, nướu, khớp cắn...' },
        { name: 'indications', label: 'Chỉ định', type: 'checks', options: INDICATIONS, full: true },
        { name: 'indicationNote', label: 'Ghi chú chỉ định', full: true },
        { name: 'diagnosis', label: 'Chẩn đoán', type: 'textarea' },
        { name: 'direction', label: 'Hướng điều trị', type: 'textarea' }
      ],
      onSubmit: async v => { await App.save('exams', x.id, { ...v, patientId: pid }); App.toast('Đã lưu phiếu khám', 'success'); App.render(); }
    });
  }

  function planForm(pid, x = {}) {
    const fields = [
      { name: 'tooth', label: 'Răng số (vd: 11, 12)', placeholder: 'Để trống nếu cả hàm' },
      { name: 'toothConditionId', label: 'Tình trạng răng', type: 'select', options: () => App.S.toothConditions.map(c => ({ value: c.id, label: `${c.code} - ${c.name}` })) },
      { name: 'serviceId', label: 'Thủ thuật', type: 'select', required: true, full: true, options: () => App.S.services.filter(s => s.active !== false || s.id === x.serviceId).map(s => ({ value: s.id, label: `${App.nameOf('serviceGroups', s.groupId)} › ${s.name} (${App.money(s.price)}đ)` })) },
      { name: 'qty', label: 'Số lượng', type: 'number', default: 1, min: 1, required: true },
      { name: 'price', label: 'Đơn giá', type: 'money', required: true },
      { name: 'discountPct', label: 'Giảm giá (%)', type: 'number', default: 0, min: 0, step: 'any' },
      { name: 'discountAmount', label: 'Giảm thêm (VNĐ)', type: 'money', default: 0 },
      { name: 'agreed', label: 'Khách hàng đồng ý', type: 'checkbox', default: true },
      { name: 'examId', label: 'Thuộc phiếu khám', type: 'select', options: () => App.S.exams.filter(e => e.patientId === pid).map(e => ({ value: e.id, label: 'Phiếu khám ' + App.fmtDate(e.date) })) },
      { name: 'note', label: 'Ghi chú', type: 'textarea' }
    ];
    App.formModal({
      title: x.id ? 'Sửa kế hoạch điều trị' : 'Thêm kế hoạch điều trị', size: 'lg', data: x, fields,
      onRender: form => {
        const sv = form.querySelector('[name=serviceId]'), pr = form.querySelector('[name=price]');
        sv.addEventListener('change', () => { const s = App.byId('services', sv.value); if (s) pr.value = App.money(s.price); });
      },
      onSubmit: async v => {
        const s = App.byId('services', v.serviceId);
        await App.save('treatmentPlans', x.id, { ...v, patientId: pid, serviceName: s?.name || x.serviceName, status: x.status || 'planned' });
        selectedTeeth.clear();
        App.toast('Đã lưu kế hoạch điều trị', 'success'); App.render();
      }
    });
  }

  function sessionForm(pid, x = {}) {
    const plans = App.S.treatmentPlans.filter(p => p.patientId === pid && (p.status !== 'done' || p.id === x.planId));
    if (!plans.length) return App.toast('Cần thêm kế hoạch điều trị trước', 'error');
    const remaining = id => { const p = App.byId('treatmentPlans', id); return p ? Math.max(0, App.planAmount(p) - App.planDone(p) + (x.id && x.planId === id ? Number(x.amount) || 0 : 0)) : 0; };
    const initPlan = x.planId || plans[0].id;
    App.formModal({
      title: x.id ? 'Sửa tiến trình điều trị' : 'Thêm ngày điều trị', size: 'lg',
      data: { amount: remaining(initPlan), ...x, planId: initPlan, markDone: x.id ? App.byId('treatmentPlans', x.planId)?.status === 'done' : false },
      fields: [
        { name: 'planId', label: 'Hạng mục điều trị', type: 'select', required: true, full: true, options: plans.map(p => ({ value: p.id, label: `${p.tooth ? 'R' + p.tooth + ' · ' : ''}${p.serviceName} · còn ${App.money(remaining(p.id))}đ` })) },
        { name: 'date', label: 'Ngày điều trị', type: 'date', required: true, default: App.today },
        { name: 'amount', label: 'Thành tiền lần này', type: 'money', hint: 'Giá trị điều trị ghi nhận doanh thu cho lần này' },
        { name: 'doctorId', label: 'Bác sĩ', type: 'select', options: () => App.staffOptions(['doctor']) },
        { name: 'assistantId', label: 'Trợ thủ', type: 'select', options: () => App.staffOptions(['assistant', 'doctor']) },
        { name: 'content', label: 'Nội dung thủ thuật', type: 'textarea' },
        { name: 'markDone', label: 'Hoàn thành hạng mục', type: 'checkbox', checkLabel: 'Đánh dấu hạng mục đã hoàn thành' }
      ],
      onRender: form => {
        const pl = form.querySelector('[name=planId]'), am = form.querySelector('[name=amount]');
        pl.addEventListener('change', () => { am.value = App.money(remaining(pl.value)); });
      },
      onSubmit: async v => {
        const plan = App.byId('treatmentPlans', v.planId);
        const { markDone, ...data } = v;
        await App.save('treatmentSessions', x.id, { ...data, patientId: pid, tooth: plan.tooth, serviceName: plan.serviceName, serviceId: plan.serviceId });
        const newStatus = markDone ? 'done' : (plan.status === 'done' ? 'in_progress' : plan.status);
        if (newStatus !== plan.status) await App.update('treatmentPlans', plan.id, { status: newStatus });
        App.toast('Đã lưu tiến trình điều trị', 'success'); App.render();
      }
    });
  }

  function printExam(p, x) {
    App.print(`<div class="print-title">PHIẾU KHÁM BỆNH</div>
      <p>Họ tên: <b>${App.esc(p.name)}</b> &nbsp; Mã: ${App.esc(p.code)} &nbsp; Ngày sinh: ${App.fmtDate(p.dob)} &nbsp; Giới tính: ${App.esc(p.gender || '')}</p>
      <p>Điện thoại: ${App.esc(p.phone || '')} &nbsp; Địa chỉ: ${App.esc(p.address || '')}</p>
      <p>Ngày khám: ${App.fmtDate(x.date)} &nbsp; Bác sĩ: ${App.esc(App.nameOf('staff', x.doctorId))}</p>
      <p><b>Lý do khám:</b> ${App.esc(x.reason || '')}</p><p><b>Khám tổng quát:</b> ${App.esc(x.general || '')}</p>
      <p><b>Chỉ định:</b> ${App.esc((x.indications || []).join(', '))} ${App.esc(x.indicationNote || '')}</p>
      <p><b>Chẩn đoán:</b> ${App.esc(x.diagnosis || '')}</p><p><b>Hướng điều trị:</b> ${App.esc(x.direction || '')}</p>
      <div class="sign-row"><div>Khách hàng<br><br><br></div><div>Bác sĩ<br><br><br>${App.esc(App.nameOf('staff', x.doctorId))}</div></div>`);
  }
  function printPlan(p, plans) {
    App.print(`<div class="print-title">KẾ HOẠCH ĐIỀU TRỊ</div>
      <p>Khách hàng: <b>${App.esc(p.name)}</b> (${App.esc(p.code)}) &nbsp; ĐT: ${App.esc(p.phone || '')}</p>
      <table><tr><th>Răng</th><th>Thủ thuật</th><th>SL</th><th>Đơn giá</th><th>Giảm</th><th>Thành tiền</th></tr>
      ${plans.filter(x => x.agreed !== false).map(x => `<tr><td>${App.esc(x.tooth || '')}</td><td>${App.esc(x.serviceName)}</td><td>${x.qty || 1}</td><td style="text-align:right">${App.money(x.price)}</td><td style="text-align:right">${App.money((x.qty || 1) * x.price - App.planAmount(x))}</td><td style="text-align:right">${App.money(App.planAmount(x))}</td></tr>`).join('')}
      <tr><td colspan="5"><b>Tổng cộng</b></td><td style="text-align:right"><b>${App.money(App.sum(plans.filter(x => x.agreed !== false), App.planAmount))}</b></td></tr></table>
      <div class="sign-row"><div>Khách hàng<br><br><br></div><div>Bác sĩ tư vấn<br><br><br></div></div>`);
  }

  /* ---------- Đơn thuốc ---------- */
  function tabRx(el, p) {
    const list = App.sortBy(App.S.prescriptions.filter(x => x.patientId === p.id), x => x.date + x.createdAt, true);
    el.innerHTML = `<div class="card"><div class="card-head"><h3>Đơn thuốc</h3><div class="spacer"></div><button class="btn primary" data-act="add">+ Thêm đơn thuốc</button></div><div id="t"></div></div>`;
    App.table(el.querySelector('#t'), {
      rows: list, empty: 'Chưa có đơn thuốc',
      columns: [
        { label: 'Mã đơn', render: x => App.esc(x.code) },
        { label: 'Ngày kê', render: x => App.fmtDate(x.date) },
        { label: 'Bác sĩ', render: x => App.esc(App.nameOf('staff', x.doctorId)) },
        { label: 'Chẩn đoán', render: x => App.esc(x.diagnosis || '') },
        { label: 'Thuốc', render: x => (x.items || []).map(i => `${App.esc(i.name)} × ${i.qty} ${App.esc(i.unit || '')}`).join('<br>') },
        { label: '', cls: 'center', render: x => `<button class="btn sm" data-act="print" data-id="${x.id}">🖨 In</button> <button class="icon-btn" data-act="edit" data-id="${x.id}">✏️</button><button class="icon-btn" data-act="del" data-id="${x.id}">🗑️</button>` }
      ]
    });
    App.on(el, {
      add: () => rxForm(p),
      edit: id => rxForm(p, App.byId('prescriptions', id)),
      del: async id => { if (await App.remove('prescriptions', id)) App.render(); },
      print: id => printRx(p, App.byId('prescriptions', id))
    });
  }
  function rxForm(p, x = {}) {
    let items = (x.items || []).map(i => ({ ...i }));
    if (!items.length) items.push({ name: '', qty: 1, unit: 'Viên', usage: '' });
    const fields = [
      { name: 'date', label: 'Ngày kê', type: 'date', required: true, default: App.today },
      { name: 'doctorId', label: 'Bác sĩ kê đơn', type: 'select', options: () => App.staffOptions(['doctor']) },
      { name: 'diagnosis', label: 'Chẩn đoán', full: true },
      { name: 'advice', label: 'Lời dặn', type: 'textarea' }
    ];
    const m = App.formModal({
      title: x.id ? 'Sửa đơn thuốc' : 'Thêm đơn thuốc', size: 'lg', data: x, fields,
      extraHtml: `<h4 class="mt mb">Danh sách thuốc</h4><datalist id="med-list">${App.S.medicines.map(m => `<option value="${App.esc(m.name)}">`).join('')}</datalist><div id="rx-items"></div><button type="button" class="btn sm mt" id="rx-add">+ Thêm thuốc</button>`,
      onRender: form => {
        const box = form.querySelector('#rx-items');
        const draw = () => {
          box.innerHTML = `<div class="table-wrap"><table class="tbl"><thead><tr><th>Tên thuốc</th><th style="width:80px">SL</th><th style="width:90px">ĐVT</th><th>Cách dùng</th><th></th></tr></thead><tbody>
            ${items.map((i, k) => `<tr><td><input class="input" style="width:100%" list="med-list" data-k="${k}" data-f="name" value="${App.esc(i.name)}"></td><td><input class="input" style="width:70px" type="number" min="0" data-k="${k}" data-f="qty" value="${i.qty}"></td><td><input class="input" style="width:80px" data-k="${k}" data-f="unit" value="${App.esc(i.unit || '')}"></td><td><input class="input" style="width:100%" data-k="${k}" data-f="usage" value="${App.esc(i.usage || '')}"></td><td><button type="button" class="icon-btn" data-rm="${k}">✕</button></td></tr>`).join('')}</tbody></table></div>`;
        };
        draw();
        box.addEventListener('input', e => {
          const t = e.target; if (t.dataset.k == null) return;
          items[t.dataset.k][t.dataset.f] = t.dataset.f === 'qty' ? Number(t.value) : t.value;
          if (t.dataset.f === 'name') {
            const med = App.S.medicines.find(m => m.name === t.value);
            if (med) { items[t.dataset.k].unit = med.unit; items[t.dataset.k].usage = med.usage; draw(); }
          }
        });
        box.addEventListener('click', e => { const r = e.target.closest('[data-rm]'); if (r) { items.splice(Number(r.dataset.rm), 1); draw(); } });
        form.querySelector('#rx-add').onclick = () => { items.push({ name: '', qty: 1, unit: 'Viên', usage: '' }); draw(); };
      },
      onSubmit: async v => {
        const clean = items.filter(i => i.name.trim());
        if (!clean.length) { App.toast('Đơn thuốc cần ít nhất 1 thuốc', 'error'); return false; }
        await App.save('prescriptions', x.id, { ...v, items: clean, patientId: p.id });
        App.toast('Đã lưu đơn thuốc', 'success'); App.render();
      }
    });
    return m;
  }
  function printRx(p, x) {
    App.print(`<div class="print-title">ĐƠN THUỐC</div>
      <p>Họ tên: <b>${App.esc(p.name)}</b> &nbsp; Tuổi: ${App.age(p.dob)} &nbsp; Giới tính: ${App.esc(p.gender || '')}</p>
      <p>Địa chỉ: ${App.esc(p.address || '')} &nbsp; ĐT: ${App.esc(p.phone || '')}</p>
      <p>Chẩn đoán: ${App.esc(x.diagnosis || '')}</p>
      <table><tr><th>STT</th><th>Tên thuốc</th><th>SL</th><th>ĐVT</th><th>Cách dùng</th></tr>
      ${(x.items || []).map((i, k) => `<tr><td>${k + 1}</td><td>${App.esc(i.name)}</td><td>${i.qty}</td><td>${App.esc(i.unit || '')}</td><td>${App.esc(i.usage || '')}</td></tr>`).join('')}</table>
      <p><b>Lời dặn:</b> ${App.esc(x.advice || '')}</p>
      <div class="sign-row"><div></div><div>Ngày ${App.fmtDate(x.date)}<br>Bác sĩ kê đơn<br><br><br>${App.esc(App.nameOf('staff', x.doctorId))}</div></div>`);
  }

  /* ---------- Thư viện ảnh ---------- */
  function tabImages(el, p) {
    const list = App.sortBy(App.S.images.filter(x => x.patientId === p.id), x => x.createdAt, true);
    el.innerHTML = `<div class="card"><div class="card-head"><h3>Thư viện ảnh (${list.length})</h3><div class="spacer"></div>
      <select class="input" id="img-cat">${IMG_CATS.map(c => `<option>${c}</option>`).join('')}</select>
      <label class="btn primary">⬆ Tải ảnh lên<input type="file" id="img-file" accept="image/*,application/pdf" multiple hidden></label></div>
      ${IMG_CATS.filter(c => list.some(x => x.category === c)).map(c => `<h4 class="mb mt">${c}</h4><div class="gallery">${list.filter(x => x.category === c).map(x => `
        <div class="ph">${/\.pdf$/i.test(x.url) ? `<a href="${App.uploadUrl(x.url)}" target="_blank" style="display:grid;place-items:center;height:130px;font-size:40px">📄</a>` : `<img src="${App.uploadUrl(x.url)}" data-img="${App.esc(x.url)}" data-act="view" data-id="${x.id}" loading="lazy">`}
        <div class="cap"><span>${App.esc(x.caption || App.fmtDate(x.createdAt))}</span><button class="icon-btn" data-act="del" data-id="${x.id}">🗑️</button></div></div>`).join('')}</div>`).join('') || '<div class="muted">Chưa có ảnh nào</div>'}</div>`;
    App.hydrateImages(el);
    el.querySelector('#img-file').onchange = async e => {
      const files = [...e.target.files]; const category = el.querySelector('#img-cat').value;
      App.toast(`Đang tải ${files.length} file...`);
      for (const f of files) {
        try {
          const dataUrl = await App.compressImage(f);
          const up = await App.api('POST', 'upload', { dataUrl, name: f.name });
          await App.create('images', { patientId: p.id, url: up.url, caption: f.name.replace(/\.[^.]+$/, ''), category });
        } catch (err) { App.toast(f.name + ': ' + err.message, 'error'); }
      }
      App.toast('Đã tải ảnh lên', 'success'); App.render();
    };
    App.on(el, {
      view: id => { const x = App.byId('images', id); const m = App.modal({ title: x.caption || 'Ảnh', size: 'xl', body: `<img src="${App.uploadUrl(x.url)}" data-img="${App.esc(x.url)}" style="width:100%">` }); App.hydrateImages(m.body); },
      del: async id => { if (await App.remove('images', id)) App.render(); }
    });
  }

  /* ---------- Xưởng / Labo ---------- */
  function tabLabs(el, p) {
    el.innerHTML = `<div class="card"><div class="card-head"><h3>Đặt xưởng / Labo</h3><div class="spacer"></div><button class="btn primary" data-act="add">+ Thêm đơn xưởng</button></div><div id="t"></div></div>`;
    App.labTable(el.querySelector('#t'), App.S.labOrders.filter(x => x.patientId === p.id), false);
    App.on(el, { add: () => App.labForm({ patientId: p.id }) });
  }

  /* ---------- Lịch hẹn ---------- */
  function tabAppts(el, p) {
    const list = App.sortBy(App.S.appointments.filter(x => x.patientId === p.id), x => x.date + (x.time || ''), true);
    el.innerHTML = `<div class="card"><div class="card-head"><h3>Lịch hẹn</h3><div class="spacer"></div><button class="btn primary" data-act="add">+ Thêm lịch hẹn</button></div><div id="t"></div></div>`;
    App.table(el.querySelector('#t'), {
      rows: list, empty: 'Chưa có lịch hẹn',
      columns: [
        { label: 'Ngày', render: a => App.fmtDate(a.date) }, { label: 'Giờ', render: a => App.esc(a.time || '') },
        { label: 'Bác sĩ', render: a => App.esc(App.nameOf('staff', a.doctorId)) }, { label: 'Nội dung', render: a => App.esc(a.content || '') },
        { label: 'Chi nhánh', render: a => App.esc(App.nameOf('branches', a.branchId)) }, { label: 'Trạng thái', render: a => App.apptBadge(a.status || 'scheduled') },
        { label: 'Ghi chú', render: a => App.esc(a.note || '') }
      ],
      onRow: a => App.appointmentForm(a)
    });
    App.on(el, { add: () => App.appointmentForm({ patientId: p.id }) });
  }

  /* ---------- Thanh toán ---------- */
  App.paymentForm = function (pid, x = {}) {
    const fin = App.patientFinance(pid);
    App.formModal({
      title: x.id ? 'Sửa phiếu thanh toán' : 'Thanh toán', size: 'lg',
      data: { amount: x.id ? x.amount : Math.max(0, fin.debt), type: 'thu', ...x },
      extraHtml: `<div class="money-row mt"><div><span>Đã điều trị</span><b>${App.money(fin.treated)}</b></div><div><span>Đã thanh toán</span><b>${App.money(fin.paid)}</b></div><div><span>Còn nợ</span><b class="text-red">${App.money(fin.debt)}</b></div><div><span>Tổng kế hoạch còn lại</span><b>${App.money(fin.planTotal - fin.paid)}</b></div></div>`,
      fields: [
        { name: 'type', label: 'Loại', type: 'select', required: true, noEmpty: true, options: [{ value: 'thu', label: 'Khách thanh toán / đặt cọc' }, { value: 'chi', label: 'Hoàn tiền cho khách' }] },
        { name: 'date', label: 'Ngày', type: 'date', required: true, default: App.today },
        { name: 'amount', label: 'Số tiền', type: 'money', required: true },
        { name: 'method', label: 'Phương thức', type: 'select', required: true, noEmpty: true, options: App.PAY_METHODS },
        { name: 'staffId', label: 'Nhân viên thu', type: 'select', options: () => App.staffOptions() },
        { name: 'branchId', label: 'Chi nhánh', type: 'select', options: () => App.S.branches.map(b => ({ value: b.id, label: b.name })), default: App.byId('patients', pid)?.branchId },
        { name: 'content', label: 'Nội dung', type: 'textarea', default: 'Thanh toán chi phí điều trị' }
      ],
      onSubmit: async v => {
        if (!(v.amount > 0)) { App.toast('Số tiền phải lớn hơn 0', 'error'); return false; }
        const cat = App.S.txCategories.find(c => c.type === v.type && /điều trị/i.test(c.name)) || App.S.txCategories.find(c => c.type === v.type);
        const p = App.byId('patients', pid);
        const saved = await App.save('transactions', x.id, { ...v, patientId: pid, categoryId: x.categoryId || cat?.id, person: p.name, group: 'Khách hàng' });
        App.toast('Đã lưu phiếu ' + (v.type === 'thu' ? 'thu' : 'chi'), 'success');
        App.render();
        if (!x.id && await App.confirm('In phiếu thu?')) App.printReceipt(saved);
      }
    });
  };
  App.printReceipt = function (t) {
    const p = App.byId('patients', t.patientId);
    const fin = p ? App.patientFinance(p.id) : null;
    App.print(`<div class="print-title">${t.type === 'chi' ? 'PHIẾU CHI' : 'PHIẾU THU'}</div>
      <p style="text-align:center">Số: ${App.esc(t.code)} &nbsp; Ngày: ${App.fmtDate(t.date)}</p>
      <p>${t.type === 'chi' ? 'Người nhận' : 'Người nộp'}: <b>${App.esc(t.person || p?.name || '')}</b> ${p ? `(${App.esc(p.code)})` : ''}</p>
      <p>Nội dung: ${App.esc(t.content || '')}</p>
      <p>Số tiền: <b>${App.money(t.amount)} VNĐ</b> &nbsp; Hình thức: ${App.esc(t.method || '')}</p>
      ${fin ? `<p>Tổng điều trị: ${App.money(fin.treated)} · Đã thanh toán: ${App.money(fin.paid)} · Còn nợ: ${App.money(fin.debt)}</p>` : ''}
      <div class="sign-row"><div>Người nộp<br><br><br></div><div>Người lập phiếu<br><br><br>${App.esc(App.nameOf('staff', t.staffId))}</div></div>`);
  };
  function tabPay(el, p) {
    const fin = App.patientFinance(p.id);
    const list = App.sortBy(App.S.transactions.filter(x => x.patientId === p.id), x => x.date + x.createdAt, true);
    el.innerHTML = `<div class="grid g4 mb">
        <div class="stat"><div class="label">Tổng kế hoạch</div><div class="value">${App.money(fin.planTotal)}</div></div>
        <div class="stat blue"><div class="label">Đã điều trị</div><div class="value">${App.money(fin.treated)}</div></div>
        <div class="stat"><div class="label">Đã thanh toán</div><div class="value">${App.money(fin.paid)}</div></div>
        <div class="stat red"><div class="label">Còn nợ</div><div class="value">${App.money(fin.debt)}</div></div></div>
      <div class="card"><div class="card-head"><h3>Lịch sử thanh toán</h3><div class="spacer"></div><button class="btn primary" data-act="add">+ Thanh toán</button></div><div id="t"></div></div>`;
    App.table(el.querySelector('#t'), {
      rows: list, empty: 'Chưa có giao dịch',
      columns: [
        { label: 'Mã phiếu', render: t => App.esc(t.code) }, { label: 'Ngày', render: t => App.fmtDate(t.date) },
        { label: 'Loại', render: t => t.type === 'thu' ? App.badge('Thu', 'green') : App.badge('Hoàn tiền', 'red') },
        { label: 'Số tiền', cls: 'num', render: t => `<b>${App.money(t.amount)}</b>` }, { label: 'Phương thức', render: t => App.esc(t.method || '') },
        { label: 'Nhân viên', render: t => App.esc(App.nameOf('staff', t.staffId)) }, { label: 'Nội dung', render: t => App.esc(t.content || '') },
        { label: '', cls: 'center', render: t => `<button class="btn sm" data-act="print" data-id="${t.id}">🖨</button> <button class="icon-btn" data-act="edit" data-id="${t.id}">✏️</button><button class="icon-btn" data-act="del" data-id="${t.id}">🗑️</button>` }
      ]
    });
    App.on(el, {
      add: () => App.paymentForm(p.id),
      edit: id => App.paymentForm(p.id, App.byId('transactions', id)),
      del: async id => { if (await App.remove('transactions', id)) App.render(); },
      print: id => App.printReceipt(App.byId('transactions', id))
    });
  }

  /* ---------- Chăm sóc ---------- */
  function tabCare(el, p) {
    el.innerHTML = `<div class="card"><div class="card-head"><h3>Lịch chăm sóc</h3><div class="spacer"></div><button class="btn primary" data-act="add">+ Thêm lịch chăm sóc</button></div><div id="t"></div></div>`;
    App.careTable(el.querySelector('#t'), App.sortBy(App.S.careTasks.filter(x => x.patientId === p.id), x => x.date, true));
    App.on(el, { add: () => App.careForm({ patientId: p.id }) });
  }

  /* ---------- Lịch sử thao tác ---------- */
  const COL_NAMES = { patients: 'Khách hàng', exams: 'Phiếu khám', treatmentPlans: 'Kế hoạch điều trị', treatmentSessions: 'Tiến trình điều trị', prescriptions: 'Đơn thuốc', images: 'Ảnh', labOrders: 'Đơn xưởng', appointments: 'Lịch hẹn', careTasks: 'Chăm sóc', transactions: 'Thanh toán' };
  const ACT = { create: ['Thêm', 'green'], update: ['Sửa', 'blue'], delete: ['Xóa', 'red'] };
  App.COL_NAMES = COL_NAMES; App.LOG_ACT = ACT;
  async function tabHistory(el, p) {
    el.innerHTML = '<div class="card"><div class="muted">Đang tải...</div></div>';
    const logs = await App.api('GET', 'logs?patientId=' + encodeURIComponent(p.id));
    el.innerHTML = '<div class="card"><div class="card-head"><h3>Lịch sử thao tác</h3></div><div id="t"></div></div>';
    App.table(el.querySelector('#t'), {
      rows: logs, pageSize: 30, empty: 'Chưa có thao tác',
      columns: [
        { label: 'Thời gian', render: l => App.fmtDateTime(l.at) }, { label: 'Người thực hiện', render: l => App.esc(l.userName || '') },
        { label: 'Hành động', render: l => { const [t, c] = ACT[l.action] || [l.action, 'gray']; return App.badge(t, c); } },
        { label: 'Đối tượng', render: l => App.esc(COL_NAMES[l.collection] || l.collection) }, { label: 'Chi tiết', render: l => App.esc(l.summary || '') }
      ]
    });
  }
})();
