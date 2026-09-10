/* ===== MAIN APP LOGIC ===== */

// ---- State ----
let currentUserId = null;
let dashChartInstance = null;

// ---- Avatar Colors ----
const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#f97316','#06b6d4','#84cc16'];
function avatarColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return COLORS[Math.abs(h) % COLORS.length];
}
function initials(name) {
  const p = name.trim().split(' ');
  if (p.length >= 2) return p[0][0] + p[1][0];
  return p[0].substring(0, 2);
}

// ---- Session Management ----
function setSession(username) {
  try {
    localStorage.setItem('tamween_session', JSON.stringify({
      loggedIn: true,
      username: username,
      loginTime: Date.now()
    }));
  } catch (e) {}
}

function getSession() {
  try {
    const raw = localStorage.getItem('tamween_session');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
}

function clearSession() {
  try {
    localStorage.removeItem('tamween_session');
  } catch (e) {}
}

// ---- Init ----
window.addEventListener('DOMContentLoaded', () => {
  DB.init();
  startFirestoreSync(); // Pre-load cloud data in background during splash
  populateMonthSelect('dash-month-select');

  const session = getSession();

  setTimeout(() => {
    const splash = document.getElementById('splash-screen');
    splash.style.opacity = '0';
    setTimeout(() => {
      splash.classList.add('hidden');

      if (session && session.loggedIn) {
        // User is already logged in — bypass login screen
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        document.getElementById('sidebar-role').textContent = 'مشرف النظام';
        initApp();
      } else {
        // No active session — show login screen
        document.getElementById('login-screen').classList.remove('hidden');
      }
    }, 400);
  }, 1400);
});

// ---- Start Firestore real-time sync ----
let syncStarted = false;
function startFirestoreSync() {
  if (syncStarted) return;
  syncStarted = true;
  DB.startListeners((changed) => {
    // Only update UI elements if the user is currently logged in and viewing the app
    const appEl = document.getElementById('app');
    if (!appEl || appEl.classList.contains('hidden')) return;

    if (changed === 'users') {
      renderUsers();
      renderDashboard();
    }
    if (changed === 'sections') {
      renderSections();
      populateFilterDropdowns();
    }
    if (changed === 'categories') {
      renderCategories();
      populateFilterDropdowns();
    }
  });
}

// ---- Login ----
function doLogin() {
  const user = document.getElementById('login-user').value.trim();
  const pass = document.getElementById('login-pass').value.trim();
  const s = DB.getSettings();
  const err = document.getElementById('login-error');
  if (user === s.username && pass === s.loginPassword) {
    err.classList.add('hidden');
    setSession(user); // Persist session across refreshes
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('sidebar-role').textContent = 'مشرف النظام';
    startFirestoreSync(); // start real-time sync
    initApp();
  } else {
    err.classList.remove('hidden');
    document.getElementById('login-pass').value = '';
  }
}
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !document.getElementById('login-screen').classList.contains('hidden')) {
    doLogin();
  }
});

function doLogout() {
  clearSession(); // Remove persistent session
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
  toggleSidebar(false);
}

function togglePass(id, el) {
  const inp = document.getElementById(id);
  if (inp.type === 'password') { inp.type = 'text'; el.classList.replace('fa-eye', 'fa-eye-slash'); }
  else { inp.type = 'password'; el.classList.replace('fa-eye-slash', 'fa-eye'); }
}

// ---- App Init ----
function initApp() {
  renderDashboard();
  populateFilterDropdowns();
  renderUsers();
  renderSections();
  renderCategories();
  initReports();
  loadSettings();
}

// ---- Sidebar ----
function toggleSidebar(force) {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sidebar-overlay');
  const open = typeof force === 'boolean' ? force : !sb.classList.contains('open');
  sb.classList.toggle('open', open);
  ov.classList.toggle('hidden', !open);
}

// ---- Navigation ----
function navigate(page, el) {
  // Pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-' + page);
  if (target) { target.classList.remove('hidden'); target.classList.add('active'); }

  // Nav items
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (el) el.classList.add('active');
  else {
    document.querySelectorAll('.nav-item').forEach(n => {
      if (n.getAttribute('onclick') && n.getAttribute('onclick').includes("'" + page + "'")) n.classList.add('active');
    });
  }

  // Title
  const titles = { dashboard:'لوحة التحكم', users:'المستفيدون', sections:'الأقسام', categories:'الفئات', reports:'التقارير', settings:'الإعدادات' };
  document.getElementById('page-title').textContent = titles[page] || '';

  toggleSidebar(false);

  if (page === 'reports') generateReport();
}

