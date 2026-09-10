/* ===== DATA LAYER - Firebase Firestore ===== */

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDV6U7DciQw_RNj28eD47xkB2JXYVuv2oI",
  authDomain: "tamween-162ce.firebaseapp.com",
  projectId: "tamween-162ce",
  storageBucket: "tamween-162ce.firebasestorage.app",
  messagingSenderId: "1069224601777",
  appId: "1:1069224601777:web:e5d9358aab86816e1c9a90"
};

// ── Init Firebase ──
try {
  if (!firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
  }
} catch (e) {
  console.warn("Firebase initialization error:", e);
}

const db = firebase.firestore();

// Enable offline persistence for smooth mobile/offline experience
try {
  db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
    console.warn("Firestore persistence notice:", err.code);
  });
} catch (e) {
  console.warn("Persistence not supported:", e);
}

// ── Collection references ──
const COLS = {
  users:      db.collection('users'),
  sections:   db.collection('sections'),
  categories: db.collection('categories'),
  settings:   db.collection('settings')
};

// ══════════════════════════════════════════
//  DB Object — provides synchronous cache
//  and asynchronous Firestore background sync
// ══════════════════════════════════════════
const DB = {
  _cache: {
    users: [],
    sections: [],
    categories: [],
    settings: {
      username: 'admin',
      loginPassword: '1234',
      cardPassword: '9999'
    }
  },

  // ── Real-time listeners for live cross-device sync ──
  startListeners(onUpdate) {
    // 1. Sections listener
    COLS.sections.onSnapshot(snap => {
      if (snap.empty) {
        const defaultSections = [
          { name: 'القسم الأول', color: '#3b82f6' },
          { name: 'القسم الثاني', color: '#10b981' },
          { name: 'القسم الثالث', color: '#f59e0b' }
        ];
        defaultSections.forEach(s => COLS.sections.add(s));
      } else {
        this._cache.sections = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        this._cache.sections.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
        if (onUpdate) onUpdate('sections');
      }
    }, err => console.warn('Sections sync error:', err));

    // 2. Categories listener
    COLS.categories.onSnapshot(snap => {
      if (snap.empty) {
        const defaultCategories = [
          { name: 'أسرة', color: '#8b5cf6' },
          { name: 'فرد', color: '#ef4444' },
          { name: 'مسن', color: '#f97316' }
        ];
        defaultCategories.forEach(c => COLS.categories.add(c));
      } else {
        this._cache.categories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        this._cache.categories.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
        if (onUpdate) onUpdate('categories');
      }
    }, err => console.warn('Categories sync error:', err));

    // 3. Users listener (NO fake demo data — only real users)
    COLS.users.onSnapshot(snap => {
      this._cache.users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      this._cache.users.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      if (onUpdate) onUpdate('users');
    }, err => console.warn('Users sync error:', err));

    // 4. Settings listener
    COLS.settings.doc('main').onSnapshot(doc => {
      if (doc.exists) {
        const data = doc.data();
        if (data.username) this._cache.settings.username = data.username;
      }
    }, err => console.warn('Settings sync error:', err));
  },

  // ── Settings ──
  getSettings() {
    try {
      const local = JSON.parse(localStorage.getItem('tamween_settings') || 'null');
      if (local) return { ...this._cache.settings, ...local };
    } catch (e) {}
    return this._cache.settings;
  },

  saveSettings(s) {
    try {
      localStorage.setItem('tamween_settings', JSON.stringify(s));
    } catch (e) {}
    COLS.settings.doc('main').set({ username: s.username }, { merge: true }).catch(() => {});
  },

  // ── Users ──
  getUsers() {
    return this._cache.users;
  },

  getUserById(id) {
    return this._cache.users.find(u => u.id === id);
  },

  async addUser(user) {
    user.createdAt = new Date().toISOString();
    const ref = await COLS.users.add(user);
    const newUser = { id: ref.id, ...user };
    if (!this._cache.users.some(u => u.id === ref.id)) {
      this._cache.users.unshift(newUser);
    }
    return newUser;
  },

  async updateUser(updated) {
    const { id, ...data } = updated;
    if (!id) return;
    const idx = this._cache.users.findIndex(u => u.id === id);
    if (idx !== -1) {
      this._cache.users[idx] = { ...this._cache.users[idx], ...data };
    }
    await COLS.users.doc(id).set(data, { merge: true });
  },

  async deleteUser(id) {
    if (!id) return;
    this._cache.users = this._cache.users.filter(u => u.id !== id);
    await COLS.users.doc(id).delete();
  },

  // ── Sections ──
  getSections() {
    return this._cache.sections;
  },

  async addSection(sec) {
    const ref = await COLS.sections.add(sec);
    this._cache.sections.push({ id: ref.id, ...sec });
  },

  async updateSection(updated) {
    const { id, ...data } = updated;
    if (!id) return;
    const idx = this._cache.sections.findIndex(s => s.id === id);
    if (idx !== -1) this._cache.sections[idx] = updated;
    await COLS.sections.doc(id).set(data, { merge: true });
  },

  async deleteSection(id) {
    if (!id) return;
    this._cache.sections = this._cache.sections.filter(s => s.id !== id);
    await COLS.sections.doc(id).delete();
  },

  // ── Categories ──
  getCategories() {
    return this._cache.categories;
  },

  async addCategory(cat) {
    const ref = await COLS.categories.add(cat);
    this._cache.categories.push({ id: ref.id, ...cat });
  },

  async updateCategory(updated) {
    const { id, ...data } = updated;
    if (!id) return;
    const idx = this._cache.categories.findIndex(c => c.id === id);
    if (idx !== -1) this._cache.categories[idx] = updated;
    await COLS.categories.doc(id).set(data, { merge: true });
  },

  async deleteCategory(id) {
    if (!id) return;
    this._cache.categories = this._cache.categories.filter(c => c.id !== id);
    await COLS.categories.doc(id).delete();
  },

  // ── Init ──
  init() {
    try {
      const old = localStorage.getItem('tamween_settings');
      if (!old) {
        localStorage.setItem('tamween_settings', JSON.stringify({
          username: 'admin',
          loginPassword: '1234',
          cardPassword: '9999'
        }));
      }
    } catch (e) {}
  }
};
