/* Nha Khoa Tiến Mạnh - lõi giao diện: API, bộ nhớ đệm dữ liệu, tiện ích, modal, bảng */
const App = window.App = {
  token: localStorage.getItem('nktm_token') || null,
  user: null,
  S: null, // bộ nhớ đệm toàn bộ dữ liệu: App.S.patients, App.S.services ...
  routes: {},
  route: { name: 'dashboard', params: [] }
};

/* ---------------- API ---------------- */
App.api = async function (method, url, body) {
  const res = await fetch('/api/' + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(App.token ? { Authorization: 'Bearer ' + App.token } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  let data = null;
  const text = await res.text();
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (res.status === 401 && url !== 'login') { App.logout(true); throw new Error('Phiên đăng nhập đã hết hạn'); }
  if (!res.ok) throw new Error((data && data.error) || 'Lỗi ' + res.status);
  return data;
};
App.loadAll = async function () { App.S = await App.api('GET', 'db'); return App.S; };

App.create = async function (col, data) {
  const item = await App.api('POST', col, data);
  const list = App.S[col] = App.S[col] || [];
  // Firebase có thể đã đẩy bản ghi vào qua realtime trước khi lệnh ghi trả về -> tránh trùng
  for (const it of Array.isArray(item) ? item : [item]) if (!list.some(x => x.id === it.id)) list.push(it);
  return item;
};
App.update = async function (col, id, data) {
  const item = await App.api('PUT', `${col}/${id}`, data);
  const list = App.S[col]; const i = list.findIndex(x => x.id === id);
  if (i >= 0) list[i] = item; else list.push(item);
  return item;
};
App.remove = async function (col, id, { confirmText, skipConfirm } = {}) {
  if (!skipConfirm && !(await App.confirm(confirmText || 'Bạn chắc chắn muốn xóa mục này?'))) return false;
  await App.api('DELETE', `${col}/${id}`);
  App.S[col] = App.S[col].filter(x => x.id !== id);
  if (col === 'patients') {
    for (const c of ['exams', 'treatmentPlans', 'treatmentSessions', 'prescriptions', 'images', 'labOrders', 'appointments', 'careTasks']) App.S[c] = App.S[c].filter(x => x.patientId !== id);
  }
  if (col === 'treatmentPlans') App.S.treatmentSessions = App.S.treatmentSessions.filter(x => x.planId !== id);
  App.toast('Đã xóa', 'success');
  return true;
};
/* Lưu (thêm mới hoặc sửa) */
App.save = (col, id, data) => id ? App.update(col, id, data) : App.create(col, data);

/* ---------------- Tiện ích ---------------- */
const esc = App.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = App.money = n => (Math.round(Number(n) || 0)).toLocaleString('vi-VN');
const pad = n => String(n).padStart(2, '0');
const isoDate = App.isoDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = App.today = () => isoDate(new Date());
const fmtDate = App.fmtDate = s => { if (!s) return ''; const [y, m, d] = String(s).slice(0, 10).split('-'); return d ? `${d}/${m}/${y}` : s; };
const fmtDateTime = App.fmtDateTime = s => { if (!s) return ''; const d = new Date(s); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
App.addDays = (s, n) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return isoDate(d); };
App.monthStart = (s = today()) => s.slice(0, 8) + '01';
App.monthEnd = (s = today()) => { const d = new Date(s.slice(0, 7) + '-01T00:00:00'); d.setMonth(d.getMonth() + 1); d.setDate(0); return isoDate(d); };
App.inRange = (date, from, to) => { const d = String(date || '').slice(0, 10); return (!from || d >= from) && (!to || d <= to); };
App.norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
App.match = (q, ...fields) => { const nq = App.norm(q).trim(); if (!nq) return true; return fields.some(f => App.norm(f).includes(nq)); };
App.byId = (col, id) => (App.S[col] || []).find(x => x.id === id);
App.nameOf = (col, id, key = 'name') => App.byId(col, id)?.[key] || '';
App.age = dob => { if (!dob) return ''; const d = new Date(dob); const n = new Date(); let a = n.getFullYear() - d.getFullYear(); if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) a--; return a; };
App.initials = name => String(name || '?').trim().split(/\s+/).slice(-1)[0][0]?.toUpperCase() || '?';
App.uploadUrl = url => url ? `${url}?t=${App.token}` : '';
/* Chế độ máy chủ nội bộ: ảnh tải trực tiếp qua URL. Chế độ Firebase ghi đè 2 hàm dưới. */
App.hydrateImages = () => { };
App.downloadBackup = async () => {
  const res = await fetch('/api/backup/download', { headers: { Authorization: 'Bearer ' + App.token } });
  if (!res.ok) throw new Error('Không tải được file sao lưu');
  const blob = await res.blob(); const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `nhakhoa-tienmanh-${App.today()}.json`; a.click();
};
App.mode = 'local';
App.isAdmin = () => App.user?.role === 'admin';
App.sortBy = (arr, fn, desc) => [...arr].sort((a, b) => { const x = fn(a), y = fn(b); return (x > y ? 1 : x < y ? -1 : 0) * (desc ? -1 : 1); });
App.sum = (arr, fn) => arr.reduce((s, x) => s + (Number(fn(x)) || 0), 0);

App.staffOptions = (roles) => App.S.staff.filter(s => s.active !== false && (!roles || roles.includes(s.role))).map(s => ({ value: s.id, label: s.name }));
App.ROLES = { doctor: 'Bác sĩ', assistant: 'Trợ thủ', receptionist: 'Lễ tân', cskh: 'CSKH', accountant: 'Kế toán', manager: 'Quản lý', other: 'Khác' };
App.APPT_STATUS = { scheduled: ['Đã đặt', 'blue'], confirmed: ['Đã xác nhận', 'teal'], arrived: ['Đã đến', 'orange'], done: ['Hoàn thành', 'green'], cancelled: ['Đã hủy', 'gray'], no_show: ['Không đến', 'red'] };
App.PAY_METHODS = ['Tiền mặt', 'Chuyển khoản', 'Quẹt thẻ', 'Ví điện tử'];
App.badge = (text, color = 'gray') => `<span class="badge ${color}">${esc(text)}</span>`;
App.apptBadge = s => { const [t, c] = App.APPT_STATUS[s] || ['?', 'gray']; return App.badge(t, c); };

/* Tài chính bệnh nhân */
App.planAmount = p => Math.max(0, (Number(p.qty) || 1) * (Number(p.price) || 0) * (1 - (Number(p.discountPct) || 0) / 100) - (Number(p.discountAmount) || 0));
App.patientFinance = pid => {
  const plans = App.S.treatmentPlans.filter(p => p.patientId === pid);
  const planTotal = App.sum(plans.filter(p => p.agreed !== false), App.planAmount);
  const treated = App.sum(App.S.treatmentSessions.filter(s => s.patientId === pid), s => s.amount);
  const tx = App.S.transactions.filter(t => t.patientId === pid);
  const paid = App.sum(tx.filter(t => t.type === 'thu'), t => t.amount) - App.sum(tx.filter(t => t.type === 'chi'), t => t.amount);
  return { planTotal, treated, paid, debt: treated - paid, remainingPlan: planTotal - treated };
};
App.planDone = p => App.sum(App.S.treatmentSessions.filter(s => s.planId === p.id), s => s.amount);

/* ---------------- Toast & Modal ---------------- */
App.toast = function (msg, type = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + type; el.textContent = msg;
  document.getElementById('toast-root').appendChild(el);
  setTimeout(() => el.remove(), type === 'error' ? 5000 : 2800);
};
App.modal = function ({ title, body = '', foot, size = '', onClose } = {}) {
  const root = document.getElementById('modal-root');
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `<div class="modal ${size}"><div class="modal-head"><h3>${esc(title || '')}</h3><button class="icon-btn" data-x>✕</button></div>
    <div class="modal-body"></div>${foot === false ? '' : `<div class="modal-foot">${foot || '<button class="btn" data-x>Đóng</button>'}</div>`}</div>`;
  const bodyEl = wrap.querySelector('.modal-body');
  if (typeof body === 'string') bodyEl.innerHTML = body; else bodyEl.appendChild(body);
  root.appendChild(wrap);
  const close = () => { wrap.remove(); onClose && onClose(); };
  wrap.addEventListener('click', e => { if (e.target.closest('[data-x]')) close(); });
  wrap.addEventListener('mousedown', e => { if (e.target === wrap) wrap.dataset.down = 1; });
  wrap.addEventListener('mouseup', e => { if (e.target === wrap && wrap.dataset.down) close(); delete wrap.dataset.down; });
  return { el: wrap, body: bodyEl, close };
};
App.confirm = msg => new Promise(resolve => {
  let done = false;
  const m = App.modal({ title: 'Xác nhận', size: 'sm', body: `<p>${esc(msg)}</p>`, foot: '<button class="btn" data-x>Hủy</button><button class="btn primary" data-ok>Đồng ý</button>', onClose: () => { if (!done) resolve(false); } });
  m.el.querySelector('[data-ok]').onclick = () => { done = true; m.close(); resolve(true); };
});

/* ---------------- Form động ----------------
 * fields: [{ name, label, type: text|number|money|date|time|select|textarea|checkbox|checks|patient|password|email|tel|color, options, required, full, placeholder, default, show(values) }]
 */
App.fieldHtml = function (f, v) {
  const id = 'f_' + f.name;
  const req = f.required ? 'required' : '';
  const ph = f.placeholder ? `placeholder="${esc(f.placeholder)}"` : '';
  let input;
  const opts = typeof f.options === 'function' ? f.options() : (f.options || []);
  const norm = opts.map(o => typeof o === 'object' ? o : { value: o, label: o });
  switch (f.type) {
    case 'select':
      input = `<select id="${id}" name="${f.name}" ${req}>${f.required && !f.noEmpty ? '' : `<option value="">${esc(f.emptyLabel || '-- Chọn --')}</option>`}${norm.map(o => `<option value="${esc(o.value)}" ${String(v ?? '') === String(o.value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`; break;
    case 'textarea': input = `<textarea id="${id}" name="${f.name}" ${req} ${ph}>${esc(v ?? '')}</textarea>`; break;
    case 'checkbox': input = `<div class="checks"><label><input type="checkbox" name="${f.name}" ${v ? 'checked' : ''}> ${esc(f.checkLabel || 'Có')}</label></div>`; break;
    case 'checks': { const arr = Array.isArray(v) ? v : []; input = `<div class="checks">${norm.map(o => `<label><input type="checkbox" name="${f.name}" value="${esc(o.value)}" ${arr.includes(o.value) ? 'checked' : ''}> ${esc(o.label)}</label>`).join('')}</div>`; break; }
    case 'patient': {
      const p = v ? App.byId('patients', v) : null;
      input = `<input id="${id}" name="${f.name}" list="${id}_list" ${req} placeholder="Gõ tên, mã hoặc SĐT khách hàng" value="${p ? esc(App.patientLabel(p)) : ''}" autocomplete="off">
        <datalist id="${id}_list">${App.S.patients.map(p => `<option value="${esc(App.patientLabel(p))}">`).join('')}</datalist>`; break;
    }
    case 'money': input = `<input id="${id}" name="${f.name}" type="text" inputmode="numeric" data-money ${req} ${ph} value="${v != null && v !== '' ? money(v) : ''}">`; break;
    default: input = `<input id="${id}" name="${f.name}" type="${f.type || 'text'}" ${req} ${ph} value="${esc(v ?? '')}" ${f.step ? `step="${f.step}"` : ''} ${f.min != null ? `min="${f.min}"` : ''}>`;
  }
  return `<div class="field ${f.full || f.type === 'textarea' ? 'full' : ''}" data-field="${f.name}"><label for="${id}">${esc(f.label)} ${f.required ? '<span class="req">*</span>' : ''}</label>${input}${f.hint ? `<div class="small muted">${esc(f.hint)}</div>` : ''}</div>`;
};
App.patientLabel = p => `${p.code || ''} - ${p.name}${p.phone ? ' - ' + p.phone : ''}`;
App.readForm = function (form, fields) {
  const out = {};
  for (const f of fields) {
    if (f.type === 'checks') { out[f.name] = [...form.querySelectorAll(`[name="${f.name}"]:checked`)].map(x => x.value); continue; }
    const el = form.querySelector(`[name="${f.name}"]`);
    if (!el) continue;
    if (f.type === 'checkbox') out[f.name] = el.checked;
    else if (f.type === 'number') out[f.name] = el.value === '' ? null : Number(el.value);
    else if (f.type === 'money') out[f.name] = Number(String(el.value).replace(/[^\d-]/g, '')) || 0;
    else if (f.type === 'patient') {
      const p = App.S.patients.find(p => App.patientLabel(p) === el.value.trim());
      out[f.name] = p ? p.id : (el.value.trim() ? '__invalid__' : '');
    } else out[f.name] = el.value.trim();
  }
  return out;
};
App.bindMoney = root => root.querySelectorAll('[data-money]').forEach(el => el.addEventListener('input', () => {
  const n = String(el.value).replace(/[^\d]/g, ''); el.value = n ? Number(n).toLocaleString('vi-VN') : '';
}));
App.formModal = function ({ title, fields, data = {}, onSubmit, size = '', submitText = 'Lưu', extraHtml = '', onRender }) {
  const form = document.createElement('form');
  form.innerHTML = `<div class="form-grid">${fields.map(f => App.fieldHtml(f, data[f.name] ?? (typeof f.default === 'function' ? f.default() : f.default))).join('')}</div>${extraHtml}`;
  const m = App.modal({ title, body: form, size, foot: `<button class="btn" data-x type="button">Hủy</button><button class="btn primary" data-submit>${esc(submitText)}</button>` });
  App.bindMoney(form);
  const refreshShow = () => { const v = App.readForm(form, fields); fields.forEach(f => { if (f.show) form.querySelector(`[data-field="${f.name}"]`).style.display = f.show(v) ? '' : 'none'; }); };
  form.addEventListener('change', refreshShow); refreshShow();
  const submit = async e => {
    e && e.preventDefault();
    if (!form.reportValidity()) return;
    const values = App.readForm(form, fields);
    for (const f of fields) if (f.type === 'patient' && values[f.name] === '__invalid__') { App.toast('Vui lòng chọn khách hàng từ danh sách gợi ý', 'error'); return; }
    const btn = m.el.querySelector('[data-submit]'); btn.disabled = true;
    try { const r = await onSubmit(values, form); if (r !== false) m.close(); }
    catch (err) { App.toast(err.message, 'error'); }
    finally { btn.disabled = false; }
  };
  form.addEventListener('submit', submit);
  m.el.querySelector('[data-submit]').onclick = submit;
  onRender && onRender(form, m);
  setTimeout(() => form.querySelector('input:not([type=checkbox]),select,textarea')?.focus(), 50);
  return m;
};

/* ---------------- Bảng có phân trang ----------------
 * columns: [{ label, render(row) -> html, cls, total(rows)->html }]
 */
App.table = function (container, { columns, rows, pageSize = 20, empty = 'Chưa có dữ liệu', onRow, footer }) {
  let page = 0;
  const draw = () => {
    const pages = Math.max(1, Math.ceil(rows.length / pageSize));
    if (page >= pages) page = pages - 1;
    const slice = rows.slice(page * pageSize, (page + 1) * pageSize);
    const hasTotal = footer || columns.some(c => c.total);
    container.innerHTML = `<div class="table-wrap"><table class="tbl"><thead><tr>${columns.map(c => `<th class="${c.cls || ''}">${c.label}</th>`).join('')}</tr></thead>
      <tbody>${slice.length ? slice.map((r, i) => `<tr data-i="${page * pageSize + i}">${columns.map(c => `<td class="${c.cls || ''}">${c.render(r, page * pageSize + i)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${columns.length}" class="empty">${empty}</td></tr>`}</tbody>
      ${hasTotal && rows.length ? `<tfoot><tr>${columns.map(c => `<td class="${c.cls || ''}">${c.total ? c.total(rows) : ''}</td>`).join('')}</tr></tfoot>` : ''}</table></div>
      ${rows.length > pageSize ? `<div class="pager">Tổng ${rows.length} dòng · Trang ${page + 1}/${pages} <button class="btn sm" data-p="-1" ${page === 0 ? 'disabled' : ''}>‹ Trước</button><button class="btn sm" data-p="1" ${page >= pages - 1 ? 'disabled' : ''}>Sau ›</button></div>` : rows.length ? `<div class="pager">Tổng ${rows.length} dòng</div>` : ''}`;
    container.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { page += Number(b.dataset.p); draw(); });
    if (onRow) container.querySelectorAll('tbody tr[data-i]').forEach(tr => tr.addEventListener('click', e => { if (!e.target.closest('button,a,input,select')) onRow(rows[tr.dataset.i]); }));
  };
  draw();
  return { redraw: draw };
};
/* Gắn sự kiện theo data-act */
App.on = (root, handlers) => root.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el || !root.contains(el)) return;
  const fn = handlers[el.dataset.act]; if (fn) { e.preventDefault(); fn(el.dataset.id, el, e); }
});

/* ---------------- Xuất Excel (CSV) & In ---------------- */
App.exportCSV = function (filename, columns, rows) {
  const escCsv = v => { const s = String(v ?? ''); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const lines = [columns.map(c => escCsv(c.label)).join(','), ...rows.map(r => columns.map(c => escCsv(c.value(r))).join(','))];
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
App.print = function (html) {
  let el = document.getElementById('print-area');
  if (!el) { el = document.createElement('div'); el.id = 'print-area'; document.body.appendChild(el); }
  const s = App.S.settings;
  el.innerHTML = `<div class="print-head"><div><b style="font-size:16px">${esc(s.clinicName)}</b><br>${esc(s.address || '')}<br>ĐT: ${esc(s.phone || '')}</div><div class="right">Ngày in: ${fmtDate(today())}</div></div>${html}`;
  setTimeout(() => window.print(), 100);
};

/* Bộ lọc khoảng ngày dùng chung */
App.rangeInputs = (from, to) => `<input type="date" class="input" data-from value="${from}"> → <input type="date" class="input" data-to value="${to}">
  <select class="input" data-preset><option value="">Khoảng nhanh</option><option value="today">Hôm nay</option><option value="7">7 ngày qua</option><option value="month">Tháng này</option><option value="lastmonth">Tháng trước</option><option value="year">Năm nay</option></select>`;
App.bindRange = (root, cb) => {
  const f = root.querySelector('[data-from]'), t = root.querySelector('[data-to]'), p = root.querySelector('[data-preset]');
  const fire = () => cb(f.value, t.value);
  f.onchange = fire; t.onchange = fire;
  p.onchange = () => {
    const d = today();
    if (p.value === 'today') { f.value = d; t.value = d; }
    if (p.value === '7') { f.value = App.addDays(d, -6); t.value = d; }
    if (p.value === 'month') { f.value = App.monthStart(); t.value = App.monthEnd(); }
    if (p.value === 'lastmonth') { const s = App.addDays(App.monthStart(), -1); f.value = App.monthStart(s); t.value = App.monthEnd(s); }
    if (p.value === 'year') { f.value = d.slice(0, 4) + '-01-01'; t.value = d.slice(0, 4) + '-12-31'; }
    p.value = ''; fire();
  };
};

App.go = (hash) => { location.hash = hash; };
App.readFile = file => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
/* Thu nhỏ ảnh trước khi tải lên để tiết kiệm dung lượng */
App.compressImage = async (file, max = 1800) => {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return App.readFile(file);
  const url = await App.readFile(file);
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85);
};
