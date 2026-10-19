/* Quản lý lịch hẹn: lịch ngày / tuần / tháng và danh sách */
(function () {
  const WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const state = { view: 'day', date: App.today(), doctor: '', branch: '' };

  App.appointmentForm = function (x = {}) {
    const statusOpts = Object.entries(App.APPT_STATUS).map(([value, [label]]) => ({ value, label }));
    App.formModal({
      title: x.id ? 'Sửa lịch hẹn' : 'Thêm lịch hẹn', size: 'lg',
      data: { status: 'scheduled', duration: App.S.settings.slotMinutes || 30, branchId: App.S.branches[0]?.id, ...x, isNew: false },
      fields: [
        { name: 'isNew', label: 'Khách hàng mới', type: 'checkbox', checkLabel: 'Khách chưa có hồ sơ (tạo nhanh)', full: true, show: () => !x.id },
        { name: 'patientId', label: 'Khách hàng', type: 'patient', full: true, show: v => !v.isNew },
        { name: 'newName', label: 'Họ tên khách mới', show: v => v.isNew },
        { name: 'newPhone', label: 'SĐT khách mới', type: 'tel', show: v => v.isNew },
        { name: 'date', label: 'Ngày hẹn', type: 'date', required: true, default: state.date || App.today() },
        { name: 'time', label: 'Giờ hẹn', type: 'time', required: true, default: '09:00' },
        { name: 'duration', label: 'Thời lượng (phút)', type: 'number', min: 5, step: 5 },
        { name: 'doctorId', label: 'Bác sĩ', type: 'select', options: () => App.staffOptions(['doctor']) },
        { name: 'branchId', label: 'Chi nhánh', type: 'select', options: () => App.S.branches.map(b => ({ value: b.id, label: b.name })) },
        { name: 'status', label: 'Trạng thái', type: 'select', required: true, noEmpty: true, options: statusOpts },
        { name: 'content', label: 'Nội dung hẹn', full: true, placeholder: 'Khám tổng quát, nhổ răng, tái khám...' },
        { name: 'note', label: 'Ghi chú', type: 'textarea' }
      ],
      extraHtml: x.id ? `<div class="flex mt"><button type="button" class="btn danger" id="appt-del">🗑️ Xóa lịch hẹn</button>${x.patientId ? `<a class="btn" href="#/patient/${x.patientId}" id="appt-open">Mở hồ sơ khách</a>` : ''}</div>` : '',
      onRender: (form, m) => {
        const del = form.querySelector('#appt-del');
        if (del) del.onclick = async () => { if (await App.remove('appointments', x.id)) { m.close(); App.render(); } };
        form.querySelector('#appt-open')?.addEventListener('click', () => m.close());
      },
      onSubmit: async v => {
        let patientId = v.patientId;
        if (v.isNew) {
          if (!v.newName) { App.toast('Nhập họ tên khách mới', 'error'); return false; }
          const p = await App.create('patients', { name: v.newName, phone: v.newPhone, branchId: v.branchId });
          patientId = p.id;
        }
        if (!patientId) { App.toast('Chọn khách hàng', 'error'); return false; }
        const clash = v.doctorId && App.S.appointments.find(a => a.id !== x.id && a.doctorId === v.doctorId && a.date === v.date && a.time === v.time && !['cancelled', 'no_show'].includes(a.status));
        if (clash && !(await App.confirm(`Bác sĩ đã có lịch hẹn lúc ${v.time} ngày ${App.fmtDate(v.date)}. Vẫn lưu?`))) return false;
        const { isNew, newName, newPhone, ...data } = v;
        await App.save('appointments', x.id, { ...data, patientId });
        App.toast('Đã lưu lịch hẹn', 'success'); App.render();
      }
    });
  };

  const filtered = () => App.S.appointments.filter(a => (!state.doctor || a.doctorId === state.doctor) && (!state.branch || a.branchId === state.branch));
  const chip = a => { const p = App.byId('patients', a.patientId); return `<div class="appt-chip ${a.status || ''}" data-appt="${a.id}" title="${App.esc((p?.name || '') + ' - ' + (a.content || ''))}">${App.esc(a.time || '')} ${App.esc(p?.name || '?')}${a.content ? ' · ' + App.esc(a.content) : ''}${a.doctorId ? ` <i>(${App.esc(App.nameOf('staff', a.doctorId))})</i>` : ''}</div>`; };
  const weekStart = d => { const x = new Date(d + 'T00:00:00'); const wd = (x.getDay() + 6) % 7; return App.addDays(d, -wd); };

  App.routes.appointments = {
    title: 'Lịch hẹn',
    render(el) {
      const d = new Date(state.date + 'T00:00:00');
      const label = state.view === 'day' ? `${WD[d.getDay()]}, ${App.fmtDate(state.date)}` : state.view === 'week' ? `${App.fmtDate(weekStart(state.date))} - ${App.fmtDate(App.addDays(weekStart(state.date), 6))}` : `Tháng ${d.getMonth() + 1}/${d.getFullYear()}`;
      el.innerHTML = `<div class="card"><div class="toolbar">
        <div class="seg">${[['day', 'Ngày'], ['week', 'Tuần'], ['month', 'Tháng']].map(([k, l]) => `<button data-view="${k}" class="${state.view === k ? 'active' : ''}">${l}</button>`).join('')}</div>
        <button class="btn" data-nav="-1">‹</button><button class="btn" data-nav="0">Hôm nay</button><button class="btn" data-nav="1">›</button>
        <input type="date" class="input" id="adate" value="${state.date}"><b>${label}</b>
        <div class="spacer"></div>
        <select class="input" id="adoc"><option value="">Tất cả bác sĩ</option>${App.staffOptions(['doctor']).map(o => `<option value="${o.value}" ${state.doctor === o.value ? 'selected' : ''}>${App.esc(o.label)}</option>`).join('')}</select>
        <select class="input" id="abr"><option value="">Tất cả chi nhánh</option>${App.S.branches.map(b => `<option value="${b.id}" ${state.branch === b.id ? 'selected' : ''}>${App.esc(b.name)}</option>`).join('')}</select>
        <button class="btn primary" id="aadd">+ Thêm lịch hẹn</button></div>
        <div id="cal"></div>
        <div class="legend-inline mt">${Object.entries(App.APPT_STATUS).map(([k, [t]]) => `<span><span class="appt-chip ${k}" style="display:inline-block">${t}</span></span>`).join('')}</div></div>`;
      const cal = el.querySelector('#cal');
      const list = filtered();
      if (state.view === 'day') {
        const s = App.S.settings; const step = Number(s.slotMinutes) || 30;
        const toMin = t => { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
        const start = toMin(s.workStart || '08:00'), end = toMin(s.workEnd || '20:00');
        const dayAppts = list.filter(a => a.date === state.date);
        let html = '';
        for (let t = start; t < end; t += step) {
          const hh = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
          const inSlot = dayAppts.filter(a => { const m = toMin(a.time); return m >= t && m < t + step; });
          html += `<div class="slot-t">${hh}</div><div class="slot" data-slot="${hh}">${App.sortBy(inSlot, a => a.time).map(chip).join('')}</div>`;
        }
        const outside = dayAppts.filter(a => toMin(a.time) < start || toMin(a.time) >= end);
        if (outside.length) html += `<div class="slot-t">Ngoài giờ</div><div class="slot">${outside.map(chip).join('')}</div>`;
        cal.innerHTML = `<div class="day-view">${html}</div>`;
      } else if (state.view === 'week') {
        const ws = weekStart(state.date); const days = [...Array(7)].map((_, i) => App.addDays(ws, i));
        const hours = []; for (let h = Number((App.S.settings.workStart || '08').slice(0, 2)); h < Number((App.S.settings.workEnd || '20').slice(0, 2)); h++) hours.push(h);
        let html = '<div class="wh"></div>' + days.map(dd => `<div class="wh" style="${dd === App.today() ? 'background:var(--primary)' : ''}">${WD[new Date(dd + 'T00:00:00').getDay()]} ${dd.slice(8)}/${dd.slice(5, 7)}</div>`).join('');
        for (const h of hours) {
          html += `<div class="wt">${String(h).padStart(2, '0')}:00</div>`;
          for (const dd of days) html += `<div data-day="${dd}" data-hour="${h}" style="cursor:pointer">${App.sortBy(list.filter(a => a.date === dd && Number(String(a.time).slice(0, 2)) === h), a => a.time).map(chip).join('')}</div>`;
        }
        cal.innerHTML = `<div class="week-grid">${html}</div>`;
      } else {
        const first = state.date.slice(0, 8) + '01'; const gs = weekStart(first);
        let html = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(w => `<div class="dh">${w}</div>`).join('');
        for (let i = 0; i < 42; i++) {
          const dd = App.addDays(gs, i);
          const items = App.sortBy(list.filter(a => a.date === dd), a => a.time || '');
          html += `<div class="cal-cell ${dd.slice(0, 7) !== state.date.slice(0, 7) ? 'other' : ''} ${dd === App.today() ? 'today' : ''}" data-day="${dd}"><div class="d">${Number(dd.slice(8))}</div>${items.slice(0, 4).map(chip).join('')}${items.length > 4 ? `<div class="small muted">+${items.length - 4} lịch khác</div>` : ''}</div>`;
        }
        cal.innerHTML = `<div class="cal-grid">${html}</div>`;
      }
      cal.addEventListener('click', e => {
        const c = e.target.closest('[data-appt]');
        if (c) return App.appointmentForm(App.byId('appointments', c.dataset.appt));
        const slot = e.target.closest('[data-slot]');
        if (slot) return App.appointmentForm({ date: state.date, time: slot.dataset.slot, doctorId: state.doctor });
        const day = e.target.closest('[data-day]');
        if (day) {
          if (state.view === 'month') { state.date = day.dataset.day; state.view = 'day'; return App.render(); }
          return App.appointmentForm({ date: day.dataset.day, time: String(day.dataset.hour).padStart(2, '0') + ':00', doctorId: state.doctor });
        }
      });
      el.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { state.view = b.dataset.view; App.render(); });
      el.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => {
        const n = Number(b.dataset.nav);
        if (!n) state.date = App.today();
        else if (state.view === 'day') state.date = App.addDays(state.date, n);
        else if (state.view === 'week') state.date = App.addDays(state.date, 7 * n);
        else { const x = new Date(state.date.slice(0, 8) + '01T00:00:00'); x.setMonth(x.getMonth() + n); state.date = App.isoDate(x); }
        App.render();
      });
      el.querySelector('#adate').onchange = e => { state.date = e.target.value || App.today(); App.render(); };
      el.querySelector('#adoc').onchange = e => { state.doctor = e.target.value; App.render(); };
      el.querySelector('#abr').onchange = e => { state.branch = e.target.value; App.render(); };
      el.querySelector('#aadd').onclick = () => App.appointmentForm({ date: state.date, doctorId: state.doctor });
    }
  };

  const ls = { from: App.today(), to: App.addDays(App.today(), 30), status: '', q: '', doctor: '' };
  App.routes['appointment-list'] = {
    title: 'Danh sách lịch hẹn',
    render(el) {
      el.innerHTML = `<div class="card"><div class="toolbar">
        <input type="search" class="input" id="lq" placeholder="Tìm khách hàng..." value="${App.esc(ls.q)}">${App.rangeInputs(ls.from, ls.to)}
        <select class="input" id="lst"><option value="">Tất cả trạng thái</option>${Object.entries(App.APPT_STATUS).map(([k, [t]]) => `<option value="${k}" ${ls.status === k ? 'selected' : ''}>${t}</option>`).join('')}</select>
        <select class="input" id="ldoc"><option value="">Tất cả bác sĩ</option>${App.staffOptions(['doctor']).map(o => `<option value="${o.value}" ${ls.doctor === o.value ? 'selected' : ''}>${App.esc(o.label)}</option>`).join('')}</select>
        <div class="spacer"></div><button class="btn" id="lexp">⬇ Xuất Excel</button><button class="btn primary" id="ladd">+ Thêm lịch hẹn</button></div><div id="t"></div></div>`;
      let rows = [];
      const draw = () => {
        rows = App.sortBy(App.S.appointments.filter(a => App.inRange(a.date, ls.from, ls.to) && (!ls.status || (a.status || 'scheduled') === ls.status) && (!ls.doctor || a.doctorId === ls.doctor)
          && (!ls.q || App.match(ls.q, App.nameOf('patients', a.patientId), App.nameOf('patients', a.patientId, 'phone'), a.code))), a => a.date + (a.time || ''));
        App.table(el.querySelector('#t'), {
          rows, empty: 'Không có lịch hẹn',
          columns: [
            { label: 'Mã', render: a => App.esc(a.code || '') }, { label: 'Ngày', render: a => App.fmtDate(a.date) }, { label: 'Giờ', render: a => App.esc(a.time || '') },
            { label: 'Khách hàng', render: a => { const p = App.byId('patients', a.patientId); return p ? `<a href="#/patient/${p.id}/appts">${App.esc(p.name)}</a><div class="small muted">${App.esc(p.phone || '')}</div>` : ''; } },
            { label: 'Bác sĩ', render: a => App.esc(App.nameOf('staff', a.doctorId)) }, { label: 'Nội dung', render: a => App.esc(a.content || '') },
            { label: 'Chi nhánh', render: a => App.esc(App.nameOf('branches', a.branchId)) },
            { label: 'Trạng thái', render: a => `<select class="input" data-st="${a.id}">${Object.entries(App.APPT_STATUS).map(([k, [t]]) => `<option value="${k}" ${(a.status || 'scheduled') === k ? 'selected' : ''}>${t}</option>`).join('')}</select>` },
            { label: '', cls: 'center', render: a => `<button class="icon-btn" data-act="edit" data-id="${a.id}">✏️</button><button class="icon-btn" data-act="del" data-id="${a.id}">🗑️</button>` }
          ]
        });
      };
      draw();
      el.addEventListener('change', async e => { const s = e.target.closest('[data-st]'); if (s) { await App.update('appointments', s.dataset.st, { status: s.value }); App.toast('Đã cập nhật trạng thái', 'success'); } });
      App.bindRange(el, (f, t) => { ls.from = f; ls.to = t; draw(); });
      el.querySelector('#lst').onchange = e => { ls.status = e.target.value; draw(); };
      el.querySelector('#ldoc').onchange = e => { ls.doctor = e.target.value; draw(); };
      el.querySelector('#lq').oninput = e => { ls.q = e.target.value; draw(); };
      el.querySelector('#ladd').onclick = () => App.appointmentForm({});
      el.querySelector('#lexp').onclick = () => App.exportCSV('lich-hen.csv', [
        { label: 'Ngày', value: a => App.fmtDate(a.date) }, { label: 'Giờ', value: a => a.time }, { label: 'Khách hàng', value: a => App.nameOf('patients', a.patientId) },
        { label: 'SĐT', value: a => App.nameOf('patients', a.patientId, 'phone') }, { label: 'Bác sĩ', value: a => App.nameOf('staff', a.doctorId) },
        { label: 'Nội dung', value: a => a.content }, { label: 'Trạng thái', value: a => App.APPT_STATUS[a.status || 'scheduled'][0] }, { label: 'Ghi chú', value: a => a.note }
      ], rows);
      App.on(el, {
        edit: id => App.appointmentForm(App.byId('appointments', id)),
        del: async id => { if (await App.remove('appointments', id)) draw(); }
      });
    }
  };
})();
