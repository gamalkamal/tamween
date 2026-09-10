/* ===== REPORTS & PDF ===== */

// Detect Android WebView / PWA environment
function isAndroidWebView() {
  const ua = navigator.userAgent || '';
  return /Android/.test(ua) && (/wv/.test(ua) || /Version\/[\d.]+.*Chrome/.test(ua) || window.Android !== undefined);
}

// Smart PDF saver: works on desktop, Chrome Android, and WebView APK
function savePdfSmart(doc, fileName) {
  try {
    // 1. Try standard download (desktop + modern Chrome)
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);

    if (isAndroidWebView()) {
      // In Android WebView: open in new window so user can use system share/save
      const newWin = window.open(url, '_blank');
      if (!newWin || newWin.closed) {
        // Blocked popup — fall back to data URI
        const dataUri = doc.output('datauristring');
        const a = document.createElement('a');
        a.href = dataUri;
        a.download = fileName;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } else {
      // Desktop: use hidden anchor download
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 3000);
    }
  } catch(e) {
    // Final fallback: open as data URI
    const dataUri = doc.output('datauristring');
    window.open(dataUri, '_blank');
  }
}

let reportChartInstance = null;

const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
                   'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

function initReports() {
  const now = new Date();
  const monthSel = document.getElementById('report-month');
  monthSel.innerHTML = MONTHS_AR.map((m,i) =>
    `<option value="${i}" ${i===now.getMonth()?'selected':''}>${m}</option>`
  ).join('');
  const yearSel = document.getElementById('report-year');
  const currentYear = now.getFullYear();
  yearSel.innerHTML = [currentYear-1, currentYear, currentYear+1].map(y =>
    `<option value="${y}" ${y===currentYear?'selected':''}>${y}</option>`
  ).join('');
  document.getElementById('report-type').addEventListener('change', function() {
    document.getElementById('report-month-wrap').style.display = this.value === 'monthly' ? '' : 'none';
  });
}

function generateReport() {
  const type = document.getElementById('report-type').value;
  const month = parseInt(document.getElementById('report-month').value);
  const year = parseInt(document.getElementById('report-year').value);
  const users = DB.getUsers();
  const sections = DB.getSections();

  let filtered;
  if (type === 'monthly') {
    filtered = users.filter(u => {
      const d = new Date(u.createdAt);
      return d.getFullYear() === year && d.getMonth() === month;
    });
    document.getElementById('report-title').textContent =
      `تقرير شهر ${MONTHS_AR[month]} ${year}`;
  } else {
    filtered = users.filter(u => new Date(u.createdAt).getFullYear() === year);
    document.getElementById('report-title').textContent = `التقرير السنوي ${year}`;
  }

  const ctx = document.getElementById('reportChart').getContext('2d');
  if (reportChartInstance) reportChartInstance.destroy();

  if (type === 'monthly') {
    const labels = sections.map(s => s.name);
    const received = sections.map(s => filtered.filter(u => u.section===s.id && u.receivedTamween).length);
    const pending = sections.map(s => filtered.filter(u => u.section===s.id && !u.receivedTamween).length);
    reportChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'استلم التموين', data: received, backgroundColor: 'rgba(16,185,129,0.8)', borderRadius: 8 },
          { label: 'لم يستلم', data: pending, backgroundColor: 'rgba(239,68,68,0.7)', borderRadius: 8 }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
      }
    });
  } else {
    const monthlyTotal = MONTHS_AR.map((_, mi) =>
      users.filter(u => { const d = new Date(u.createdAt); return d.getFullYear()===year && d.getMonth()===mi; }).length
    );
    const monthlyReceived = MONTHS_AR.map((_, mi) =>
      users.filter(u => { const d = new Date(u.createdAt); return d.getFullYear()===year && d.getMonth()===mi && u.receivedTamween; }).length
    );
    reportChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: MONTHS_AR,
        datasets: [
          { label: 'إجمالي المستفيدين', data: monthlyTotal, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', tension: 0.4, fill: true },
          { label: 'استلموا التموين', data: monthlyReceived, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', tension: 0.4, fill: true }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
      }
    });
  }

  const cats = DB.getCategories();
  const tbody = document.getElementById('report-tbody');
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted)">لا توجد بيانات للفترة المحددة</td></tr>';
    return;
  }
  tbody.innerHTML = filtered.map((u, i) => {
    const sec = sections.find(s => s.id===u.section);
    const cat = cats.find(c => c.id===u.category);
    return `
    <tr>
      <td>${i+1}</td>
      <td>${u.name}</td>
      <td>${sec ? sec.name : '—'}</td>
      <td>${cat ? cat.name : '—'}</td>
      <td style="color:${u.registeredExternal?'#10b981':'#ef4444'};font-weight:700">${u.registeredExternal ? '✔ نعم' : '✘ لا'}</td>
      <td style="color:${u.receivedTamween?'#10b981':'#ef4444'};font-weight:700">${u.receivedTamween ? '✔ نعم' : '✘ لا'}</td>
    </tr>`;
  }).join('');
}