function showNotifications() { showToast('لا توجد إشعارات جديدة', 'info'); }

// ---- Dashboard ----
function renderDashboard() {
  const users = DB.getUsers();
  document.getElementById('stat-total').textContent = users.length;
  document.getElementById('stat-received').textContent = users.filter(u => u.receivedTamween).length;
  document.getElementById('stat-pending').textContent = users.filter(u => !u.receivedTamween).length;
  document.getElementById('stat-registered').textContent = users.filter(u => u.registeredExternal).length;

  // Recent users
  const recent = document.getElementById('recent-users-list');
  const last5 = users.slice(0, 5);
  if (last5.length === 0) { recent.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px">لا يوجد مستفيدون بعد</p>'; return; }
  recent.innerHTML = last5.map(u => {
    const sec = DB.getSections().find(s => s.id === u.section);
    return `
    <div class="recent-user-item" onclick="openUserDetail('${u.id}')">
      <div class="recent-user-avatar" style="background:${avatarColor(u.name)}">${initials(u.name)}</div>
      <div>
        <div class="recent-user-name">${u.name}</div>
        <div class="recent-user-meta">${sec ? sec.name : 'بدون قسم'} · ${u.receivedTamween ? '✅ استلم' : '⏳ لم يستلم'}</div>
      </div>
    </div>`;
  }).join('');

  updateDashChart();
}

function updateDashChart() {
  const users = DB.getUsers();
  const sections = DB.getSections();

  const labels = sections.map(s => s.name);
  const received = sections.map(s => users.filter(u => u.section === s.id && u.receivedTamween).length);
  const notReceived = sections.map(s => users.filter(u => u.section === s.id && !u.receivedTamween).length);

  const ctx = document.getElementById('dashChart').getContext('2d');
  if (dashChartInstance) dashChartInstance.destroy();
  dashChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'استلم', data: received, backgroundColor: 'rgba(16,185,129,0.8)', borderRadius: 6 },
        { label: 'لم يستلم', data: notReceived, backgroundColor: 'rgba(239,68,68,0.7)', borderRadius: 6 }
      ]
    },
    options: {
      responsive: true, plugins: { legend: { position: 'bottom' } },
      scales: { x: { stacked: false }, y: { beginAtZero: true, ticks: { stepSize: 1 } } }
    }
  });
}

// ---- Users ----
function renderUsers() {
  const search = (document.getElementById('user-search').value || '').trim().toLowerCase();
  const secFilter = document.getElementById('filter-section').value;
  const catFilter = document.getElementById('filter-category').value;

  let users = DB.getUsers().filter(u => {
    const matchSearch = !search || u.name.toLowerCase().includes(search) || (u.nationalId && u.nationalId.includes(search));
    const matchSec = !secFilter || u.section === secFilter;
    const matchCat = !catFilter || u.category === catFilter;
    return matchSearch && matchSec && matchCat;
  });

  const container = document.getElementById('users-list');
  if (users.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)"><i class="fas fa-users fa-3x" style="margin-bottom:12px;display:block;opacity:0.3"></i>لا يوجد مستفيدون</div>';
    return;
  }

  const sections = DB.getSections();
  const categories = DB.getCategories();

  container.innerHTML = users.map(u => {
    const sec = sections.find(s => s.id === u.section);
    const cat = categories.find(c => c.id === u.category);
    return `
    <div class="user-card" onclick="openUserDetail('${u.id}')">
      <div class="user-avatar" style="background:${avatarColor(u.name)}">${initials(u.name)}</div>
      <div class="user-info">
        <div class="user-name">${u.name}</div>
        <div class="user-meta">${u.nationalId || 'لا يوجد رقم هوية'} ${u.phone ? '· ' + u.phone : ''}</div>
        <div class="user-badges">
          ${sec ? `<span class="badge badge-info" style="background:${sec.color}22;color:${sec.color}">${sec.name}</span>` : ''}
          ${cat ? `<span class="badge badge-neutral" style="background:${cat.color}22;color:${cat.color}">${cat.name}</span>` : ''}
          ${u.registeredExternal ? '<span class="badge badge-success">مسجل خارجياً</span>' : '<span class="badge badge-warning">غير مسجل</span>'}
          ${u.receivedTamween ? '<span class="badge badge-success">استلم التموين</span>' : '<span class="badge badge-danger">لم يستلم</span>'}
        </div>
      </div>
      <i class="fas fa-chevron-left user-arrow"></i>
    </div>`;
  }).join('');
}

