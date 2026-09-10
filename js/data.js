/* ===== DATA LAYER - localStorage ===== */

const DB = {
  // Defaults
  defaults: {
    settings: {
      username: 'admin',
      loginPassword: '1234',
      cardPassword: '9999'
    },
    sections: [
      { id: 's1', name: 'القسم الأول', color: '#3b82f6' },
      { id: 's2', name: 'القسم الثاني', color: '#10b981' },
      { id: 's3', name: 'القسم الثالث', color: '#f59e0b' }
    ],
    categories: [
      { id: 'c1', name: 'أسرة', color: '#8b5cf6' },
      { id: 'c2', name: 'فرد', color: '#ef4444' },
      { id: 'c3', name: 'مسن', color: '#f97316' }
    ],
    users: [
      {
        id: 'u1', name: 'أحمد محمد علي', nationalId: '1234567890',
        phone: '0501234567', section: 's1', category: 'c1',
        address: 'الرياض - حي النزهة', notes: '',
        registeredExternal: true, receivedTamween: false, cardPass: 'A-001',
        createdAt: new Date(Date.now() - 86400000 * 5).toISOString()
      },
      {
        id: 'u2', name: 'فاطمة عبدالله السالم', nationalId: '9876543210',
        phone: '0559876543', section: 's1', category: 'c2',
        address: 'الرياض - حي العزيزية', notes: 'تحتاج متابعة',
        registeredExternal: true, receivedTamween: true, cardPass: 'A-002',
        createdAt: new Date(Date.now() - 86400000 * 3).toISOString()
      },
      {
        id: 'u3', name: 'محمد صالح الغامدي', nationalId: '1122334455',
        phone: '0531122334', section: 's2', category: 'c3',
        address: 'جدة - حي الصفا', notes: '',
        registeredExternal: false, receivedTamween: false, cardPass: 'B-001',
        createdAt: new Date(Date.now() - 86400000 * 1).toISOString()
      },
      {
        id: 'u4', name: 'نورا خالد المطيري', nationalId: '5566778899',
        phone: '0555566778', section: 's2', category: 'c1',
        address: 'مكة - حي العزيزية', notes: '',
        registeredExternal: true, receivedTamween: true, cardPass: 'B-002',
        createdAt: new Date().toISOString()
      }
    ]
  },

  get(key) {
    try {
      const v = localStorage.getItem('tamween_' + key);
      return v ? JSON.parse(v) : null;
    } catch { return null; }
  },

  set(key, value) {
    localStorage.setItem('tamween_' + key, JSON.stringify(value));
  },

  init() {
    if (!this.get('initialized')) {
      this.set('settings', this.defaults.settings);
      this.set('sections', this.defaults.sections);
      this.set('categories', this.defaults.categories);
      this.set('users', this.defaults.users);
      this.set('initialized', true);
    }
  },

  getSettings() { return this.get('settings') || this.defaults.settings; },
  saveSettings(s) { this.set('settings', s); },

  getUsers() { return this.get('users') || []; },
  saveUsers(u) { this.set('users', u); },

  getSections() { return this.get('sections') || []; },
  saveSections(s) { this.set('sections', s); },

  getCategories() { return this.get('categories') || []; },
  saveCategories(c) { this.set('categories', c); },

  getUserById(id) { return this.getUsers().find(u => u.id === id); },

  addUser(user) {
    const users = this.getUsers();
    user.id = 'u' + Date.now();
    user.createdAt = new Date().toISOString();
    users.unshift(user);
    this.saveUsers(users);
    return user;
  },

  updateUser(updated) {
    const users = this.getUsers();
    const idx = users.findIndex(u => u.id === updated.id);
    if (idx !== -1) users[idx] = { ...users[idx], ...updated };
    this.saveUsers(users);
  },

  deleteUser(id) {
    const users = this.getUsers().filter(u => u.id !== id);
    this.saveUsers(users);
  },

  addSection(sec) {
    const sections = this.getSections();
    sec.id = 's' + Date.now();
    sections.push(sec);
    this.saveSections(sections);
  },
  updateSection(updated) {
    const secs = this.getSections();
    const idx = secs.findIndex(s => s.id === updated.id);
    if (idx !== -1) secs[idx] = updated;
    this.saveSections(secs);
  },
  deleteSection(id) { this.saveSections(this.getSections().filter(s => s.id !== id)); },

  addCategory(cat) {
    const categories = this.getCategories();
    cat.id = 'c' + Date.now();
    categories.push(cat);
    this.saveCategories(categories);
  },
  updateCategory(updated) {
    const cats = this.getCategories();
    const idx = cats.findIndex(c => c.id === updated.id);
    if (idx !== -1) cats[idx] = updated;
    this.saveCategories(cats);
  },
  deleteCategory(id) { this.saveCategories(this.getCategories().filter(c => c.id !== id)); }
};
