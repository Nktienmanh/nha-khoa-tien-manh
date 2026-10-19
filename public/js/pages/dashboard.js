/* Trang chủ - tổng quan */
(function () {
  let from = App.monthStart(), to = App.monthEnd();

  App.totalDebt = () => App.S.patients.reduce((s, p) => { const d = App.patientFinance(p.id).debt; return s + (d > 0 ? d : 0); }, 0);
  App.stockOf = mid => App.sum(App.S.stockMoves.filter(m => m.materialId === mid), m => (m.type === 'out' ? -1 : 1) * (Number(m.qty) || 0));

  App.routes.dashboard = {
    title: 'Trang chủ',
    render(el) {
      const S = App.S, d0 = App.today();
      const sessions = S.treatmentSessions.filter(s => App.inRange(s.date, from, to));
      const tx = S.transactions.filter(t => App.inRange(t.date, from, to));
      const revenue = App.sum(sessions, s => s.amount);
      const income = App.sum(tx.filter(t => t.type === 'thu'), t => t.amount);
      const expense = App.sum(tx.filter(t => t.type === 'chi'), t => t.amount);
      const newPatients = S.patients.filter(p => App.inRange(p.createdAt, from, to)).length;
      const appts = S.appointments.filter(a => App.inRange(a.date, from, to));
      const todayAppts = App.sortBy(S.appointments.filter(a => a.date === d0), a => a.time || '');
      const careToday = S.careTasks.filter(c => c.status !== 'done' && c.date <= d0);
      const lowStock = S.materials.filter(m => Number(m.minStock) > 0 && App.stockOf(m.id) < Number(m.minStock));
      const md = d0.slice(5);
      const birthdays = S.patients.filter(p => p.dob && p.dob.slice(5) === md);

      // 6 tháng gần nhất
      const months = [];
      for (let i = 5; i >= 0; i--) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); months.push(App.isoDate(d).slice(0, 7)); }
      const mData = months.map(m => ({ m, thu: App.sum(S.transactions.filter(t => t.type === 'thu' && String(t.date).startsWith(m)), t => t.amount), chi: App.sum(S.transactions.filter(t => t.type === 'chi' && String(t.date).startsWith(m)), t => t.amount) }));
      const maxM = Math.max(1, ...mData.map(x => Math.max(x.thu, x.chi)));
      const stCount = Object.keys(App.APPT_STATUS).map(k => ({ k, n: appts.filter(a => (a.status || 'scheduled') === k).length }));
      const maxSt = Math.max(1, ...stCount.map(x => x.n));

      el.innerHTML = `
        <div class="toolbar">${App.rangeInputs(from, to)}</div>
        <div class="grid g4 mb">
          <div class="stat"><div class="label">Tổng doanh thu (VNĐ)</div><div class="value">${App.money(revenue)}</div><div class="small muted">Giá trị điều trị đã thực hiện</div></div>
          <div class="stat blue"><div class="label">Tổng thực thu (VNĐ)</div><div class="value">${App.money(income)}</div><div class="small muted">Tổng phiếu thu</div></div>
          <div class="stat orange"><div class="label">Tổng chi phí (VNĐ)</div><div class="value">${App.money(expense)}</div><div class="small muted">Tổng phiếu chi</div></div>
          <div class="stat red"><div class="label">Tổng công nợ (VNĐ)</div><div class="value">${App.money(App.totalDebt())}</div><div class="small muted">Khách hàng còn nợ (toàn thời gian)</div></div>
        </div>
        <div class="grid g4 mb">
          <div class="stat"><div class="label">Khách hàng mới</div><div class="value">${newPatients}</div></div>
          <div class="stat"><div class="label">Lịch hẹn trong kỳ</div><div class="value">${appts.length}</div></div>
          <div class="stat"><div class="label">Lượt điều trị</div><div class="value">${sessions.length}</div></div>
          <div class="stat"><div class="label">Lợi nhuận (thu - chi)</div><div class="value">${App.money(income - expense)}</div></div>
        </div>
        <div class="grid g2">
          <div class="card">
            <div class="card-head"><h3>Lịch hẹn hôm nay (${todayAppts.length})</h3><div class="spacer"></div><a href="#/appointments">Xem lịch →</a></div>
            <div id="today-appts"></div>
          </div>
          <div class="card">
            <div class="card-head"><h3>Báo cáo lịch hẹn trong kỳ</h3><div class="spacer"></div><a href="#/appointment-list">Xem chi tiết →</a></div>
            ${stCount.map(x => `<div class="hbar"><div class="n">${App.apptBadge(x.k)}</div><div class="t"><i style="width:${x.n / maxSt * 100}%"></i></div><div class="v">${x.n}</div></div>`).join('')}
          </div>
          <div class="card">
            <div class="card-head"><h3>Thu - Chi 6 tháng gần nhất</h3><div class="spacer"></div><div class="legend-inline"><span><i style="background:var(--primary)"></i>Thu</span><span><i style="background:#f87171"></i>Chi</span></div></div>
            <div class="bars">${mData.map(x => `<div class="bar" title="Thu: ${App.money(x.thu)} | Chi: ${App.money(x.chi)}"><div class="pair"><div class="b" style="height:${x.thu / maxM * 100}%"></div><div class="b chi" style="height:${x.chi / maxM * 100}%"></div></div></div>`).join('')}</div>
            <div class="bars-labels">${mData.map(x => `<span>T${Number(x.m.slice(5))}/${x.m.slice(2, 4)}</span>`).join('')}</div>
          </div>
          <div class="card">
            <div class="card-head"><h3>Việc cần làm</h3></div>
            <div class="kv">
              <div class="k">Chăm sóc đến hạn</div><div><a href="#/care">${careToday.length} việc</a></div>
              <div class="k">Sinh nhật hôm nay</div><div>${birthdays.length ? birthdays.map(p => `<a href="#/patient/${p.id}">${App.esc(p.name)}</a>`).join(', ') : '<span class="muted">Không có</span>'}</div>
              <div class="k">Vật tư sắp hết</div><div>${lowStock.length ? lowStock.map(m => `<span class="badge orange">${App.esc(m.name)}: ${App.stockOf(m.id)}</span>`).join(' ') : '<span class="muted">Đủ hàng</span>'}</div>
              <div class="k">Labo chờ trả</div><div><a href="#/labs">${S.labOrders.filter(l => l.status !== 'done' && l.status !== 'cancelled').length} đơn</a></div>
            </div>
          </div>
        </div>`;
      App.bindRange(el, (f, t) => { from = f; to = t; App.render(); });
      App.table(el.querySelector('#today-appts'), {
        rows: todayAppts, pageSize: 8, empty: 'Không có lịch hẹn hôm nay',
        columns: [
          { label: 'Giờ', render: a => App.esc(a.time || '') },
          { label: 'Khách hàng', render: a => { const p = App.byId('patients', a.patientId); return p ? `<a href="#/patient/${p.id}">${App.esc(p.name)}</a><div class="small muted">${App.esc(p.phone || '')}</div>` : App.esc(a.guestName || ''); } },
          { label: 'Bác sĩ', render: a => App.esc(App.nameOf('staff', a.doctorId)) },
          { label: 'Nội dung', render: a => App.esc(a.content || '') },
          { label: 'Trạng thái', render: a => App.apptBadge(a.status || 'scheduled') }
        ],
        onRow: a => App.appointmentForm(a)
      });
    }
  };
})();