function populateFilterDropdowns() {
  const sections = DB.getSections();
  const categories = DB.getCategories();

  ['filter-section', 'user-section'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const first = id.startsWith('filter') ? '<option value="">كل الأقسام</option>' : '<option value="">اختر القسم</option>';
    el.innerHTML = first + sections.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  });

  ['filter-category', 'user-category'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const first = id.startsWith('filter') ? '<option value="">كل الفئات</option>' : '<option value="">اختر الفئة</option>';
    el.innerHTML = first + categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  });
}

// ---- User Modal ----
function openUserModal(userId) {
  clearForm(['user-name','user-national-id','user-phone','user-address','user-notes']);
  document.getElementById('user-id').value = userId || '';
  document.getElementById('user-modal-title').textContent = userId ? 'تعديل مستفيد' : 'إضافة مستفيد';
  populateFilterDropdowns();

  if (userId) {
    const u = DB.getUserById(userId);
    if (u) {
      document.getElementById('user-name').value = u.name || '';
      document.getElementById('user-national-id').value = u.nationalId || '';
      document.getElementById('user-phone').value = u.phone || '';
      document.getElementById('user-address').value = u.address || '';
      document.getElementById('user-notes').value = u.notes || '';
      document.getElementById('user-section').value = u.section || '';
      document.getElementById('user-category').value = u.category || '';
    }
  }
  openModal('user-modal');
}

function saveUser() {
  const name = document.getElementById('user-name').value.trim();
  if (!name) { showToast('يرجى إدخال الاسم الكامل', 'error'); return; }

  const id = document.getElementById('user-id').value;
  const data = {
    name,
    nationalId: document.getElementById('user-national-id').value.trim(),
    phone: document.getElementById('user-phone').value.trim(),
    section: document.getElementById('user-section').value,
    category: document.getElementById('user-category').value,
    address: document.getElementById('user-address').value.trim(),
    notes: document.getElementById('user-notes').value.trim()
  };

  if (id) {
    data.id = id;
    DB.updateUser(data);
    showToast('تم تحديث بيانات المستفيد ✓', 'success');
  } else {
    data.registeredExternal = false;
    data.receivedTamween = false;
    data.cardPass = '';
    DB.addUser(data);
    showToast('تمت إضافة المستفيد ✓', 'success');
  }

  closeModal('user-modal');
  renderUsers();
  renderDashboard();
}

// ---- User Detail ----
function openUserDetail(userId) {
  currentUserId = userId;
  const u = DB.getUserById(userId);
  if (!u) return;

  document.getElementById('detail-name').textContent = u.name;

  const sec = DB.getSections().find(s => s.id === u.section);
  const cat = DB.getCategories().find(c => c.id === u.category);

  document.getElementById('detail-info').innerHTML = `
    <div class="detail-item"><div class="detail-item-label">رقم الهوية</div><div class="detail-item-value">${u.nationalId || '—'}</div></div>
    <div class="detail-item"><div class="detail-item-label">رقم الهاتف</div><div class="detail-item-value">${u.phone || '—'}</div></div>
    <div class="detail-item"><div class="detail-item-label">القسم</div><div class="detail-item-value">${sec ? sec.name : '—'}</div></div>
    <div class="detail-item"><div class="detail-item-label">الفئة</div><div class="detail-item-value">${cat ? cat.name : '—'}</div></div>
    <div class="detail-item" style="grid-column:span 2"><div class="detail-item-label">العنوان</div><div class="detail-item-value">${u.address || '—'}</div></div>
    ${u.notes ? `<div class="detail-item" style="grid-column:span 2"><div class="detail-item-label">ملاحظات</div><div class="detail-item-value">${u.notes}</div></div>` : ''}
  `;

  document.getElementById('chk-external').checked = u.registeredExternal || false;
  document.getElementById('chk-received').checked = u.receivedTamween || false;

  // Reset card pass UI
  lockCard();
  document.getElementById('card-pass-input').value = '';
  document.getElementById('card-pass-error').classList.add('hidden');
  document.getElementById('new-card-value').value = u.cardPass || '';

  openModal('detail-modal');
}