// ===== PDF EXPORT via html2canvas (Full Arabic Support) =====
async function exportPDF() {
  const type = document.getElementById('report-type').value;
  const month = parseInt(document.getElementById('report-month').value);
  const year = parseInt(document.getElementById('report-year').value);
  const users = DB.getUsers();
  const sections = DB.getSections();
  const cats = DB.getCategories();

  let filtered, titleText, subtitleText;
  if (type === 'monthly') {
    filtered = users.filter(u => {
      const d = new Date(u.createdAt);
      return d.getFullYear()===year && d.getMonth()===month;
    });
    titleText = `تقرير شهر ${MONTHS_AR[month]}`;
    subtitleText = `السنة: ${year}`;
  } else {
    filtered = users.filter(u => new Date(u.createdAt).getFullYear()===year);
    titleText = `التقرير السنوي`;
    subtitleText = `السنة: ${year}`;
  }

  const total = filtered.length;
  const received = filtered.filter(u => u.receivedTamween).length;
  const pending = total - received;
  const registered = filtered.filter(u => u.registeredExternal).length;

  showToast('جاري إنشاء التقرير...', 'info');

  // Build a standalone HTML div for rendering
  const printDiv = document.createElement('div');
  printDiv.style.cssText = `
    position:fixed; top:-9999px; left:-9999px;
    width:794px; background:#fff; font-family:'Cairo',sans-serif;
    direction:rtl; padding:0; z-index:-1;
  `;

  printDiv.innerHTML = `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
      * { box-sizing:border-box; margin:0; padding:0; font-family:'Cairo',sans-serif; }
      body { direction:rtl; }
    </style>

    <!-- HEADER -->
    <div style="background:linear-gradient(135deg,#1e3a8a,#3b82f6);padding:32px 40px;color:#fff;">
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:8px;">
        <div style="width:56px;height:56px;background:rgba(255,255,255,0.2);border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:28px;">📦</div>
        <div>
          <div style="font-size:32px;font-weight:900;letter-spacing:2px;">تموين</div>
          <div style="font-size:14px;opacity:0.8;">نظام إدارة المستفيدين</div>
        </div>
      </div>
      <div style="font-size:22px;font-weight:800;margin-top:12px;">${titleText}</div>
      <div style="font-size:14px;opacity:0.85;margin-top:4px;">${subtitleText} &nbsp;|&nbsp; تاريخ الطباعة: ${new Date().toLocaleDateString('ar-SA-u-nu-latn')}</div>
    </div>

    <!-- STATS -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:24px 40px 0;">
      <div style="background:linear-gradient(135deg,#1e40af,#3b82f6);border-radius:14px;padding:18px;color:#fff;text-align:center;">
        <div style="font-size:36px;font-weight:900;">${total}</div>
        <div style="font-size:12px;opacity:0.85;margin-top:4px;">إجمالي المستفيدين</div>
      </div>
      <div style="background:linear-gradient(135deg,#065f46,#10b981);border-radius:14px;padding:18px;color:#fff;text-align:center;">
        <div style="font-size:36px;font-weight:900;">${received}</div>
        <div style="font-size:12px;opacity:0.85;margin-top:4px;">استلموا التموين</div>
      </div>
      <div style="background:linear-gradient(135deg,#92400e,#f59e0b);border-radius:14px;padding:18px;color:#fff;text-align:center;">
        <div style="font-size:36px;font-weight:900;">${pending}</div>
        <div style="font-size:12px;opacity:0.85;margin-top:4px;">لم يستلموا بعد</div>
      </div>
      <div style="background:linear-gradient(135deg,#4c1d95,#8b5cf6);border-radius:14px;padding:18px;color:#fff;text-align:center;">
        <div style="font-size:36px;font-weight:900;">${registered}</div>
        <div style="font-size:12px;opacity:0.85;margin-top:4px;">مسجلون خارجياً</div>
      </div>
    </div>

    <!-- TABLE -->
    <div style="padding:24px 40px 40px;">
      <div style="font-size:16px;font-weight:800;color:#1e40af;margin-bottom:14px;border-right:4px solid #3b82f6;padding-right:10px;">قائمة المستفيدين</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:linear-gradient(90deg,#1e40af,#3b82f6);color:#fff;">
            <th style="padding:12px 10px;text-align:right;border-radius:0;font-weight:700;">#</th>
            <th style="padding:12px 10px;text-align:right;font-weight:700;">الاسم الكامل</th>
            <th style="padding:12px 10px;text-align:right;font-weight:700;">القسم</th>
            <th style="padding:12px 10px;text-align:right;font-weight:700;">الفئة</th>
            <th style="padding:12px 10px;text-align:center;font-weight:700;">مسجل خارجياً</th>
            <th style="padding:12px 10px;text-align:center;font-weight:700;">استلم التموين</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.length === 0
            ? `<tr><td colspan="6" style="text-align:center;padding:30px;color:#64748b;">لا توجد بيانات للفترة المحددة</td></tr>`
            : filtered.map((u, i) => {
                const sec = sections.find(s => s.id===u.section);
                const cat = cats.find(c => c.id===u.category);
                const bg = i % 2 === 0 ? '#f8fafc' : '#fff';
                return `
                <tr style="background:${bg};">
                  <td style="padding:11px 10px;color:#64748b;font-weight:600;">${i+1}</td>
                  <td style="padding:11px 10px;font-weight:700;color:#0f172a;">${u.name}</td>
                  <td style="padding:11px 10px;color:#475569;">${sec ? sec.name : '—'}</td>
                  <td style="padding:11px 10px;color:#475569;">${cat ? cat.name : '—'}</td>
                  <td style="padding:11px 10px;text-align:center;">
                    <span style="background:${u.registeredExternal?'#d1fae5':'#fee2e2'};color:${u.registeredExternal?'#065f46':'#991b1b'};padding:4px 12px;border-radius:20px;font-weight:700;font-size:12px;">
                      ${u.registeredExternal ? '✔ نعم' : '✘ لا'}
                    </span>
                  </td>
                  <td style="padding:11px 10px;text-align:center;">
                    <span style="background:${u.receivedTamween?'#d1fae5':'#fee2e2'};color:${u.receivedTamween?'#065f46':'#991b1b'};padding:4px 12px;border-radius:20px;font-weight:700;font-size:12px;">
                      ${u.receivedTamween ? '✔ نعم' : '✘ لا'}
                    </span>
                  </td>
                </tr>`;
              }).join('')
          }
        </tbody>
      </table>

      <!-- SECTION SUMMARY -->
      ${sections.length > 0 ? `
      <div style="margin-top:28px;">
        <div style="font-size:16px;font-weight:800;color:#1e40af;margin-bottom:14px;border-right:4px solid #3b82f6;padding-right:10px;">ملخص الأقسام</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
          ${sections.map(s => {
            const secUsers = filtered.filter(u => u.section === s.id);
            const secReceived = secUsers.filter(u => u.receivedTamween).length;
            return `
            <div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:12px;padding:14px;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                <div style="width:12px;height:12px;border-radius:50%;background:${s.color};flex-shrink:0;"></div>
                <div style="font-size:14px;font-weight:700;color:#0f172a;">${s.name}</div>
              </div>
              <div style="font-size:12px;color:#64748b;">الإجمالي: <strong style="color:#1e40af;">${secUsers.length}</strong></div>
              <div style="font-size:12px;color:#64748b;margin-top:2px;">استلموا: <strong style="color:#10b981;">${secReceived}</strong> &nbsp;|&nbsp; لم يستلموا: <strong style="color:#ef4444;">${secUsers.length - secReceived}</strong></div>
            </div>`;
          }).join('')}
        </div>
      </div>` : ''}

      <!-- FOOTER -->
      <div style="margin-top:36px;padding-top:16px;border-top:2px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;color:#94a3b8;font-size:11px;">
        <span>نظام تموين - جميع الحقوق محفوظة</span>
        <span>تم الإنشاء: ${new Date().toLocaleString('ar-SA-u-nu-latn')}</span>
      </div>
    </div>
  `;

  document.body.appendChild(printDiv);

  // Wait for fonts to load
  await document.fonts.ready;
  await new Promise(r => setTimeout(r, 600));

  try {
    const canvas = await html2canvas(printDiv, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: 794,
      logging: false
    });

    const { jsPDF } = window.jspdf;
    const imgData = canvas.toDataURL('image/jpeg', 0.97);

    // A4: 210mm x 297mm
    const pageW = 210;
    const pageH = 297;
    const imgW = pageW;
    const imgH = (canvas.height * pageW) / canvas.width;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    let heightLeft = imgH;
    let position = 0;

    doc.addImage(imgData, 'JPEG', 0, position, imgW, imgH);
    heightLeft -= pageH;

    while (heightLeft > 0) {
      position = heightLeft - imgH;
      doc.addPage();
      doc.addImage(imgData, 'JPEG', 0, position, imgW, imgH);
      heightLeft -= pageH;
    }

    const fileName = type === 'monthly'
      ? `tamween_${year}_${String(month+1).padStart(2,'0')}.pdf`
      : `tamween_annual_${year}.pdf`;

    savePdfSmart(doc, fileName);
    showToast('تم تصدير التقرير بنجاح ✓', 'success');
  } catch(err) {
    console.error(err);
    showToast('حدث خطأ أثناء إنشاء PDF', 'error');
  } finally {
    document.body.removeChild(printDiv);
  }
}
