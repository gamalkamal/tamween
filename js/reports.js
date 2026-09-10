/* ===== REPORTS & PRINTING (Optimized: Zero Memory Crash) ===== */

let reportChartInstance = null;

const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
                   'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

function initReports() {
  const now = new Date();
  const monthSel = document.getElementById('report-month');
  monthSel.innerHTML = MONTHS_AR.map((m, i) =>
    `<option value="${i}" ${i === now.getMonth() ? 'selected' : ''}>${m}</option>`
  ).join('');
  const yearSel = document.getElementById('report-year');
  const currentYear = now.getFullYear();
  yearSel.innerHTML = [currentYear - 1, currentYear, currentYear + 1].map(y =>
    `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`
  ).join('');

  document.getElementById('report-type').addEventListener('change', function() {
    document.getElementById('report-month-wrap').style.display = this.value === 'monthly' ? '' : 'none';
  });

  populateReportDropdowns();
}

function populateReportDropdowns() {
  const secSel = document.getElementById('report-section');
  if (!secSel) return;
  const sections = DB.getSections();
  const currentVal = secSel.value;
  secSel.innerHTML = '<option value="">جميع الأقسام</option>' + sections.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  if (currentVal) secSel.value = currentVal;
}

function getFilteredReportUsers() {
  const type = document.getElementById('report-type').value;
  const month = parseInt(document.getElementById('report-month').value);
  const year = parseInt(document.getElementById('report-year').value);
  const secFilter = document.getElementById('report-section') ? document.getElementById('report-section').value : '';
  const statusFilter = document.getElementById('report-status') ? document.getElementById('report-status').value : '';

  let list = DB.getUsers();

  // 1. Date filter
  if (type === 'monthly') {
    list = list.filter(u => {
      const d = new Date(u.createdAt);
      return d.getFullYear() === year && d.getMonth() === month;
    });
  } else {
    list = list.filter(u => new Date(u.createdAt).getFullYear() === year);
  }

  // 2. Section filter
  if (secFilter) {
    list = list.filter(u => u.section === secFilter);
  }

  // 3. Dispensing status filter
  if (statusFilter === 'received') {
    list = list.filter(u => u.receivedTamween);
  } else if (statusFilter === 'pending') {
    list = list.filter(u => !u.receivedTamween);
  }

  return list;
}

function generateReport() {
  const type = document.getElementById('report-type').value;
  const month = parseInt(document.getElementById('report-month').value);
  const year = parseInt(document.getElementById('report-year').value);
  const secFilter = document.getElementById('report-section') ? document.getElementById('report-section').value : '';
  const statusFilter = document.getElementById('report-status') ? document.getElementById('report-status').value : '';
  const sections = DB.getSections();

  const filtered = getFilteredReportUsers();

  // Title building
  let titleParts = [];
  if (type === 'monthly') {
    titleParts.push(`تقرير شهر ${MONTHS_AR[month]} ${year}`);
  } else {
    titleParts.push(`التقرير السنوي ${year}`);
  }

  if (secFilter) {
    const s = sections.find(x => x.id === secFilter);
    titleParts.push(`القسم: ${s ? s.name : ''}`);
  } else {
    titleParts.push('جميع الأقسام');
  }

  if (statusFilter === 'received') {
    titleParts.push('(تم صرف التموين فقط)');
  } else if (statusFilter === 'pending') {
    titleParts.push('(لم يتم الصرف بعد)');
  } else {
    titleParts.push('(جميع الحالات)');
  }

  document.getElementById('report-title').textContent = titleParts.join(' - ');

  // Chart
  const ctx = document.getElementById('reportChart').getContext('2d');
  if (reportChartInstance) reportChartInstance.destroy();

  const chartSections = secFilter ? sections.filter(s => s.id === secFilter) : sections;
  const labels = chartSections.map(s => s.name);
  const received = chartSections.map(s => filtered.filter(u => u.section === s.id && u.receivedTamween).length);
  const pending = chartSections.map(s => filtered.filter(u => u.section === s.id && !u.receivedTamween).length);

  reportChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'استلم التموين', data: received, backgroundColor: 'rgba(16,185,129,0.8)', borderRadius: 8 },
        { label: 'لم يستلم بعد', data: pending, backgroundColor: 'rgba(239,68,68,0.7)', borderRadius: 8 }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } },
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
    }
  });

  // Table
  const cats = DB.getCategories();
  const tbody = document.getElementById('report-tbody');
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text-muted)">لا توجد بيانات مطابقة لمعايير البحث</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map((u, i) => {
    const sec = sections.find(s => s.id === u.section);
    const cat = cats.find(c => c.id === u.category);
    const ind = parseInt(u.individuals) || 1;
    return `
    <tr>
      <td>${i + 1}</td>
      <td style="font-weight:700;">${u.name}</td>
      <td>${sec ? sec.name : '—'}</td>
      <td>${cat ? cat.name : '—'}</td>
      <td style="font-family:monospace;font-weight:700;color:var(--primary);">${u.cardPass || '—'}</td>
      <td style="font-weight:700;">${ind}</td>
      <td style="color:${u.registeredExternal ? '#10b981' : '#ef4444'};font-weight:700">${u.registeredExternal ? '✔ نعم' : '✘ لا'}</td>
      <td style="color:${u.receivedTamween ? '#10b981' : '#ef4444'};font-weight:700">${u.receivedTamween ? '✔ نعم' : '✘ لا'}</td>
    </tr>`;
  }).join('');
}