function saveChecklist() {
  if (!currentUserId) return;
  DB.updateUser({
    id: currentUserId,
    registeredExternal: document.getElementById('chk-external').checked,
    receivedTamween: document.getElementById('chk-received').checked
  });
  renderDashboard();
  renderUsers();
}

function unlockCard() {
  const input = document.getElementById('card-pass-input').value;
  const s = DB.getSettings();
  if (input === s.cardPassword) {
    const u = DB.getUserById(currentUserId);
    document.getElementById('card-pass-value').textContent = u ? (u.cardPass || 'لا توجد بطاقة') : '—';
    document.getElementById('card-pass-locked').classList.add('hidden');
    document.getElementById('card-pass-content').classList.remove('hidden');
    document.getElementById('card-pass-error').classList.add('hidden');
  } else {
    document.getElementById('card-pass-error').classList.remove('hidden');
  }
}

function lockCard() {
  document.getElementById('card-pass-locked').classList.remove('hidden');
  document.getElementById('card-pass-content').classList.add('hidden');
}

function updateCardPass() {
  const val = document.getElementById('new-card-value').value.trim();
  if (!currentUserId) return;
  DB.updateUser({ id: currentUserId, cardPass: val });
  document.getElementById('card-pass-value').textContent = val || 'لا توجد بطاقة';
  showToast('تم تحديث بطاقة العبور ✓', 'success');
}

function editCurrentUser() {
  closeModal('detail-modal');
  openUserModal(currentUserId);
}

function deleteCurrentUser() {
  confirmAction('هل تريد حذف هذا المستفيد نهائياً؟', () => {
    DB.deleteUser(currentUserId);
    closeModal('detail-modal');
    renderUsers();
    renderDashboard();
    showToast('تم حذف المستفيد', 'error');
  });
}

// ---- Sections ----
function renderSections() {
  const sections = DB.getSections();
  const users = DB.getUsers();
  const container = document.getElementById('sections-list');
  if (sections.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">لا توجد أقسام</div>';
    return;
  }
  container.innerHTML = sections.map(s => {
    const count = users.filter(u => u.section === s.id).length;
    return `
    <div class="tag-card">
      <div class="tag-color" style="background:${s.color}"></div>
      <div class="tag-name">${s.name}</div>
      <div class="tag-count">${count} مستفيد</div>
      <div class="tag-actions">
        <button class="icon-btn icon-btn-edit" onclick="openSectionModal('${s.id}')"><i class="fas fa-edit"></i></button>
        <button class="icon-btn icon-btn-delete" onclick="deleteSection('${s.id}')"><i class="fas fa-trash"></i></button>
      </div>
    </div>`;
  }).join('');
}

function openSectionModal(id) {
  document.getElementById('section-id').value = id || '';
  if (id) {
    const s = DB.getSections().find(x => x.id === id);
    document.getElementById('section-name').value = s ? s.name : '';
    document.getElementById('section-color').value = s ? s.color : '#3b82f6';
    document.getElementById('section-modal-title').textContent = 'تعديل القسم';
  } else {
    document.getElementById('section-name').value = '';
    document.getElementById('section-color').value = '#3b82f6';
    document.getElementById('section-modal-title').textContent = 'إضافة قسم';
  }
  openModal('section-modal');
}

function saveSection() {
  const name = document.getElementById('section-name').value.trim();
  if (!name) { showToast('يرجى إدخال اسم القسم', 'error'); return; }
  const id = document.getElementById('section-id').value;
  const color = document.getElementById('section-color').value;
  if (id) DB.updateSection({ id, name, color });
  else DB.addSection({ name, color });
  closeModal('section-modal');
  renderSections();
  populateFilterDropdowns();
  showToast(id ? 'تم تحديث القسم ✓' : 'تمت إضافة القسم ✓', 'success');
}

