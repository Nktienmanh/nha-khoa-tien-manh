/*
 * Lưu trữ trên Firebase: Firebase Authentication (đăng nhập) + Cloud Firestore (dữ liệu, đồng bộ realtime).
 * Chỉ bật khi public/firebase-config.js có apiKey. Lớp này thay thế App.api của máy chủ Node
 * bằng các lệnh tương đương trên Firestore nên toàn bộ các trang giữ nguyên.
 */
(function () {
  const cfg = window.FIREBASE_CONFIG;
  if (!cfg || !cfg.apiKey) return;

  const SDK = '10.14.1';
  const COLLECTIONS = ['patients', 'exams', 'treatmentPlans', 'treatmentSessions', 'prescriptions', 'images', 'labOrders', 'appointments', 'careTasks', 'transactions', 'staff', 'users', 'services', 'serviceGroups', 'toothConditions', 'medicines', 'materials', 'stockMoves', 'branches', 'sources', 'txCategories'];
  const PATIENT_CHILDREN = ['exams', 'treatmentPlans', 'treatmentSessions', 'prescriptions', 'images', 'labOrders', 'appointments', 'careTasks'];
  const ADMIN_ONLY_WRITE = new Set(['users', 'branches']);
  const CODE_PREFIX = { patients: 'KH', appointments: 'LH', prescriptions: 'DT', labOrders: 'XL' };
  const MAX_IMAGE_CHARS = 1000000; // Firestore giới hạn 1MB / tài liệu

  let fs, auth, profile = null, initP = null, readyP = null, unsubs = [], loaded = false;

  App.mode = 'firebase';
  App.fb = {};

  const loadScript = src => new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src; s.onload = res;
    s.onerror = () => rej(new Error('Không tải được thư viện Firebase (kiểm tra kết nối mạng)'));
    document.head.appendChild(s);
  });
  const init = () => initP || (initP = (async () => {
    for (const m of ['app', 'auth', 'firestore']) await loadScript(`https://www.gstatic.com/firebasejs/${SDK}/firebase-${m}-compat.js`);
    firebase.initializeApp(cfg);
    auth = firebase.auth(); fs = firebase.firestore();
    await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
  })());

  const nowIso = () => new Date().toISOString();
  const newId = () => fs.collection('_').doc().id;
  const clean = o => JSON.parse(JSON.stringify(o)); // Firestore không nhận giá trị undefined
  const fail = (msg, status = 400) => Object.assign(new Error(msg), { status });
  const isAdmin = () => profile?.role === 'admin';

  function viMsg(e) {
    const c = e.code || '';
    if (/invalid-credential|wrong-password|user-not-found|invalid-email|invalid-login/.test(c)) return 'Sai email hoặc mật khẩu';
    if (c.includes('too-many-requests')) return 'Đăng nhập sai quá nhiều lần, vui lòng thử lại sau ít phút';
    if (c.includes('email-already-in-use')) return 'Email này đã có tài khoản';
    if (c.includes('weak-password')) return 'Mật khẩu quá yếu (tối thiểu 6 ký tự)';
    if (c.includes('requires-recent-login')) return 'Vui lòng đăng nhập lại rồi thử lại';
    if (c.includes('permission-denied')) return 'Không có quyền thực hiện thao tác này';
    if (c.includes('unavailable')) return 'Mất kết nối tới Firebase, vui lòng kiểm tra mạng';
    if (c.includes('network-request-failed')) return 'Lỗi mạng, vui lòng kiểm tra kết nối Internet';
    return e.message || 'Lỗi không xác định';
  }

  /* Ghi theo lô (Firestore tối đa 500 thao tác / lô) */
  async function batchOps(ops) {
    for (let i = 0; i < ops.length; i += 400) {
      const b = fs.batch();
      for (const op of ops.slice(i, i + 400)) op.type === 'delete' ? b.delete(op.ref) : b.set(op.ref, op.data);
      await b.commit();
    }
  }

  async function seedClinic() {
    const s = window.NKTM_SEED.buildSeed(newId, nowIso);
    const ops = [{ ref: fs.collection('meta').doc('settings'), data: s.settings }];
    for (const [col, list] of Object.entries(s)) if (Array.isArray(list)) for (const it of list) ops.push({ ref: fs.collection(col).doc(it.id), data: clean(it) });
    await batchOps(ops);
  }

  /* Hồ sơ người dùng (users/{uid}). Người đăng nhập đầu tiên của một dự án trống trở thành quản trị viên. */
  async function ensureProfile(user) {
    const ref = fs.collection('users').doc(user.uid);
    const snap = await ref.get();
    if (snap.exists) {
      const p = { ...snap.data(), id: snap.id };
      if (p.active === false) throw fail('Tài khoản đã bị khóa', 403);
      return p;
    }
    const setup = await fs.collection('meta').doc('setup').get();
    if (setup.exists) throw fail('Tài khoản chưa được cấp quyền. Liên hệ quản trị viên phòng khám.', 403);
    const p = { username: user.email, name: 'Quản trị viên', role: 'admin', active: true, createdAt: nowIso() };
    await ref.set(p);
    await fs.collection('meta').doc('setup').set({ at: nowIso(), by: user.uid });
    await seedClinic();
    return { ...p, id: user.uid };
  }

  function addLog(action, collection, item, summary) {
    fs.collection('logs').add(clean({
      at: nowIso(), userId: profile?.id, userName: profile?.name || profile?.username, action, collection,
      refId: item?.id || null, patientId: collection === 'patients' ? item?.id : (item?.patientId || null), summary: summary || ''
    })).catch(e => console.warn('Ghi nhật ký lỗi', e));
  }
  const label = x => x?.name || x?.code || x?.serviceName || x?.content || '';

  async function nextCode(prefix) {
    const ref = fs.collection('meta').doc('counters');
    const n = await fs.runTransaction(async tx => {
      const d = await tx.get(ref);
      const v = ((d.exists && d.data()[prefix]) || 0) + 1;
      tx.set(ref, { [prefix]: v }, { merge: true });
      return v;
    });
    return prefix + String(n).padStart(5, '0');
  }

  /* ---------- Tải dữ liệu + đồng bộ realtime ---------- */
  let renderTimer = null;
  function remoteChanged() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => {
      const typing = document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
      if (!document.querySelector('.modal-backdrop') && !typing) App.render();
    }, 500);
  }
  function stopSync() { unsubs.forEach(u => u()); unsubs = []; loaded = false; }

  App.loadAll = async function () {
    await init();
    if (loaded) return App.S;
    stopSync();
    App.S = { settings: {} };
    COLLECTIONS.forEach(c => App.S[c] = []);
    const firsts = [];
    const listen = (q, onData) => firsts.push(new Promise((res, rej) => {
      let first = true;
      unsubs.push(q.onSnapshot(snap => {
        onData(snap);
        if (first) { first = false; res(); } else if (!snap.metadata.hasPendingWrites) remoteChanged();
      }, e => { if (first) { first = false; rej(e); } else console.error(e); }));
    }));
    for (const c of COLLECTIONS) listen(fs.collection(c), snap => { App.S[c] = snap.docs.map(d => ({ ...d.data(), id: d.id })); });
    listen(fs.collection('meta').doc('settings'), d => { App.S.settings = d.data() || {}; });
    try { await Promise.all(firsts); } catch (e) { stopSync(); throw new Error(viMsg(e)); }
    loaded = true;
    return App.S;
  };

  /* ---------- Ảnh: lưu dạng nén trong Firestore (không cần gói trả phí Storage) ---------- */
  const imgCache = new Map();
  App.uploadUrl = url => (url && !String(url).startsWith('fsimg:')) ? url : '';
  App.hydrateImages = root => root.querySelectorAll('img[data-img^="fsimg:"]').forEach(async img => {
    const id = img.dataset.img.slice(6);
    try {
      if (!imgCache.has(id)) { const s = await fs.collection('imageData').doc(id).get(); imgCache.set(id, s.data()?.data || ''); }
      img.src = imgCache.get(id);
    } catch (e) { console.warn(e); }
  });
  const compress = App.compressImage;
  App.compressImage = file => compress(file, 1400);

  /* ---------- Sao lưu ---------- */
  App.downloadBackup = async function () {
    App.toast('Đang tổng hợp dữ liệu sao lưu...');
    const out = { settings: App.S.settings, exportedAt: nowIso(), source: 'firebase' };
    for (const c of COLLECTIONS) out[c] = App.S[c];
    const counters = await fs.collection('meta').doc('counters').get();
    out.counters = counters.data() || {};
    const logs = await fs.collection('logs').orderBy('at', 'desc').limit(5000).get();
    out.logs = logs.docs.map(d => ({ ...d.data(), id: d.id }));
    const imgs = await fs.collection('imageData').get();
    out.imageData = imgs.docs.map(d => ({ id: d.id, data: d.data().data }));
    const blob = new Blob([JSON.stringify(out)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `nhakhoa-tienmanh-${App.today()}.json`; a.click();
  };

  async function restore(data) {
    if (!isAdmin()) throw fail('Chỉ quản trị viên', 403);
    if (!data || !Array.isArray(data.patients)) throw fail('File sao lưu không hợp lệ');
    const ops = [];
    // Giữ nguyên tài khoản đăng nhập hiện tại (tài khoản gắn với Firebase Authentication)
    for (const c of COLLECTIONS.filter(c => c !== 'users')) {
      const cur = await fs.collection(c).get();
      cur.docs.forEach(d => ops.push({ type: 'delete', ref: d.ref }));
      for (const it of data[c] || []) { const { id, ...rest } = it; ops.push({ ref: fs.collection(c).doc(id || newId()), data: clean(rest) }); }
    }
    if (Array.isArray(data.imageData)) for (const im of data.imageData) ops.push({ ref: fs.collection('imageData').doc(im.id), data: { data: im.data } });
    ops.push({ ref: fs.collection('meta').doc('settings'), data: clean(data.settings || {}) });
    ops.push({ ref: fs.collection('meta').doc('counters'), data: clean(data.counters || {}) });
    await batchOps(ops);
    addLog('restore', 'db', null, 'Khôi phục dữ liệu từ file sao lưu');
  }

  /* Tạo tài khoản Firebase Auth cho nhân viên mà không đăng xuất quản trị viên (dùng app phụ) */
  async function createAuthUser(email, password) {
    const sec = firebase.apps.find(a => a.name === 'secondary') || firebase.initializeApp(cfg, 'secondary');
    const c = await sec.auth().createUserWithEmailAndPassword(email, password);
    await sec.auth().signOut();
    return c.user.uid;
  }

  /* ---------- Thay thế App.api ---------- */
  async function handle(method, parts, qs, body) {
    const col = parts[0];
    if (col === 'login' && method === 'POST') {
      const cred = await auth.signInWithEmailAndPassword(String(body.username || '').trim(), body.password || '');
      try { profile = await ensureProfile(cred.user); } catch (e) { await auth.signOut(); throw e; }
      addLog('login', 'users', profile, 'Đăng nhập');
      return { token: 'firebase', user: profile };
    }
    if (!auth.currentUser) throw fail('Phiên đăng nhập đã hết hạn', 401);
    if (col === 'logout') { stopSync(); profile = null; await auth.signOut(); return { ok: true }; }
    if (col === 'me') { profile = await ensureProfile(auth.currentUser); return profile; }
    if (col === 'change-password') {
      const u = auth.currentUser;
      if (!body.newPassword || body.newPassword.length < 6) throw fail('Mật khẩu mới tối thiểu 6 ký tự');
      await u.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(u.email, body.oldPassword || ''));
      await u.updatePassword(body.newPassword);
      if (profile.mustChangePassword) await fs.collection('users').doc(u.uid).update({ mustChangePassword: false });
      return { ok: true };
    }
    if (col === 'db') return App.loadAll();
    if (col === 'logs') {
      const pid = qs.get('patientId'); const limit = Math.min(Number(qs.get('limit')) || 300, 2000);
      const snap = pid ? await fs.collection('logs').where('patientId', '==', pid).get() : await fs.collection('logs').orderBy('at', 'desc').limit(limit).get();
      return App.sortBy(snap.docs.map(d => ({ ...d.data(), id: d.id })), l => l.at, true).slice(0, limit);
    }
    if (col === 'settings' && method === 'PUT') {
      if (!isAdmin()) throw fail('Chỉ quản trị viên được sửa cài đặt', 403);
      await fs.collection('meta').doc('settings').set(clean(body), { merge: true });
      addLog('update', 'settings', null, 'Cập nhật cài đặt phòng khám');
      return { ...App.S.settings, ...body };
    }
    if (col === 'upload') {
      const m = /^data:([\w/+.-]+);base64,/.exec(body.dataUrl || '');
      if (!m || !m[1].startsWith('image/')) throw fail('Chế độ Firebase chỉ hỗ trợ tải lên file ảnh');
      if (body.dataUrl.length > MAX_IMAGE_CHARS) throw fail('Ảnh quá lớn sau khi nén, hãy chọn ảnh nhỏ hơn');
      const id = newId();
      await fs.collection('imageData').doc(id).set({ data: body.dataUrl, createdAt: nowIso() });
      imgCache.set(id, body.dataUrl);
      return { url: 'fsimg:' + id, name: body.name };
    }
    if (col === 'backup') {
      if (parts[1] === 'restore') { await restore(body); return { ok: true }; }
      return [];
    }

    if (!COLLECTIONS.includes(col)) throw fail('Không tìm thấy chức năng', 404);
    if (method !== 'GET' && ADMIN_ONLY_WRITE.has(col) && !isAdmin()) throw fail('Chỉ quản trị viên được thực hiện', 403);
    const id = parts[1];
    const ref = fs.collection(col);

    if (method === 'GET') {
      if (id) { const d = await ref.doc(id).get(); if (!d.exists) throw fail('Không tìm thấy', 404); return { ...d.data(), id }; }
      return App.S[col];
    }

    if (method === 'POST') {
      const created = [];
      for (const raw of Array.isArray(body) ? body : [body]) {
        const item = { ...raw, createdAt: nowIso(), createdBy: profile.id };
        let docId = newId();
        if (col === 'users') {
          const email = String(item.username || '').trim().toLowerCase();
          if (!/^\S+@\S+\.\S+$/.test(email)) throw fail('Chế độ Firebase: tên đăng nhập phải là địa chỉ email');
          if (!item.password) throw fail('Cần nhập mật khẩu');
          docId = await createAuthUser(email, item.password);
          item.username = email; delete item.password;
        }
        if (CODE_PREFIX[col] && !item.code) item.code = await nextCode(CODE_PREFIX[col]);
        if (col === 'transactions' && !item.code) item.code = await nextCode(item.type === 'chi' ? 'PC' : 'PT');
        if (col === 'stockMoves' && !item.code) item.code = await nextCode(item.type === 'out' ? 'PX' : 'PN');
        const data = clean(item);
        await ref.doc(docId).set(data);
        const saved = { ...data, id: docId };
        addLog('create', col, saved, label(saved));
        created.push(saved);
      }
      return Array.isArray(body) ? created : created[0];
    }

    if (method === 'PUT' && id) {
      const existing = App.S[col].find(x => x.id === id) || {};
      const patch = { ...body };
      delete patch.id; delete patch.createdAt;
      if (col === 'users') {
        if (patch.password) {
          await auth.sendPasswordResetEmail(existing.username || patch.username);
          App.toast('Firebase không cho đặt mật khẩu hộ. Đã gửi email đặt lại mật khẩu tới ' + (existing.username || patch.username), 'success');
        }
        delete patch.password; delete patch.username; // email đăng nhập gắn với Firebase Auth, không đổi tại đây
      }
      Object.assign(patch, { updatedAt: nowIso(), updatedBy: profile.id });
      await ref.doc(id).set(clean(patch), { merge: true });
      const saved = { ...existing, ...patch, id };
      addLog('update', col, saved, label(saved));
      return saved;
    }

    if (method === 'DELETE' && id) {
      if (col === 'users' && id === profile.id) throw fail('Không thể xóa tài khoản đang đăng nhập');
      const removed = App.S[col].find(x => x.id === id) || { id };
      const ops = [{ type: 'delete', ref: ref.doc(id) }];
      const dropImage = im => { if (String(im.url || '').startsWith('fsimg:')) ops.push({ type: 'delete', ref: fs.collection('imageData').doc(im.url.slice(6)) }); };
      if (col === 'patients') for (const c of PATIENT_CHILDREN) for (const x of App.S[c].filter(x => x.patientId === id)) { ops.push({ type: 'delete', ref: fs.collection(c).doc(x.id) }); if (c === 'images') dropImage(x); }
      if (col === 'treatmentPlans') for (const s of App.S.treatmentSessions.filter(s => s.planId === id)) ops.push({ type: 'delete', ref: fs.collection('treatmentSessions').doc(s.id) });
      if (col === 'images') dropImage(removed);
      await batchOps(ops);
      addLog('delete', col, removed, label(removed));
      return { ok: true };
    }
    throw fail('Thao tác không hỗ trợ', 405);
  }

  App.api = async function (method, url, body) {
    await init();
    const [path, query] = url.split('?');
    const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
    try { return await handle(method, parts, new URLSearchParams(query || ''), body); }
    catch (e) {
      if (e.status === 401 && parts[0] !== 'login' && parts[0] !== 'me') App.logout(true);
      throw new Error(viMsg(e));
    }
  };

  /* Chờ Firebase khôi phục phiên đăng nhập cũ (nếu có) */
  App.fb.ready = () => readyP || (readyP = (async () => {
    await init();
    const user = await new Promise(res => { const un = auth.onAuthStateChanged(u => { un(); res(u); }); });
    if (!user) return false;
    try { profile = await ensureProfile(user); return true; }
    catch (e) { await auth.signOut(); App.toast(viMsg(e), 'error'); return false; }
  })());
  App.fb.signOut = async () => { stopSync(); profile = null; readyP = null; if (auth) await auth.signOut(); };
})();