// ══════════════════════════════════════════════════
//  ACTION 1: Open Standalone Print Page (print.html)
//  Triggers Native Android / Chrome Print -> "Save as PDF"
//  Zero memory overhead — Never crashes
// ══════════════════════════════════════════════════
function openPrintPage() {
  saveReportDataForPrinting();
  const win = window.open('print.html', '_blank');
  if (!win || win.closed) {
    // If popup was blocked by WebView, redirect or direct navigate
    window.location.href = 'print.html';
  }
}

function saveReportDataForPrinting() {
  const filtered = getFilteredReportUsers();
  const title = document.getElementById('report-title') ? document.getElementById('report-title').textContent : 'تقرير تموين';

  const reportData = {
    title: title,
    date: new Date().toLocaleDateString('ar-SA-u-nu-latn'),
    time: new Date().toLocaleTimeString('ar-SA-u-nu-latn'),
    users: filtered,
    sections: DB.getSections(),
    categories: DB.getCategories()
  };

  try {
    localStorage.setItem('tamween_print_data', JSON.stringify(reportData));
  } catch (e) {
    console.warn('Print data storage warning:', e);
  }
}

// ══════════════════════════════════════════════════
//  ACTION 2: Export to Excel (.CSV with UTF-8 BOM)
//  Opens directly in Excel / Google Sheets on any phone
// ══════════════════════════════════════════════════
function exportToExcel() {
  const filtered = getFilteredReportUsers();
  if (filtered.length === 0) {
    showToast('لا توجد بيانات لتصديرها', 'error');
    return;
  }

  const sections = DB.getSections();
  const cats = DB.getCategories();

  // CSV Header with BOM for correct Arabic rendering in Excel
  let csv = '\uFEFF';
  csv += '#,الاسم الكامل,القسم,الفئة,بطاقة العبور,عدد الأفراد,تم التسجيل على الماكينه,استلم التموين,العنوان,الهاتف\n';

  filtered.forEach((u, i) => {
    const sec = sections.find(s => s.id === u.section);
    const cat = cats.find(c => c.id === u.category);
    const name = `"${(u.name || '').replace(/"/g, '""')}"`;
    const secName = `"${(sec ? sec.name : '—').replace(/"/g, '""')}"`;
    const catName = `"${(cat ? cat.name : '—').replace(/"/g, '""')}"`;
    const card = `"${(u.cardPass || '').replace(/"/g, '""')}"`;
    const ind = u.individuals || 1;
    const mach = u.registeredExternal ? 'نعم' : 'لا';
    const rec = u.receivedTamween ? 'نعم' : 'لا';
    const addr = `"${(u.address || '').replace(/"/g, '""')}"`;
    const phone = `"${(u.phone || '').replace(/"/g, '""')}"`;

    csv += `${i + 1},${name},${secName},${catName},${card},${ind},${mach},${rec},${addr},${phone}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const fileName = `tamween_report_${new Date().toISOString().slice(0, 10)}.csv`;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 3000);

  showToast('تم تحميل ملف Excel (CSV) بنجاح ✓', 'success');
}

// ══════════════════════════════════════════════════
//  ACTION 3: Share Formatted Report to WhatsApp
// ══════════════════════════════════════════════════
function shareReportWhatsApp() {
  const filtered = getFilteredReportUsers();
  const title = document.getElementById('report-title') ? document.getElementById('report-title').textContent : 'تقرير تموين';
  const total = filtered.length;
  const totalInd = filtered.reduce((s, u) => s + (parseInt(u.individuals) || 1), 0);
  const received = filtered.filter(u => u.receivedTamween).length;
  const pending = total - received;

  let text = `📦 *${title}*\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `👥 إجمالي المستفيدين: ${total}\n`;
  text += `👨‍👩‍👧‍👦 إجمالي الأفراد: ${totalInd}\n`;
  text += `✅ استلموا التموين: ${received}\n`;
  text += `⏳ لم يستلموا: ${pending}\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

  filtered.forEach((u, i) => {
    const status = u.receivedTamween ? '✅ استلم' : '⏳ لم يستلم';
    const card = u.cardPass ? `(بطاقة: ${u.cardPass})` : '';
    text += `${i + 1}. ${u.name} ${card} - ${u.individuals || 1} أفراد [${status}]\n`;
  });

  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

// ══════════════════════════════════════════════════
//  Main Button Handler: Open Preview Modal
// ══════════════════════════════════════════════════
function exportPDF() {
  const type = document.getElementById('report-type').value;
  const month = parseInt(document.getElementById('report-month').value);
  const year = parseInt(document.getElementById('report-year').value);
  const secFilter = document.getElementById('report-section') ? document.getElementById('report-section').value : '';
  const statusFilter = document.getElementById('report-status') ? document.getElementById('report-status').value : '';

  const sections = DB.getSections();
  const cats = DB.getCategories();
  const filtered = getFilteredReportUsers();

  let titleText = type === 'monthly' ? `تقرير شهر ${MONTHS_AR[month]} ${year}` : `التقرير السنوي ${year}`;
  let sectionLabel = 'جميع الأقسام';
  if (secFilter) {
    const s = sections.find(x => x.id === secFilter);
    if (s) sectionLabel = `قسم: ${s.name}`;
  }

  let statusLabel = 'جميع الحالات (الكل)';
  if (statusFilter === 'received') statusLabel = 'تم صرف التموين فقط';
  else if (statusFilter === 'pending') statusLabel = 'لم يتم الصرف بعد';

  const totalBeneficiaries = filtered.length;
  const totalIndividuals = filtered.reduce((sum, u) => sum + (parseInt(u.individuals) || 1), 0);
  const receivedCount = filtered.filter(u => u.receivedTamween).length;
  const pendingCount = totalBeneficiaries - receivedCount;
  const machineRegisteredCount = filtered.filter(u => u.registeredExternal).length;

  // Build the complete on-screen report HTML
  const reportHTML = `
    <div style="background:#ffffff;padding:0;direction:rtl;font-family:'Cairo',sans-serif;text-align:right;">
      <!-- HEADER -->
      <div style="background:linear-gradient(135deg,#1e3a8a,#3b82f6);padding:24px 30px;color:#ffffff;border-radius:8px 8px 0 0;">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:48px;height:48px;background:rgba(255,255,255,0.2);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px;">📦</div>
            <div>
              <div style="font-size:26px;font-weight:900;letter-spacing:1px;color:#ffffff;">تموين</div>
              <div style="font-size:13px;opacity:0.9;color:#ffffff;">نظام إدارة المستفيدين والتموين</div>
            </div>
          </div>
          <div style="text-align:left;font-size:12px;opacity:0.9;color:#ffffff;">
            <div>تاريخ التقرير: ${new Date().toLocaleDateString('ar-SA-u-nu-latn')}</div>
            <div>الوقت: ${new Date().toLocaleTimeString('ar-SA-u-nu-latn')}</div>
          </div>
        </div>
        <div style="margin-top:14px;border-top:1px solid rgba(255,255,255,0.25);padding-top:10px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <div style="font-size:18px;font-weight:800;color:#ffffff;">${titleText}</div>
          <div style="font-size:13px;background:rgba(255,255,255,0.2);padding:4px 14px;border-radius:20px;color:#ffffff;">
            ${sectionLabel} | ${statusLabel}
          </div>
        </div>
      </div>

      <!-- STATS SUMMARY CARDS -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;padding:16px 24px 0;">
        <div style="background:#1e40af;border-radius:10px;padding:12px;color:#ffffff;text-align:center;">
          <div style="font-size:24px;font-weight:900;">${totalBeneficiaries}</div>
          <div style="font-size:11px;opacity:0.9;margin-top:2px;">إجمالي المستفيدين</div>
        </div>
        <div style="background:#4338ca;border-radius:10px;padding:12px;color:#ffffff;text-align:center;">
          <div style="font-size:24px;font-weight:900;">${totalIndividuals}</div>
          <div style="font-size:11px;opacity:0.9;margin-top:2px;">إجمالي الأفراد</div>
        </div>
        <div style="background:#065f46;border-radius:10px;padding:12px;color:#ffffff;text-align:center;">
          <div style="font-size:24px;font-weight:900;">${receivedCount}</div>
          <div style="font-size:11px;opacity:0.9;margin-top:2px;">استلموا التموين</div>
        </div>
        <div style="background:#991b1b;border-radius:10px;padding:12px;color:#ffffff;text-align:center;">
          <div style="font-size:24px;font-weight:900;">${pendingCount}</div>
          <div style="font-size:11px;opacity:0.9;margin-top:2px;">لم يستلموا بعد</div>
        </div>
        <div style="background:#6b21a8;border-radius:10px;padding:12px;color:#ffffff;text-align:center;">
          <div style="font-size:24px;font-weight:900;">${machineRegisteredCount}</div>
          <div style="font-size:11px;opacity:0.9;margin-top:2px;">تم التسجيل على الماكينه</div>
        </div>
      </div>

      <!-- DATA TABLE -->
      <div style="padding:16px 24px 28px;overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:12px;text-align:right;">
          <thead>
            <tr style="background:linear-gradient(90deg,#1e40af,#3b82f6);color:#ffffff;">
              <th style="padding:10px 8px;text-align:right;">#</th>
              <th style="padding:10px 8px;text-align:right;">الاسم الكامل</th>
              <th style="padding:10px 8px;text-align:right;">القسم</th>
              <th style="padding:10px 8px;text-align:right;">الفئة</th>
              <th style="padding:10px 8px;text-align:center;">بطاقة العبور</th>
              <th style="padding:10px 8px;text-align:center;">عدد الأفراد</th>
              <th style="padding:10px 8px;text-align:center;">مسجل على الماكينه</th>
              <th style="padding:10px 8px;text-align:center;">استلم التموين</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.length === 0
              ? `<tr><td colspan="8" style="text-align:center;padding:24px;color:#64748b;font-size:14px;">لا توجد بيانات مطابقة لمعايير التقرير</td></tr>`
              : filtered.map((u, i) => {
                  const sec = sections.find(s => s.id === u.section);
                  const cat = cats.find(c => c.id === u.category);
                  const ind = parseInt(u.individuals) || 1;
                  const bg = i % 2 === 0 ? '#f8fafc' : '#ffffff';
                  return `
                  <tr style="background:${bg};border-bottom:1px solid #e2e8f0;">
                    <td style="padding:9px 8px;color:#64748b;font-weight:600;">${i + 1}</td>
                    <td style="padding:9px 8px;font-weight:700;color:#0f172a;">${u.name}</td>
                    <td style="padding:9px 8px;color:#475569;">${sec ? sec.name : '—'}</td>
                    <td style="padding:9px 8px;color:#475569;">${cat ? cat.name : '—'}</td>
                    <td style="padding:9px 8px;text-align:center;font-weight:800;color:#1e40af;font-family:monospace;">${u.cardPass || '—'}</td>
                    <td style="padding:9px 8px;text-align:center;font-weight:800;color:#0f172a;">${ind}</td>
                    <td style="padding:9px 8px;text-align:center;">
                      <span style="background:${u.registeredExternal ? '#d1fae5' : '#fee2e2'};color:${u.registeredExternal ? '#065f46' : '#991b1b'};padding:3px 8px;border-radius:14px;font-weight:700;font-size:11px;">
                        ${u.registeredExternal ? '✔ نعم' : '✘ لا'}
                      </span>
                    </td>
                    <td style="padding:9px 8px;text-align:center;">
                      <span style="background:${u.receivedTamween ? '#d1fae5' : '#fee2e2'};color:${u.receivedTamween ? '#065f46' : '#991b1b'};padding:3px 8px;border-radius:14px;font-weight:700;font-size:11px;">
                        ${u.receivedTamween ? '✔ نعم' : '✘ لا'}
                      </span>
                    </td>
                  </tr>`;
                }).join('')
            }
          </tbody>
        </table>

        <!-- FOOTER -->
        <div style="margin-top:20px;padding-top:12px;border-top:2px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;color:#94a3b8;font-size:11px;flex-wrap:wrap;gap:6px;">
          <span>نظام تموين - تقرير رسمي مصدق</span>
          <span>تاريخ الإصدار: ${new Date().toLocaleDateString('ar-SA-u-nu-latn')}</span>
        </div>
      </div>
    </div>
  `;

  // Save report data for print.html
  saveReportDataForPrinting();

  // Render on-screen in the modal
  const container = document.getElementById('report-preview-container');
  if (container) {
    container.innerHTML = reportHTML;
  }
  const previewTitle = document.getElementById('report-preview-title');
  if (previewTitle) {
    previewTitle.textContent = `${titleText} (${sectionLabel} - ${statusLabel})`;
  }

  // Open modal so user sees report immediately
  openModal('report-preview-modal');
  showToast('تم إظهار التقرير بنجاح ✓', 'success');
}
