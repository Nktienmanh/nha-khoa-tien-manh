/* Chăm sóc khách hàng (CSKH) */
(function () {
  App.CARE_TYPES = { care: 'Chăm sóc định kỳ', appt_remind: 'Nhắc lịch hẹn', med_remind: 'Nhắc uống thuốc', followup: 'Hỏi thăm sau điều trị', birthday: 'Chúc mừng sinh nhật', consult: 'Tư vấn / Báo giá', other: 'Khác' };
  App.CARE_CHANNELS = ['Gọi điện', 'Zalo', 'SMS', 'Facebook', 'Gặp trực tiếp'];

  App.careForm = function (x = {}) {
    App.formModal({
      title: x.id ? 'Cập nhật chăm sóc' : 'Thêm lịch chăm sóc', size: 'lg', data: x,
      fields: [
        { name: 'patientId', label: 'Khách hàng', type: 'patient', required: true, full: true },
        { name: 'type', label: 'Loại chăm sóc', type: 'select', required: true, noEmpty: true, options: Object.entries(App.CARE_TYPES).map(([value, label]) => ({ value, label })) },
        { name: 'date', label: 'Ngày chăm sóc', type: 'date', required: true, default: App.today },
        { name: 'channel', label: 'Kênh', type: 'select', options: App.CARE_CHANNELS },
        { name: 'staffId', label: 'Nhân viên phụ trách', type: 'select', options: () => App.staffOptions() },
        { name: 'content', label: 'Nội dung', type: 'textarea' },
        { name: 'status', label: 'Trạng thái', type: 'select', noEmpty: true, required: true, options: [{ value: 'pending', label: 'Chưa thực hiện' }, { value: 'done', label: 'Đã thực hiện' }, { value: 'failed', label: 'Không liên lạc được' }], default: 'pending' },
        { name: 'result', label: 'Kết quả / phản hồi của khách', type: 'textarea' }
      ],
      onSubmit: async v => { await App.save('careTasks', x.id, v); App.toast('Đã lưu', 'success'); App.render(); }
    });
  };
  const ST = { pending: ['Chưa thực hiện', 'orange'], done: ['Đã thực hiện', 'green'], failed: ['Không liên lạc được', 'red'] };
  App.careTable = function (container, rows) {
    App.table(container, {
      rows, empty: 'Không có lịch chăm sóc',
      columns: [
        { label: 'Ngày', render: c => `${App.fmtDate(c.date)}${c.status === 'pending' && c.date < App.today() ? ' <span class="badge red">Quá hạn</span>' : ''}` },
        { label: 'Khách hàng', render: c => { const p = App.byId('patients', c.patientId); return p ? `<a href="#/patient/${p.id}/care">${App.esc(p.name)}</a><div class="small muted">${App.esc(p.phone || '')}</div>` : ''; } },
        { label: 'Loại', render: c => App.esc(App.CARE_TYPES[c.type] || '') },
        { label: 'Kênh', render: c => App.esc(c.channel || '') },
        { label: 'Nội dung', render: c => App.esc(c.content || '') },
        { label: 'Nhân viên', render: c => App.esc(App.nameOf('staff', c.staffId)) },
        { label: 'Trạng thái', render: c => { const [t, k] = ST[c.status] || ST.pending; return App.badge(t, k); } },
        { label: 'Kết quả', render: c => App.esc(c.result || '') },
        { label: '', cls: 'center', render: c => `${c.status !== 'done' ? `<button class="btn sm" data-act="care-done" data-id="${c.id}">✔ Xong</button>` : ''}<button class="icon-btn" data-act="care-edit" data-id="${c.id}">✏️</button><button class="icon-btn" data-act="care-del" data-id="${c.id}">🗑️</button>` }
      ]
    });
    if (!container._bound) {
      container._bound = true;
      App.on(container, {
        'care-done': id => App.careForm({ ...App.byId('careTasks', id), status: 'done' }),
        'care-edit': id => App.careForm(App.byId('careTasks', id)),
        'care-del': async id => { if (await App.remove('careTasks', id)) App.render(); }
      });
    }
  };

  /* Ghi nhận nhanh 1 lần nhắc/hỏi thăm gắn với đối tượng gốc (lịch hẹn, đơn thuốc, lần điều trị) */
  const doneFor = (type, refId) => App.S.careTasks.find(c => c.type === type && c.refId === refId);
  function quickLog(type, refId, patientId, content) {
    App.formModal({
      title: 'Ghi nhận: ' + App.CARE_TYPES[type], size: 'sm',
      fields: [
        { name: 'channel', label: 'Kênh', type: 'select', options: App.CARE_CHANNELS, default: 'Gọi điện', full: true },
        { name: 'status', label: 'Trạng thái', type: 'select', required: true, noEmpty: true, full: true, options: [{ value: 'done', label: 'Đã thực hiện' }, { value: 'failed', label: 'Không liên lạc được' }] },
        { name: 'result', label: 'Kết quả / phản hồi', type: 'textarea' }
      ],
      onSubmit: async v => { await App.create('careTasks', { ...v, type, refId, patientId, content, date: App.today(), staffId: App.user.staffId || '' }); App.toast('Đã ghi nhận', 'success'); App.render(); }
    });
  }

  const state = { tab: 'schedule', from: App.addDays(App.today(), -30), to: App.addDays(App.today(), 30), status: 'pending', q: '' };
  const TABS = [['schedule', 'Lịch chăm sóc'], ['appt', 'Nhắc lịch hẹn'], ['med', 'Nhắc lịch uống thuốc'], ['follow', 'Hỏi thăm sau điều trị'], ['birthday', 'Ngày sinh nhật']];

  App.routes.care = {
    title: 'Chăm sóc khách hàng',
    render(el) {
      el.innerHTML = `<div class="tabs">${TABS.map(([k, l]) => `<div class="tab ${state.tab === k ? 'active' : ''}" data-tab="${k}">${l}</div>`).join('')}</div><div class="card" id="cbody"></div>`;
      el.querySelector('.tabs').onclick = e => { const t = e.target.closest('[data-tab]'); if (t) { state.tab = t.dataset.tab; App.render(); } };
      const body = el.querySelector('#cbody');
      const pName = id => { const p = App.byId('patients', id); return p ? `<a href="#/patient/${p.id}">${App.esc(p.name)}</a><div class="small muted">${App.esc(p.phone || '')}</div>` : ''; };
      const doneCell = (type, refId) => { const d = doneFor(type, refId); return d ? `${App.badge(d.status === 'done' ? 'Đã thực hiện' : 'Không liên lạc được', d.status === 'done' ? 'green' : 'red')}<div class="small muted">${App.esc(d.result || '')}</div>` : App.badge('Chưa thực hiện', 'orange'); };
      const btn = (type, refId, pid) => doneFor(type, refId) ? '' : `<button class="btn sm primary" data-act="log" data-type="${type}" data-ref="${refId}" data-pid="${pid}">Ghi nhận</button>`;

      if (state.tab === 'schedule') {
        body.innerHTML = `<div class="toolbar"><input type="search" class="input" id="cq" placeholder="Tìm khách hàng..." value="${App.esc(state.q)}">${App.rangeInputs(state.from, state.to)}
          <select class="input" id="cst"><option value="">Tất cả trạng thái</option>${Object.entries(ST).map(([k, [t]]) => `<option value="${k}" ${state.status === k ? 'selected' : ''}>${t}</option>`).join('')}</select>
          <div class="spacer"></div><button class="btn primary" data-act="add">+ Thêm lịch chăm sóc</button></div><div id="t"></div>`;
        const draw = () => {
          const rows = App.sortBy(App.S.careTasks.filter(c => App.inRange(c.date, state.from, state.to) && (!state.status || c.status === state.status)
            && (!state.q || App.match(state.q, App.nameOf('patients', c.patientId), App.nameOf('patients', c.patientId, 'phone')))), c => c.date);
          App.careTable(body.querySelector('#t'), rows);
        };
        draw();
        App.bindRange(body, (f, t) => { state.from = f; state.to = t; draw(); });
        body.querySelector('#cst').onchange = e => { state.status = e.target.value; draw(); };
        body.querySelector('#cq').oninput = e => { state.q = e.target.value; draw(); };
      }
      if (state.tab === 'appt') {
        const d0 = App.today();
        const rows = App.sortBy(App.S.appointments.filter(a => a.date >= d0 && a.date <= App.addDays(d0, 3) && ['scheduled', 'confirmed'].includes(a.status || 'scheduled')), a => a.date + (a.time || ''));
        body.innerHTML = '<div class="muted mb">Lịch hẹn trong 3 ngày tới cần nhắc khách.</div><div id="t"></div>';
        App.table(body.querySelector('#t'), {
          rows, empty: 'Không có lịch hẹn cần nhắc',
          columns: [
            { label: 'Ngày hẹn', render: a => `${App.fmtDate(a.date)} ${App.esc(a.time || '')}` }, { label: 'Khách hàng', render: a => pName(a.patientId) },
            { label: 'Bác sĩ', render: a => App.esc(App.nameOf('staff', a.doctorId)) }, { label: 'Nội dung', render: a => App.esc(a.content || '') },
            { label: 'Trạng thái nhắc', render: a => doneCell('appt_remind', a.id) },
            { label: '', render: a => `${btn('appt_remind', a.id, a.patientId)} ${a.status !== 'confirmed' ? `<button class="btn sm" data-act="confirm-appt" data-id="${a.id}">Khách xác nhận</button>` : ''}` }
          ]
        });
      }
      if (state.tab === 'med') {
        const rows = App.sortBy(App.S.prescriptions.filter(r => r.date >= App.addDays(App.today(), -7)), r => r.date, true);
        body.innerHTML = '<div class="muted mb">Đơn thuốc kê trong 7 ngày gần nhất.</div><div id="t"></div>';
        App.table(body.querySelector('#t'), {
          rows, empty: 'Không có đơn thuốc gần đây',
          columns: [
            { label: 'Ngày kê', render: r => App.fmtDate(r.date) }, { label: 'Khách hàng', render: r => pName(r.patientId) },
            { label: 'Thuốc', render: r => (r.items || []).map(i => App.esc(i.name)).join(', ') }, { label: 'Trạng thái', render: r => doneCell('med_remind', r.id) },
            { label: '', render: r => btn('med_remind', r.id, r.patientId) }
          ]
        });
      }
      if (state.tab === 'follow') {
        const rows = App.sortBy(App.S.treatmentSessions.filter(s => s.date >= App.addDays(App.today(), -7) && s.date <= App.today()), s => s.date, true);
        body.innerHTML = '<div class="muted mb">Khách hàng điều trị trong 7 ngày gần nhất cần hỏi thăm.</div><div id="t"></div>';
        App.table(body.querySelector('#t'), {
          rows, empty: 'Không có khách cần hỏi thăm',
          columns: [
            { label: 'Ngày điều trị', render: s => App.fmtDate(s.date) }, { label: 'Khách hàng', render: s => pName(s.patientId) },
            { label: 'Thủ thuật', render: s => App.esc(s.serviceName || '') }, { label: 'Bác sĩ', render: s => App.esc(App.nameOf('staff', s.doctorId)) },
            { label: 'Trạng thái', render: s => doneCell('followup', s.id) }, { label: '', render: s => btn('followup', s.id, s.patientId) }
          ]
        });
      }
      if (state.tab === 'birthday') {
        const m = App.today().slice(5, 7);
        const rows = App.sortBy(App.S.patients.filter(p => p.dob && p.dob.slice(5, 7) === m), p => p.dob.slice(8));
        body.innerHTML = `<div class="muted mb">Khách hàng có sinh nhật trong tháng ${Number(m)}.</div><div id="t"></div>`;
        const year = App.today().slice(0, 4);
        App.table(body.querySelector('#t'), {
          rows, empty: 'Không có khách sinh nhật tháng này',
          columns: [
            { label: 'Ngày sinh', render: p => `${App.fmtDate(p.dob)}${p.dob.slice(5) === App.today().slice(5) ? ' ' + App.badge('Hôm nay', 'red') : ''}` },
            { label: 'Khách hàng', render: p => pName(p.id) }, { label: 'Tuổi', render: p => App.age(p.dob) + 1 },
            { label: 'Trạng thái', render: p => doneCell('birthday', p.id + '_' + year) }, { label: '', render: p => btn('birthday', p.id + '_' + year, p.id) }
          ]
        });
      }
      App.on(el, {
        add: () => App.careForm({}),
        log: (_, b) => quickLog(b.dataset.type, b.dataset.ref, b.dataset.pid, App.CARE_TYPES[b.dataset.type]),
        'confirm-appt': async id => { await App.update('appointments', id, { status: 'confirmed' }); App.render(); }
      });
    }
  };
})();
