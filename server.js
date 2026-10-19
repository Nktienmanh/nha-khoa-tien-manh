/*
 * Nha Khoa Tiến Mạnh - Máy chủ quản lý phòng khám
 * Chạy: node server.js   (không cần cài thêm thư viện)
 * Toàn bộ dữ liệu được lưu tại máy chủ đang chạy, trong thư mục ./data
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const MAX_BODY = 25 * 1024 * 1024;
const SESSION_TTL = 12 * 60 * 60 * 1000;

const COLLECTIONS = [
  'patients', 'exams', 'treatmentPlans', 'treatmentSessions', 'prescriptions', 'images',
  'labOrders', 'appointments', 'careTasks', 'transactions', 'staff', 'users', 'services',
  'serviceGroups', 'toothConditions', 'medicines', 'materials', 'stockMoves', 'branches',
  'sources', 'txCategories', 'logs'
];
const ADMIN_ONLY_WRITE = new Set(['users', 'branches']);

for (const d of [DATA_DIR, UPLOAD_DIR, BACKUP_DIR]) fs.mkdirSync(d, { recursive: true });

/* ---------------- Mật khẩu ---------------- */
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(pw), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}
function verifyPassword(pw, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(String(pw), salt, 64);
  const orig = Buffer.from(hash, 'hex');
  return orig.length === test.length && crypto.timingSafeEqual(orig, test);
}

/* ---------------- Cơ sở dữ liệu (file JSON) ---------------- */
const uid = () => Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
const now = () => new Date().toISOString();

const { buildSeed } = require('./public/js/seed.js');
function seedData() {
  const db = { settings: {}, counters: {} };
  for (const c of COLLECTIONS) db[c] = [];
  Object.assign(db, buildSeed(uid, now));
  db.users.push({ id: uid(), username: 'admin', passwordHash: hashPassword('admin123'), name: 'Quản trị viên', role: 'admin', active: true, mustChangePassword: true, createdAt: now() });
  return db;
}

let db;
function loadDb() {
  if (fs.existsSync(DB_FILE)) {
    try {
      db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) {
      console.error('Không đọc được data/db.json:', e.message);
      console.error('Hãy khôi phục từ thư mục data/backups. Máy chủ dừng để tránh mất dữ liệu.');
      process.exit(1);
    }
    for (const c of COLLECTIONS) if (!Array.isArray(db[c])) db[c] = [];
    db.settings = db.settings || {};
    db.counters = db.counters || {};
  } else {
    db = seedData();
    saveDbNow();
    console.log('Đã khởi tạo dữ liệu mới. Tài khoản mặc định: admin / admin123 (hãy đổi mật khẩu ngay).');
  }
}

let saveTimer = null;
function saveDbNow() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, DB_FILE);
}
function saveDb() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveDbNow, 150);
}

function backup(label = 'auto') {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const file = path.join(BACKUP_DIR, `db-${stamp}-${label}.json`);
  fs.writeFileSync(file, JSON.stringify(db));
  const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json')).sort();
  while (files.length > 60) fs.unlinkSync(path.join(BACKUP_DIR, files.shift()));
  return path.basename(file);
}

function nextCode(prefix) {
  db.counters[prefix] = (db.counters[prefix] || 0) + 1;
  return prefix + String(db.counters[prefix]).padStart(5, '0');
}
const CODE_PREFIX = { patients: 'KH', transactions: null, appointments: 'LH', prescriptions: 'DT', labOrders: 'XL', stockMoves: null };

/* ---------------- Phiên đăng nhập ---------------- */
const sessions = new Map();
function publicUser(u) {
  if (!u) return null;
  const { passwordHash, ...rest } = u;
  return rest;
}
function getSession(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return null;
  const s = sessions.get(token);
  if (!s || s.expires < Date.now()) { sessions.delete(token); return null; }
  const user = db.users.find(u => u.id === s.userId && u.active !== false);
  if (!user) return null;
  s.expires = Date.now() + SESSION_TTL;
  return { token, user };
}