function deleteSection(id) {
  confirmAction('هل تريد حذف هذا القسم؟', () => {
    DB.deleteSection(id);
    renderSections();
    populateFilterDropdowns();
    showToast('تم حذف القسم', 'error');
  });
}

// ---- Categories ----
function renderCategories() {
  const cats = DB.getCategories();
  const users = DB.getUsers();
  const container = document.getElementById('categories-list');
  if (cats.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">لا توجد فئات</div>';
    return;
  }
  container.innerHTML = cats.map(c => {
    const count = users.filter(u => u.category === c.id).length;
    return `
    <div class="tag-card">
      <div class="tag-color" style="background:${c.color}"></div>
      <div class="tag-name">${c.name}</div>
      <div class="tag-count">${count} مستفيد</div>
      <div class="tag-actions">
        <button class="icon-btn icon-btn-edit" onclick="openCategoryModal('${c.id}')"><i class="fas fa-edit"></i></button>
        <button class="icon-btn icon-btn-delete" onclick="deleteCategory('${c.id}')"><i class="fas fa-trash"></i></button>
      </div>
    </div>`;
  }).join('');
}

function openCategoryModal(id) {
  document.getElementById('category-id').value = id || '';
  if (id) {
    const c = DB.getCategories().find(x => x.id === id);
    document.getElementById('category-name').value = c ? c.name : '';
    document.getElementById('category-color').value = c ? c.color : '#10b981';
    document.getElementById('category-modal-title').textContent = 'تعديل الفئة';
  } else {
    document.getElementById('category-name').value = '';
    document.getElementById('category-color').value = '#10b981';
    document.getElementById('category-modal-title').textContent = 'إضافة فئة';
  }
  openModal('category-modal');
}

function saveCategory() {
  const name = document.getElementById('category-name').value.trim();
  if (!name) { showToast('يرجى إدخال اسم الفئة', 'error'); return; }
  const id = document.getElementById('category-id').value;
  const color = document.getElementById('category-color').value;
  if (id) DB.updateCategory({ id, name, color });
  else DB.addCategory({ name, color });
  closeModal('category-modal');
  renderCategories();
  populateFilterDropdowns();
  showToast(id ? 'تم تحديث الفئة ✓' : 'تمت إضافة الفئة ✓', 'success');
}

function deleteCategory(id) {
  confirmAction('هل تريد حذف هذه الفئة؟', () => {
    DB.deleteCategory(id);
    renderCategories();
    populateFilterDropdowns();
    showToast('تم حذف الفئة', 'error');
  });
}

// ---- Settings ----
function loadSettings() {
  const s = DB.getSettings();
  document.getElementById('set-username').value = s.username || 'admin';
}

function saveSettings() {
  const s = DB.getSettings();
  s.username = document.getElementById('set-username').value.trim() || s.username;
  const lp = document.getElementById('set-loginpass').value.trim();
  const cp = document.getElementById('set-cardpass').value.trim();
  if (lp) s.loginPassword = lp;
  if (cp) s.cardPassword = cp;
  DB.saveSettings(s);
  document.getElementById('set-loginpass').value = '';
  document.getElementById('set-cardpass').value = '';
  const msg = document.getElementById('settings-msg');
  msg.classList.remove('hidden');
  setTimeout(() => msg.classList.add('hidden'), 2500);
  showToast('تم حفظ الإعدادات ✓', 'success');
}

// ---- Modal Helpers ----
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

function confirmAction(msg, cb) {
  document.getElementById('confirm-msg').textContent = msg;
  const btn = document.getElementById('confirm-ok-btn');
  btn.onclick = () => { closeModal('confirm-modal'); cb(); };
  openModal('confirm-modal');
}

// ---- Toast ----
function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + (type === 'success' ? 'success' : type === 'error' ? 'error' : '');
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 2800);
}

// ---- Helpers ----
function clearForm(ids) { ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; }); }

function populateMonthSelect(id) {
  const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const el = document.getElementById(id);
  if (!el) return;
  const now = new Date();
  el.innerHTML = months.map((m, i) => `<option value="${i}" ${i === now.getMonth() ? 'selected' : ''}>${m}</option>`).join('');
}

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(ov => {
  ov.addEventListener('click', e => { if (e.target === ov) ov.classList.add('hidden'); });
});
