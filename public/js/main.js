/* Khung ứng dụng: đăng nhập, menu, điều hướng */
(function () {
  const NAV = [
    { r: 'dashboard', ico: '🏠', label: 'Trang chủ' },
    { r: 'patients', ico: '👤', label: 'Quản lý khách hàng' },
    { r: 'care', ico: '💬', label: 'Chăm sóc khách hàng' },
    { label: 'Quản lý lịch hẹn', ico: '📅', children: [
      { r: 'appointments', label: 'Lịch hẹn' },
      { r: 'appointment-list', label: 'Danh sách lịch hẹn' }
    ] },
    { r: 'staff', ico: '👥', label: 'Quản lý nhân sự' },
    { r: 'finance', ico: '💰', label: 'Quản lý thu/chi' },
    { r: 'commission', ico: '💵', label: 'Quản lý hoa hồng' },
    { label: 'Quản lý kho', ico: '📦', children: [
      { r: 'inventory', label: 'Vật tư & tồn kho' },
      { r: 'stock', label: 'Phiếu nhập / xuất' },
      { r: 'labs', label: 'Xưởng / Labo' }
    ] },
    { r: 'reports', ico: '📊', label: 'Báo cáo & Thống kê' },
    { r: 'branches', ico: '🏢', label: 'Quản lý chi nhánh' },
    { r: 'settings', ico: '⚙️', label: 'Cài đặt' }
  ];

  App.logout = async function (silent) {
    if (App.fb) { try { await App.fb.signOut(); } catch { } }
    else if (!silent && App.token) { try { await App.api('POST', 'logout'); } catch { } }
    App.token = null; App.user = null; localStorage.removeItem('nktm_token');
    renderLogin();
  };

  function renderLogin() {
    document.getElementById('app').innerHTML = `
      <div class="login-page"><form class="login-box" id="login-form">
        <div class="logo"><img src="/img/logo.svg" alt=""><h2>Nha Khoa Tiến Mạnh</h2><div class="muted">Hệ thống quản lý phòng khám</div></div>
        <div class="login-err" id="login-err"></div>
        <div class="field"><label>${App.fb ? 'Email' : 'Tên đăng nhập'}</label><input name="username" ${App.fb ? 'type="email"' : ''} required autocomplete="username" autofocus></div>
        <div class="field"><label>Mật khẩu</label><input name="password" type="password" required autocomplete="current-password"></div>
        <button class="btn primary">Đăng nhập</button>
      </form></div>`;
    const form = document.getElementById('login-form');
    form.onsubmit = async e => {
      e.preventDefault();
      const fd = new FormData(form);
      try {
        const r = await App.api('POST', 'login', { username: fd.get('username'), password: fd.get('password') });
        App.token = r.token; App.user = r.user; if (!App.fb) localStorage.setItem('nktm_token', r.token);
        await start();
      } catch (err) { document.getElementById('login-err').textContent = err.message; }
    };
  }

  function navHtml() {
    const item = n => `<a class="nav-item" href="#/${n.r}" data-r="${n.r}">${n.ico ? `<span class="ico">${n.ico}</span>` : ''}<span>${n.label}</span></a>`;
    return NAV.map(n => n.children
      ? `<div class="nav-group"><div class="nav-item" data-toggle><span class="ico">${n.ico}</span><span>${n.label}</span><span class="chev">▶</span></div><div class="nav-sub">${n.children.map(item).join('')}</div></div>`
      : item(n)).join('');
  }

  function renderLayout() {
    const u = App.user;
    document.getElementById('app').innerHTML = `
      <div class="layout">
        <aside class="sidebar" id="sidebar">
          <div class="brand"><img src="/img/logo.svg" alt=""><div>${App.esc(App.S.settings.clinicName || 'Nha Khoa Tiến Mạnh')}<small>Quản lý phòng khám</small></div></div>
          <nav id="nav">${navHtml()}</nav>
          <div class="side-foot">${App.fb ? 'Dữ liệu lưu trên Firebase' : 'Dữ liệu lưu tại máy chủ nội bộ'}</div>
        </aside>
        <div class="main">
          <header class="topbar">
            <button class="menu-toggle" id="menu-toggle">☰</button>
            <div class="title" id="page-title"></div>
            <div class="spacer"></div>
            <div class="search"><input id="g-search" placeholder="🔍 Tìm khách hàng (tên, mã, SĐT)..." autocomplete="off"><div class="search-results" id="g-results" hidden></div></div>
            <button class="btn primary sm" id="quick-appt">+ Lịch hẹn</button>
            <div class="user-menu" id="user-menu"><div class="avatar">${App.initials(u.name)}</div><div class="uname"><b>${App.esc(u.name || u.username)}</b><div class="small muted">${u.role === 'admin' ? 'Quản trị viên' : 'Nhân viên'}</div></div></div>
          </header>
          <main class="content" id="content"></main>
        </div>
      </div>`;
    const nav = document.getElementById('nav');
    nav.addEventListener('click', e => {
      const t = e.target.closest('[data-toggle]');
      if (t) t.parentElement.classList.toggle('open');
      if (e.target.closest('a')) document.getElementById('sidebar').classList.remove('show');
    });
    document.getElementById('menu-toggle').onclick = () => document.getElementById('sidebar').classList.toggle('show');
    document.getElementById('quick-appt').onclick = () => App.appointmentForm();
    document.getElementById('user-menu').onclick = e => {
      e.stopPropagation();
      const old = document.querySelector('.dropdown'); if (old) { old.remove(); return; }
      const dd = document.createElement('div'); dd.className = 'dropdown';
      dd.innerHTML = `<div data-a="pw">🔑 Đổi mật khẩu</div><div data-a="reload">🔄 Tải lại dữ liệu</div><div data-a="out">🚪 Đăng xuất</div>`;
      document.getElementById('user-menu').appendChild(dd);
      dd.onclick = ev => {
        const a = ev.target.dataset.a;
        if (a === 'pw') changePassword();
        if (a === 'reload') App.refresh(true);
        if (a === 'out') App.logout();
        dd.remove();
      };
    };
    document.addEventListener('click', () => document.querySelector('.dropdown')?.remove());

    // Tìm kiếm nhanh khách hàng
    const gs = document.getElementById('g-search'), gr = document.getElementById('g-results');
    gs.oninput = () => {
      const q = gs.value.trim();
      if (!q) { gr.hidden = true; return; }
      const list = App.S.patients.filter(p => App.match(q, p.name, p.code, p.phone)).slice(0, 12);
      gr.innerHTML = list.length ? list.map(p => `<div data-id="${p.id}"><b>${App.esc(p.name)}</b> <span class="muted small">${App.esc(p.code)} · ${App.esc(p.phone || '')}</span></div>`).join('') : '<div class="muted">Không tìm thấy</div>';
      gr.hidden = false;
    };
    gr.onclick = e => { const d = e.target.closest('[data-id]'); if (d) { App.go('#/patient/' + d.dataset.id); gs.value = ''; gr.hidden = true; } };
    gs.onblur = () => setTimeout(() => gr.hidden = true, 200);
  }

  function changePassword(force) {
    App.formModal({
      title: force ? 'Vui lòng đổi mật khẩu mặc định' : 'Đổi mật khẩu', size: 'sm',
      fields: [
        { name: 'oldPassword', label: 'Mật khẩu hiện tại', type: 'password', required: true, full: true },
        { name: 'newPassword', label: 'Mật khẩu mới (tối thiểu 6 ký tự)', type: 'password', required: true, full: true },
        { name: 'confirm', label: 'Nhập lại mật khẩu mới', type: 'password', required: true, full: true }
      ],
      onSubmit: async v => {
        if (v.newPassword !== v.confirm) { App.toast('Mật khẩu nhập lại không khớp', 'error'); return false; }
        await App.api('POST', 'change-password', v);
        App.user.mustChangePassword = false;
        App.toast('Đã đổi mật khẩu', 'success');
      }
    });
  }

  function parseHash() {
    const h = location.hash.replace(/^#\/?/, '') || 'dashboard';
    const [name, ...params] = h.split('/').map(decodeURIComponent);
    return { name, params };
  }

  App.render = function () {
    if (!App.S) return;
    App.route = parseHash();
    const r = App.routes[App.route.name] || App.routes.dashboard;
    document.querySelectorAll('#nav .nav-item').forEach(a => {
      const on = a.dataset.r === App.route.name || (App.route.name === 'patient' && a.dataset.r === 'patients');
      a.classList.toggle('active', on);
      if (on) a.closest('.nav-group')?.classList.add('open');
    });
    const content = document.getElementById('content');
    document.getElementById('page-title').textContent = typeof r.title === 'function' ? r.title(App.route.params) : r.title;
    // Mỗi lần hiển thị tạo phần tử mới để sự kiện của trang cũ không bị gắn chồng
    const page = document.createElement('div');
    content.replaceChildren(page);
    try { r.render(page, App.route.params); }
    catch (e) { console.error(e); content.innerHTML = `<div class="card text-red">Lỗi hiển thị trang: ${App.esc(e.message)}</div>`; }
  };

  App.refresh = async function (show) {
    try {
      await App.loadAll();
      if (!document.querySelector('.modal-backdrop')) App.render();
      if (show) App.toast('Đã tải lại dữ liệu mới nhất', 'success');
    } catch (e) { if (show) App.toast(e.message, 'error'); }
  };

  async function start() {
    try {
      App.user = await App.api('GET', 'me');
      await App.loadAll();
    } catch { return renderLogin(); }
    renderLayout();
    App.render();
    if (App.user.mustChangePassword) changePassword(true);
  }

  window.addEventListener('hashchange', () => App.render());
  // Đồng bộ dữ liệu từ máy chủ mỗi 60 giây (khi nhiều máy cùng dùng)
  setInterval(() => { if (!App.fb && App.token && App.S && !document.hidden && !document.querySelector('.modal-backdrop')) App.loadAll().catch(() => { }); }, 60000);

  (async () => {
    if (App.fb) {
      // Chế độ Firebase: chờ Firebase xác định trạng thái đăng nhập
      try { if (await App.fb.ready()) { App.token = 'firebase'; return start(); } }
      catch (e) { App.toast('Không kết nối được Firebase: ' + e.message, 'error'); }
      return renderLogin();
    }
    if (App.token) start(); else renderLogin();
  })();
})();
