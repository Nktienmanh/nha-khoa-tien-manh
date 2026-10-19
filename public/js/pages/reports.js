/* Báo cáo & thống kê */
(function () {
  const TABS = [['revenue', 'Doanh thu - Thu chi'], ['service', 'Theo thủ thuật'], ['doctor', 'Theo bác sĩ'], ['customer', 'Khách hàng'], ['debt', 'Công nợ'], ['appt', 'Lịch hẹn']];
  const st = { tab: 'revenue', from: App.monthStart(), to: App.monthEnd(), group: 'day' };

  const hbars = (items, fmt = App.money) => {
    const max = Math.max(1, ...items.map(i => i.v));
    return items.length ? items.map(i => `<div class="hbar"><div class="n" title="${App.esc(i.n)}">${App.esc(i.n)}</div><div class="t"><i style="width:${i.v / max * 100}%"></i></div><div class="v">${fmt(i.v)}</div></div>`).join('') : '<div class="muted">Không có dữ liệu</div>';
  };
  const groupBy = (arr, keyFn) => { const m = new Map(); for (const x of arr) { const k = keyFn(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); } return m; };

  App.routes.reports = {
    title: 'Báo cáo & Thống kê',
    render(el) {
      el.innerHTML = `<div class="tabs">${TABS.map(([k, l]) => `<div class="tab ${st.tab === k ? 'active' : ''}" data-tab="${k}">${l}</div>`).join('')}</div>
        <div class="toolbar">${st.tab !== 'debt' ? App.rangeInputs(st.from, st.to) : ''}<div class="spacer"></div><button class="btn" id="rexp">⬇ Xuất Excel</button></div><div id="rb"></div>`;
      el.querySelector('.tabs').onclick = e => { const t = e.target.closest('[data-tab]'); if (t) { st.tab = t.dataset.tab; App.render(); } };
      if (st.tab !== 'debt') App.bindRange(el, (f, t) => { st.from = f; st.to = t; App.render(); });
      const rb = el.querySelector('#rb');
      const S = App.S;
      const sessions = S.treatmentSessions.filter(s => App.inRange(s.date, st.from, st.to));
      const tx = S.transactions.filter(t => App.inRange(t.date, st.from, st.to));
      let exportFn = null;

      if (st.tab === 'revenue') {
        const key = d => st.group === 'month' ? String(d).slice(0, 7) : String(d).slice(0, 10);
        const keys = [...new Set([...sessions.map(s => key(s.date)), ...tx.map(t => key(t.date))])].sort();
        const rows = keys.map(k => ({
          k, rev: App.sum(sessions.filter(s => key(s.date) === k), s => s.amount),
          thu: App.sum(tx.filter(t => t.type === 'thu' && key(t.date) === k), t => t.amount),
          chi: App.sum(tx.filter(t => t.type === 'chi' && key(t.date) === k), t => t.amount)
        }));
        const max = Math.max(1, ...rows.map(r => Math.max(r.thu, r.chi)));
        const byCat = [...groupBy(tx, t => t.type + '|' + (App.nameOf('txCategories', t.categoryId) || 'Khác'))].map(([k, l]) => ({ n: (k.startsWith('thu') ? '[Thu] ' : '[Chi] ') + k.split('|')[1], v: App.sum(l, t => t.amount) }));
        const byMethod = [...groupBy(tx.filter(t => t.type === 'thu'), t => t.method || 'Khác')].map(([n, l]) => ({ n, v: App.sum(l, t => t.amount) }));
        rb.innerHTML = `<div class="grid g4 mb">
          <div class="stat"><div class="label">Doanh thu điều trị</div><div class="value">${App.money(App.sum(rows, r => r.rev))}</div></div>
          <div class="stat blue"><div class="label">Thực thu</div><div class="value">${App.money(App.sum(rows, r => r.thu))}</div></div>
          <div class="stat orange"><div class="label">Chi phí</div><div class="value">${App.money(App.sum(rows, r => r.chi))}</div></div>
          <div class="stat"><div class="label">Lợi nhuận</div><div class="value">${App.money(App.sum(rows, r => r.thu - r.chi))}</div></div></div>
          <div class="card"><div class="card-head"><h3>Biểu đồ thu - chi</h3><div class="spacer"></div><div class="seg"><button data-g="day" class="${st.group === 'day' ? 'active' : ''}">Theo ngày</button><button data-g="month" class="${st.group === 'month' ? 'active' : ''}">Theo tháng</button></div></div>
          <div class="bars">${rows.slice(-31).map(r => `<div class="bar" title="${r.k}: Thu ${App.money(r.thu)} | Chi ${App.money(r.chi)}"><div class="pair"><div class="b" style="height:${r.thu / max * 100}%"></div><div class="b chi" style="height:${r.chi / max * 100}%"></div></div></div>`).join('')}</div>
          <div class="bars-labels">${rows.slice(-31).map(r => `<span>${st.group === 'month' ? r.k.slice(5) + '/' + r.k.slice(2, 4) : r.k.slice(8)}</span>`).join('')}</div></div>
          <div class="grid g2"><div class="card"><div class="card-head"><h3>Theo danh mục</h3></div>${hbars(App.sortBy(byCat, x => x.v, true))}</div>
          <div class="card"><div class="card-head"><h3>Thực thu theo phương thức</h3></div>${hbars(App.sortBy(byMethod, x => x.v, true))}</div></div>
          <div class="card"><div id="t"></div></div>`;
        rb.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { st.group = b.dataset.g; App.render(); });
        const cols = [{ label: st.group === 'month' ? 'Tháng' : 'Ngày', render: r => st.group === 'month' ? r.k.slice(5) + '/' + r.k.slice(0, 4) : App.fmtDate(r.k) },
          { label: 'Doanh thu điều trị', cls: 'num', render: r => App.money(r.rev), total: rs => App.money(App.sum(rs, r => r.rev)) },
          { label: 'Thực thu', cls: 'num', render: r => App.money(r.thu), total: rs => App.money(App.sum(rs, r => r.thu)) },
          { label: 'Chi', cls: 'num', render: r => App.money(r.chi), total: rs => App.money(App.sum(rs, r => r.chi)) },
          { label: 'Lợi nhuận', cls: 'num', render: r => App.money(r.thu - r.chi), total: rs => App.money(App.sum(rs, r => r.thu - r.chi)) }];
        App.table(rb.querySelector('#t'), { rows: rows.reverse(), columns: cols, pageSize: 31 });
        exportFn = () => App.exportCSV('bao-cao-doanh-thu.csv', [{ label: 'Kỳ', value: r => r.k }, { label: 'Doanh thu', value: r => r.rev }, { label: 'Thực thu', value: r => r.thu }, { label: 'Chi', value: r => r.chi }, { label: 'Lợi nhuận', value: r => r.thu - r.chi }], rows);
      }

      if (st.tab === 'service') {
        const rows = App.sortBy([...groupBy(sessions, s => s.serviceName || 'Khác')].map(([n, l]) => {
          const svc = S.services.find(x => x.name === n);
          return { n, group: App.nameOf('serviceGroups', svc?.groupId), count: l.length, patients: new Set(l.map(x => x.patientId)).size, v: App.sum(l, x => x.amount) };
        }), r => r.v, true);
        const byGroup = [...groupBy(rows, r => r.group || 'Khác')].map(([n, l]) => ({ n, v: App.sum(l, r => r.v) }));
        rb.innerHTML = `<div class="grid g2"><div class="card"><div class="card-head"><h3>Doanh thu theo nhóm dịch vụ</h3></div>${hbars(App.sortBy(byGroup, x => x.v, true))}</div>
          <div class="card"><div class="card-head"><h3>Top thủ thuật</h3></div>${hbars(rows.slice(0, 10))}</div></div><div class="card"><div id="t"></div></div>`;
        App.table(rb.querySelector('#t'), { rows, columns: [
          { label: 'Thủ thuật', render: r => App.esc(r.n) }, { label: 'Nhóm', render: r => App.esc(r.group || '') }, { label: 'Lượt thực hiện', cls: 'num', render: r => r.count },
          { label: 'Số khách', cls: 'num', render: r => r.patients }, { label: 'Doanh thu', cls: 'num', render: r => App.money(r.v), total: rs => App.money(App.sum(rs, r => r.v)) }] });
        exportFn = () => App.exportCSV('bao-cao-thu-thuat.csv', [{ label: 'Thủ thuật', value: r => r.n }, { label: 'Nhóm', value: r => r.group }, { label: 'Lượt', value: r => r.count }, { label: 'Doanh thu', value: r => r.v }], rows);
      }

      if (st.tab === 'doctor') {
        const rows = App.sortBy(S.staff.filter(s => s.role === 'doctor' || sessions.some(x => x.doctorId === s.id)).map(s => {
          const l = sessions.filter(x => x.doctorId === s.id);
          return { n: s.name, count: l.length, patients: new Set(l.map(x => x.patientId)).size, appts: S.appointments.filter(a => a.doctorId === s.id && App.inRange(a.date, st.from, st.to)).length, v: App.sum(l, x => x.amount), com: App.commissionFor(s.id, st.from, st.to).commission };
        }), r => r.v, true);
        rb.innerHTML = `<div class="card"><div class="card-head"><h3>Doanh thu theo bác sĩ</h3></div>${hbars(rows)}</div><div class="card"><div id="t"></div></div>`;
        App.table(rb.querySelector('#t'), { rows, columns: [
          { label: 'Bác sĩ', render: r => App.esc(r.n) }, { label: 'Lượt điều trị', cls: 'num', render: r => r.count }, { label: 'Số khách', cls: 'num', render: r => r.patients },
          { label: 'Lịch hẹn', cls: 'num', render: r => r.appts }, { label: 'Doanh thu', cls: 'num', render: r => App.money(r.v), total: rs => App.money(App.sum(rs, r => r.v)) },
          { label: 'Hoa hồng', cls: 'num', render: r => App.money(r.com), total: rs => App.money(App.sum(rs, r => r.com)) }] });
        exportFn = () => App.exportCSV('bao-cao-bac-si.csv', [{ label: 'Bác sĩ', value: r => r.n }, { label: 'Lượt', value: r => r.count }, { label: 'Doanh thu', value: r => r.v }, { label: 'Hoa hồng', value: r => r.com }], rows);
      }

      if (st.tab === 'customer') {
        const newP = S.patients.filter(p => App.inRange(p.createdAt, st.from, st.to));
        const visited = new Set([...sessions.map(s => s.patientId), ...S.appointments.filter(a => a.status === 'done' && App.inRange(a.date, st.from, st.to)).map(a => a.patientId)]);
        const bySource = [...groupBy(newP, p => App.nameOf('sources', p.sourceId) || 'Chưa rõ')].map(([n, l]) => ({ n, v: l.length }));
        const byGender = [...groupBy(newP, p => p.gender || 'Chưa rõ')].map(([n, l]) => ({ n, v: l.length }));
        const ageG = p => { const a = App.age(p.dob); return a === '' ? 'Chưa rõ' : a < 18 ? 'Dưới 18' : a < 30 ? '18-29' : a < 45 ? '30-44' : a < 60 ? '45-59' : 'Từ 60'; };
        const byAge = [...groupBy(newP, ageG)].map(([n, l]) => ({ n, v: l.length }));
        const top = App.sortBy(S.patients.map(p => ({ p, v: App.sum(sessions.filter(s => s.patientId === p.id), s => s.amount) })).filter(x => x.v > 0), x => x.v, true).slice(0, 20);
        const cnt = n => String(n);
        rb.innerHTML = `<div class="grid g3 mb"><div class="stat"><div class="label">Khách hàng mới</div><div class="value">${newP.length}</div></div>
          <div class="stat blue"><div class="label">Khách đến điều trị</div><div class="value">${visited.size}</div></div>
          <div class="stat"><div class="label">Tổng khách hàng</div><div class="value">${S.patients.length}</div></div></div>
          <div class="grid g3"><div class="card"><div class="card-head"><h3>Khách mới theo nguồn</h3></div>${hbars(App.sortBy(bySource, x => x.v, true), cnt)}</div>
          <div class="card"><div class="card-head"><h3>Theo giới tính</h3></div>${hbars(byGender, cnt)}</div>
          <div class="card"><div class="card-head"><h3>Theo độ tuổi</h3></div>${hbars(App.sortBy(byAge, x => x.n), cnt)}</div></div>
          <div class="card"><div class="card-head"><h3>Top khách hàng theo doanh thu trong kỳ</h3></div><div id="t"></div></div>`;
        App.table(rb.querySelector('#t'), { rows: top, columns: [
          { label: 'Khách hàng', render: x => `<a href="#/patient/${x.p.id}">${App.esc(x.p.name)}</a>` }, { label: 'SĐT', render: x => App.esc(x.p.phone || '') },
          { label: 'Doanh thu', cls: 'num', render: x => App.money(x.v) }, { label: 'Công nợ hiện tại', cls: 'num', render: x => App.money(App.patientFinance(x.p.id).debt) }] });
        exportFn = () => App.exportCSV('khach-hang-moi.csv', [{ label: 'Mã', value: p => p.code }, { label: 'Họ tên', value: p => p.name }, { label: 'SĐT', value: p => p.phone }, { label: 'Nguồn', value: p => App.nameOf('sources', p.sourceId) }, { label: 'Ngày tạo', value: p => App.fmtDate(p.createdAt) }], newP);
      }

      if (st.tab === 'debt') {
        const rows = App.sortBy(S.patients.map(p => ({ p, ...App.patientFinance(p.id) })).filter(x => x.debt > 0), x => x.debt, true);
        rb.innerHTML = `<div class="grid g3 mb"><div class="stat red"><div class="label">Tổng công nợ</div><div class="value">${App.money(App.sum(rows, x => x.debt))}</div></div><div class="stat"><div class="label">Số khách còn nợ</div><div class="value">${rows.length}</div></div></div><div class="card"><div id="t"></div></div>`;
        App.table(rb.querySelector('#t'), { rows, columns: [
          { label: 'Mã', render: x => App.esc(x.p.code) }, { label: 'Khách hàng', render: x => `<a href="#/patient/${x.p.id}/pay">${App.esc(x.p.name)}</a>` }, { label: 'SĐT', render: x => App.esc(x.p.phone || '') },
          { label: 'Đã điều trị', cls: 'num', render: x => App.money(x.treated) }, { label: 'Đã thanh toán', cls: 'num', render: x => App.money(x.paid) },
          { label: 'Còn nợ', cls: 'num', render: x => `<b class="text-red">${App.money(x.debt)}</b>`, total: rs => App.money(App.sum(rs, x => x.debt)) },
          { label: '', render: x => `<button class="btn sm primary" data-act="pay" data-id="${x.p.id}">Thu nợ</button>` }] });
        App.on(rb, { pay: id => App.paymentForm(id) });
        exportFn = () => App.exportCSV('cong-no.csv', [{ label: 'Mã', value: x => x.p.code }, { label: 'Họ tên', value: x => x.p.name }, { label: 'SĐT', value: x => x.p.phone }, { label: 'Đã điều trị', value: x => x.treated }, { label: 'Đã thanh toán', value: x => x.paid }, { label: 'Còn nợ', value: x => x.debt }], rows);
      }

      if (st.tab === 'appt') {
        const appts = S.appointments.filter(a => App.inRange(a.date, st.from, st.to));
        const bySt = Object.entries(App.APPT_STATUS).map(([k, [n]]) => ({ n, v: appts.filter(a => (a.status || 'scheduled') === k).length }));
        const byDoc = [...groupBy(appts, a => App.nameOf('staff', a.doctorId) || 'Chưa phân công')].map(([n, l]) => ({ n, v: l.length }));
        const done = appts.filter(a => a.status === 'done' || a.status === 'arrived').length;
        rb.innerHTML = `<div class="grid g3 mb"><div class="stat"><div class="label">Tổng lịch hẹn</div><div class="value">${appts.length}</div></div>
          <div class="stat blue"><div class="label">Khách đến</div><div class="value">${done}</div></div>
          <div class="stat orange"><div class="label">Tỷ lệ đến</div><div class="value">${appts.length ? Math.round(done / appts.length * 100) : 0}%</div></div></div>
          <div class="grid g2"><div class="card"><div class="card-head"><h3>Theo trạng thái</h3></div>${hbars(bySt, String)}</div><div class="card"><div class="card-head"><h3>Theo bác sĩ</h3></div>${hbars(App.sortBy(byDoc, x => x.v, true), String)}</div></div>`;
        exportFn = () => App.exportCSV('bao-cao-lich-hen.csv', [{ label: 'Ngày', value: a => App.fmtDate(a.date) }, { label: 'Giờ', value: a => a.time }, { label: 'Khách', value: a => App.nameOf('patients', a.patientId) }, { label: 'Bác sĩ', value: a => App.nameOf('staff', a.doctorId) }, { label: 'Trạng thái', value: a => App.APPT_STATUS[a.status || 'scheduled'][0] }], appts);
      }
      el.querySelector('#rexp').onclick = () => exportFn && exportFn();
    }
  };
})();