function addLog(user, action, collection, item, summary) {
  db.logs.push({
    id: uid(), at: now(), userId: user?.id, userName: user?.name || user?.username, action, collection,
    refId: item?.id, patientId: collection === 'patients' ? item?.id : item?.patientId, summary: summary || ''
  });
  if (db.logs.length > 20000) db.logs.splice(0, db.logs.length - 20000);
}

/* ---------------- HTTP helpers ---------------- */
function send(res, status, data, headers = {}) {
  const body = typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > MAX_BODY) { reject(Object.assign(new Error('Dữ liệu gửi lên quá lớn'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(Object.assign(new Error('JSON không hợp lệ'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json', '.pdf': 'application/pdf' };

function serveFile(res, baseDir, rel) {
  const file = path.normalize(path.join(baseDir, rel));
  if (!file.startsWith(baseDir)) return send(res, 403, { error: 'Forbidden' });
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      if (baseDir === PUBLIC_DIR) return serveFile(res, PUBLIC_DIR, 'index.html');
      return send(res, 404, { error: 'Không tìm thấy' });
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': baseDir === PUBLIC_DIR ? 'no-cache' : 'private, max-age=86400' });
    fs.createReadStream(file).pipe(res);
  });
}

/* ---------------- API ---------------- */
async function handleApi(req, res, url) {
  const parts = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const method = req.method;

  if (parts[0] === 'login' && method === 'POST') {
    const { username, password } = await readBody(req);
    const user = db.users.find(u => u.username === String(username || '').trim().toLowerCase() && u.active !== false);
    if (!user || !verifyPassword(password, user.passwordHash)) return send(res, 401, { error: 'Sai tên đăng nhập hoặc mật khẩu' });
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { userId: user.id, expires: Date.now() + SESSION_TTL });
    addLog(user, 'login', 'users', user, 'Đăng nhập'); saveDb();
    return send(res, 200, { token, user: publicUser(user) });
  }
  if (parts[0] === 'clinic' && method === 'GET') {
    return send(res, 200, { clinicName: db.settings.clinicName });
  }

  const session = getSession(req);
  if (!session) return send(res, 401, { error: 'Phiên đăng nhập đã hết hạn' });
  const { user } = session;
  const isAdmin = user.role === 'admin';

  if (parts[0] === 'logout' && method === 'POST') { sessions.delete(session.token); return send(res, 200, { ok: true }); }
  if (parts[0] === 'me' && method === 'GET') return send(res, 200, publicUser(user));

  if (parts[0] === 'change-password' && method === 'POST') {
    const { oldPassword, newPassword } = await readBody(req);
    if (!verifyPassword(oldPassword, user.passwordHash)) return send(res, 400, { error: 'Mật khẩu cũ không đúng' });
    if (!newPassword || String(newPassword).length < 6) return send(res, 400, { error: 'Mật khẩu mới tối thiểu 6 ký tự' });
    user.passwordHash = hashPassword(newPassword); user.mustChangePassword = false; user.updatedAt = now();
    addLog(user, 'update', 'users', user, 'Đổi mật khẩu'); saveDb();
    return send(res, 200, { ok: true });
  }

  // Toàn bộ dữ liệu (phòng khám quy mô vừa -> tải 1 lần, nhanh & đơn giản)
  if (parts[0] === 'db' && method === 'GET') {
    const out = { settings: db.settings };
    for (const c of COLLECTIONS) {
      if (c === 'logs') continue;
      out[c] = c === 'users' ? db.users.map(publicUser) : db[c];
    }
    return send(res, 200, out);
  }

  if (parts[0] === 'logs' && method === 'GET') {
    const pid = url.searchParams.get('patientId');
    const limit = Math.min(Number(url.searchParams.get('limit')) || 300, 2000);
    let list = db.logs;
    if (pid) list = list.filter(l => l.patientId === pid);
    return send(res, 200, list.slice(-limit).reverse());
  }

  if (parts[0] === 'settings' && method === 'PUT') {
    if (!isAdmin) return send(res, 403, { error: 'Chỉ quản trị viên được sửa cài đặt' });
    const body = await readBody(req);
    db.settings = { ...db.settings, ...body };
    addLog(user, 'update', 'settings', null, 'Cập nhật cài đặt phòng khám'); saveDb();
    return send(res, 200, db.settings);
  }

  if (parts[0] === 'upload' && method === 'POST') {
    const { dataUrl, name } = await readBody(req);
    const m = /^data:([\w/+.-]+);base64,(.+)$/.exec(dataUrl || '');
    if (!m) return send(res, 400, { error: 'File không hợp lệ' });
    const ext = ({ 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'application/pdf': '.pdf' })[m[1]];
    if (!ext) return send(res, 400, { error: 'Chỉ hỗ trợ ảnh JPG/PNG/WEBP/GIF hoặc PDF' });
    const fname = uid() + ext;
    fs.writeFileSync(path.join(UPLOAD_DIR, fname), Buffer.from(m[2], 'base64'));
    return send(res, 200, { url: '/uploads/' + fname, name: name || fname });
  }

  if (parts[0] === 'backup') {
    if (!isAdmin) return send(res, 403, { error: 'Chỉ quản trị viên' });
    if (method === 'GET' && !parts[1]) {
      const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json')).sort().reverse()
        .map(f => ({ name: f, size: fs.statSync(path.join(BACKUP_DIR, f)).size }));
      return send(res, 200, files);
    }
    if (method === 'POST' && parts[1] === 'create') return send(res, 200, { name: backup('manual') });
    if (method === 'GET' && parts[1] === 'download') {
      const stamp = new Date().toISOString().slice(0, 10);
      return send(res, 200, JSON.stringify(db), { 'Content-Disposition': `attachment; filename="nhakhoa-tienmanh-${stamp}.json"` });
    }
    if (method === 'POST' && parts[1] === 'restore') {
      const body = await readBody(req);
      if (!body || !Array.isArray(body.patients) || !Array.isArray(body.users)) return send(res, 400, { error: 'File sao lưu không hợp lệ' });
      backup('before-restore');
      db = body;
      for (const c of COLLECTIONS) if (!Array.isArray(db[c])) db[c] = [];
      db.settings = db.settings || {}; db.counters = db.counters || {};
      addLog(user, 'restore', 'db', null, 'Khôi phục dữ liệu từ file sao lưu');
      saveDbNow();
      return send(res, 200, { ok: true });
    }
  }

  // CRUD chung: /api/:collection[/:id]
  const col = parts[0];
  if (!COLLECTIONS.includes(col) || col === 'logs') return send(res, 404, { error: 'Không tìm thấy API' });
  const list = db[col];
  const id = parts[1];
  if (method !== 'GET' && ADMIN_ONLY_WRITE.has(col) && !isAdmin) return send(res, 403, { error: 'Chỉ quản trị viên được thực hiện' });

  if (method === 'GET') {
    if (id) { const it = list.find(x => x.id === id); return it ? send(res, 200, col === 'users' ? publicUser(it) : it) : send(res, 404, { error: 'Không tìm thấy' }); }
    return send(res, 200, col === 'users' ? list.map(publicUser) : list);
  }

  if (method === 'POST') {
    const body = await readBody(req);
    const items = Array.isArray(body) ? body : [body];
    const created = [];
    for (const raw of items) {
      const item = { ...raw, id: uid(), createdAt: now(), createdBy: user.id };
      if (col === 'users') {
        item.username = String(item.username || '').trim().toLowerCase();
        if (!item.username || !item.password) return send(res, 400, { error: 'Cần tên đăng nhập và mật khẩu' });
        if (db.users.some(u => u.username === item.username)) return send(res, 400, { error: 'Tên đăng nhập đã tồn tại' });
        item.passwordHash = hashPassword(item.password); delete item.password;
      }
      if (CODE_PREFIX[col] && !item.code) item.code = nextCode(CODE_PREFIX[col]);
      if (col === 'transactions' && !item.code) item.code = nextCode(item.type === 'chi' ? 'PC' : 'PT');
      if (col === 'stockMoves' && !item.code) item.code = nextCode(item.type === 'out' ? 'PX' : 'PN');
      list.push(item);
      addLog(user, 'create', col, item, item.name || item.code || item.serviceName || item.content || '');
      created.push(col === 'users' ? publicUser(item) : item);
    }
    saveDb();
    return send(res, 201, Array.isArray(body) ? created : created[0]);
  }

  if (method === 'PUT' && id) {
    const idx = list.findIndex(x => x.id === id);
    if (idx < 0) return send(res, 404, { error: 'Không tìm thấy' });
    const body = await readBody(req);
    delete body.id; delete body.createdAt; delete body.passwordHash;
    if (col === 'users') {
      if (body.password) { body.passwordHash = hashPassword(body.password); }
      delete body.password;
      if (body.username) body.username = String(body.username).trim().toLowerCase();
      if (body.username && db.users.some(u => u.username === body.username && u.id !== id)) return send(res, 400, { error: 'Tên đăng nhập đã tồn tại' });
    }
    list[idx] = { ...list[idx], ...body, updatedAt: now(), updatedBy: user.id };
    addLog(user, 'update', col, list[idx], list[idx].name || list[idx].code || list[idx].serviceName || '');
    saveDb();
    return send(res, 200, col === 'users' ? publicUser(list[idx]) : list[idx]);
  }

  if (method === 'DELETE' && id) {
    const idx = list.findIndex(x => x.id === id);
    if (idx < 0) return send(res, 404, { error: 'Không tìm thấy' });
    if (col === 'users' && id === user.id) return send(res, 400, { error: 'Không thể xóa tài khoản đang đăng nhập' });
    const [removed] = list.splice(idx, 1);
    if (col === 'patients') {
      for (const c of ['exams', 'treatmentPlans', 'treatmentSessions', 'prescriptions', 'images', 'labOrders', 'appointments', 'careTasks']) {
        db[c] = db[c].filter(x => x.patientId !== id);
      }
    }
    if (col === 'treatmentPlans') db.treatmentSessions = db.treatmentSessions.filter(x => x.planId !== id);
    addLog(user, 'delete', col, removed, removed.name || removed.code || removed.serviceName || '');
    saveDb();
    return send(res, 200, { ok: true });
  }

  return send(res, 405, { error: 'Phương thức không hỗ trợ' });
}

/* ---------------- Khởi động ---------------- */
loadDb();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    if (url.pathname.startsWith('/uploads/')) {
      // Ảnh bệnh nhân chỉ trả về khi có token (qua query ?t=) để tránh lộ dữ liệu
      const token = url.searchParams.get('t');
      const s = token && sessions.get(token);
      if (!s || s.expires < Date.now()) return send(res, 401, { error: 'Cần đăng nhập' });
      return serveFile(res, UPLOAD_DIR, url.pathname.slice('/uploads/'.length));
    }
    return serveFile(res, PUBLIC_DIR, url.pathname === '/' ? 'index.html' : url.pathname);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(res, e.status || 500, { error: e.message || 'Lỗi máy chủ' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('==============================================');
  console.log('  NHA KHOA TIẾN MẠNH - Hệ thống quản lý');
  console.log('==============================================');
  console.log(`  Trên máy này:   http://localhost:${PORT}`);
  for (const ifs of Object.values(os.networkInterfaces())) {
    for (const i of ifs || []) if (i.family === 'IPv4' && !i.internal) console.log(`  Máy khác (LAN): http://${i.address}:${PORT}`);
  }
  console.log(`  Dữ liệu lưu tại: ${DATA_DIR}`);
  console.log('  Nhấn Ctrl+C để dừng máy chủ.');
});

// Sao lưu tự động: khi khởi động và mỗi 6 giờ
backup('startup');
setInterval(() => backup('auto'), 6 * 60 * 60 * 1000);

function shutdown() { clearTimeout(saveTimer); saveDbNow(); process.exit(0); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
