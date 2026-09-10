/* ===== REPORTS & PDF ===== */

let currentPdfDoc = null;
let currentPdfBlob = null;
let currentPdfFileName = '';
let currentReportImage = null;

// Detect Android WebView / PWA environment
function isAndroidWebView() {
  const ua = navigator.userAgent || '';
  return /Android/.test(ua) && (/wv/.test(ua) || /Version\/[\d.]+.*Chrome/.test(ua) || window.Android !== undefined);
}

// Smart PDF saver: direct download
function savePdfSmart(doc, fileName) {
  try {
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  } catch(e) {
    try {
      const dataUri = doc.output('datauristring');
      const a = document.createElement('a');
      a.href = dataUri;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch(err) {
      console.warn('Download error:', err);
    }
  }
}

// Native Mobile Share / Save
async function shareCurrentPDF() {
  if (!currentPdfBlob) {
    showToast('لا يوجد تقرير جاهز للمشاركة', 'error');
    return;
  }

  const file = new File([currentPdfBlob], currentPdfFileName, { type: 'application/pdf' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'تقرير تموين',
        text: currentPdfFileName
      });
      showToast('تمت المشاركة بنجاح ✓', 'success');
      return;
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('Share error:', err);
      } else {
        return; // User closed the native share tray
      }
    }
  }

  // Fallback if Web Share API with files is not available
  downloadCurrentPDF();
}

// Native Print / Save as PDF
function printCurrentReport() {
  if (!currentReportImage) return;

  let printFrame = document.getElementById('report-print-frame');
  if (printFrame) {
    try { document.body.removeChild(printFrame); } catch(e) {}
  }

  printFrame = document.createElement('iframe');
  printFrame.id = 'report-print-frame';
  printFrame.style.position = 'fixed';
  printFrame.style.right = '0';
  printFrame.style.bottom = '0';
  printFrame.style.width = '0';
  printFrame.style.height = '0';
  printFrame.style.border = '0';
  document.body.appendChild(printFrame);

  const frameDoc = printFrame.contentWindow.document;
  frameDoc.open();
  frameDoc.write(`
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
      <title>${currentPdfFileName}</title>
      <style>
        @page { size: A4 portrait; margin: 0; }
        body { margin: 0; padding: 0; background: #fff; text-align: center; }
        img { width: 100%; max-width: 210mm; display: block; margin: 0 auto; }
      </style>
    </head>
    <body>
      <img src="${currentReportImage}" />
    </body>
    </html>
  `);
  frameDoc.close();

  setTimeout(() => {
    printFrame.contentWindow.focus();
    printFrame.contentWindow.print();
    setTimeout(() => {
      try { document.body.removeChild(printFrame); } catch(e) {}
    }, 2000);
  }, 400);
}

// Direct Download action
function downloadCurrentPDF() {
  if (!currentPdfDoc) {
    showToast('لا يوجد تقرير للتنزيل', 'error');
    return;
  }
  savePdfSmart(currentPdfDoc, currentPdfFileName);
  showToast('جاري تنزيل التقرير في مجلد التنزيلات ✓', 'success');
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
      <td>${i+1}</td>
      <td style="font-weight:700;">${u.name}</td>
      <td>${sec ? sec.name : '—'}</td>
      <td>${cat ? cat.name : '—'}</td>
      <td style="font-family:monospace;font-weight:700;color:var(--primary);">${u.cardPass || '—'}</td>
      <td style="font-weight:700;">${ind}</td>
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

  showToast('جاري تجهيز تقرير PDF...', 'info');

  // Create render element at document origin behind all elements (never negative off-screen)
  const printDiv = document.createElement('div');
  printDiv.id = 'report-render-node';
  printDiv.style.cssText = `
    position: absolute;
    left: 0;
    top: 0;
    width: 850px;
    background: #ffffff;
    font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;
    direction: rtl;
    padding: 0;
    margin: 0;
    z-index: -99999;
    opacity: 0.99;
    pointer-events: none;
  `;

  printDiv.innerHTML = `
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; }
      body { direction: rtl; }
    </style>

    <!-- HEADER -->
    <div style="background:linear-gradient(135deg,#1e3a8a,#3b82f6);padding:28px 36px;color:#ffffff;">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:14px;">
          <div style="width:52px;height:52px;background:rgba(255,255,255,0.2);border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:26px;">📦</div>
          <div>
            <div style="font-size:28px;font-weight:900;letter-spacing:1px;color:#ffffff;">تموين</div>
            <div style="font-size:13px;opacity:0.9;color:#ffffff;">نظام إدارة المستفيدين والتموين</div>
          </div>
        </div>
        <div style="text-align:left;font-size:12px;opacity:0.9;color:#ffffff;">
          <div>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-SA-u-nu-latn')}</div>
          <div>الوقت: ${new Date().toLocaleTimeString('ar-SA-u-nu-latn')}</div>
        </div>
      </div>
      <div style="margin-top:16px;border-top:1px solid rgba(255,255,255,0.25);padding-top:12px;display:flex;justify-content:space-between;align-items:center;">
        <div style="font-size:20px;font-weight:800;color:#ffffff;">${titleText}</div>
        <div style="font-size:13px;background:rgba(255,255,255,0.2);padding:4px 14px;border-radius:20px;color:#ffffff;">
          ${sectionLabel} | ${statusLabel}
        </div>
      </div>
    </div>

    <!-- STATS SUMMARY (5 Cards) -->
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;padding:20px 36px 0;">
      <div style="background:#1e40af;border-radius:12px;padding:14px;color:#ffffff;text-align:center;">
        <div style="font-size:28px;font-weight:900;">${totalBeneficiaries}</div>
        <div style="font-size:11px;opacity:0.9;margin-top:4px;">إجمالي المستفيدين</div>
      </div>
      <div style="background:#4338ca;border-radius:12px;padding:14px;color:#ffffff;text-align:center;">
        <div style="font-size:28px;font-weight:900;">${totalIndividuals}</div>
        <div style="font-size:11px;opacity:0.9;margin-top:4px;">إجمالي الأفراد</div>
      </div>
      <div style="background:#065f46;border-radius:12px;padding:14px;color:#ffffff;text-align:center;">
        <div style="font-size:28px;font-weight:900;">${receivedCount}</div>
        <div style="font-size:11px;opacity:0.9;margin-top:4px;">استلموا التموين</div>
      </div>
      <div style="background:#991b1b;border-radius:12px;padding:14px;color:#ffffff;text-align:center;">
        <div style="font-size:28px;font-weight:900;">${pendingCount}</div>
        <div style="font-size:11px;opacity:0.9;margin-top:4px;">لم يستلموا بعد</div>
      </div>
      <div style="background:#6b21a8;border-radius:12px;padding:14px;color:#ffffff;text-align:center;">
        <div style="font-size:28px;font-weight:900;">${machineRegisteredCount}</div>
        <div style="font-size:11px;opacity:0.9;margin-top:4px;">تم التسجيل على الماكينه</div>
      </div>
    </div>

    <!-- TABLE -->
    <div style="padding:20px 36px 36px;">
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
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
            ? `<tr><td colspan="8" style="text-align:center;padding:30px;color:#64748b;font-size:14px;">لا توجد بيانات مطابقة لمعايير التقرير</td></tr>`
            : filtered.map((u, i) => {
                const sec = sections.find(s => s.id === u.section);
                const cat = cats.find(c => c.id === u.category);
                const ind = parseInt(u.individuals) || 1;
                const bg = i % 2 === 0 ? '#f8fafc' : '#ffffff';
                return `
                <tr style="background:${bg};border-bottom:1px solid #e2e8f0;">
                  <td style="padding:9px 8px;color:#64748b;font-weight:600;">${i+1}</td>
                  <td style="padding:9px 8px;font-weight:700;color:#0f172a;">${u.name}</td>
                  <td style="padding:9px 8px;color:#475569;">${sec ? sec.name : '—'}</td>
                  <td style="padding:9px 8px;color:#475569;">${cat ? cat.name : '—'}</td>
                  <td style="padding:9px 8px;text-align:center;font-weight:800;color:#1e40af;font-family:monospace;">${u.cardPass || '—'}</td>
                  <td style="padding:9px 8px;text-align:center;font-weight:800;color:#0f172a;">${ind}</td>
                  <td style="padding:9px 8px;text-align:center;">
                    <span style="background:${u.registeredExternal?'#d1fae5':'#fee2e2'};color:${u.registeredExternal?'#065f46':'#991b1b'};padding:3px 10px;border-radius:20px;font-weight:700;font-size:11px;">
                      ${u.registeredExternal ? '✔ نعم' : '✘ لا'}
                    </span>
                  </td>
                  <td style="padding:9px 8px;text-align:center;">
                    <span style="background:${u.receivedTamween?'#d1fae5':'#fee2e2'};color:${u.receivedTamween?'#065f46':'#991b1b'};padding:3px 10px;border-radius:20px;font-weight:700;font-size:11px;">
                      ${u.receivedTamween ? '✔ نعم' : '✘ لا'}
                    </span>
                  </td>
                </tr>`;
              }).join('')
          }
        </tbody>
      </table>

      <!-- FOOTER -->
      <div style="margin-top:28px;padding-top:14px;border-top:2px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;color:#94a3b8;font-size:11px;">
        <span>نظام تموين - تقرير رسمي مصدق</span>
        <span>تاريخ الإصدار: ${new Date().toLocaleDateString('ar-SA-u-nu-latn')}</span>
      </div>
    </div>
  `;

  document.body.appendChild(printDiv);

  await document.fonts.ready;
  await new Promise(r => setTimeout(r, 400));

  try {
    // Render using exact origin coordinates to ensure zero blanking
    const canvas = await html2canvas(printDiv, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      width: 850,
      windowWidth: 850,
      x: 0,
      y: 0,
      scrollX: 0,
      scrollY: 0,
      logging: false
    });

    if (!canvas || canvas.width === 0 || canvas.height === 0) {
      throw new Error('Canvas render was empty');
    }

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const { jsPDF } = window.jspdf;

    const pageW = 210;
    const pageH = 297;
    const imgW = pageW;
    const imgH = (canvas.height * pageW) / canvas.width;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    if (imgH <= pageH) {
      // Fits on a single A4 page
      doc.addImage(imgData, 'JPEG', 0, 0, imgW, imgH);
    } else {
      // Multi-page: slice canvas into A4 chunks so each page is cleanly drawn
      const pageCanvasHeight = (canvas.width * pageH) / pageW;
      let renderedHeight = 0;
      let pageIndex = 0;

      while (renderedHeight < canvas.height) {
        if (pageIndex > 0) doc.addPage();

        const chunkHeight = Math.min(pageCanvasHeight, canvas.height - renderedHeight);
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = pageCanvasHeight;
        const pageCtx = pageCanvas.getContext('2d');
        pageCtx.fillStyle = '#ffffff';
        pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

        pageCtx.drawImage(
          canvas,
          0, renderedHeight, canvas.width, chunkHeight,
          0, 0, canvas.width, chunkHeight
        );

        const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.95);
        doc.addImage(pageImgData, 'JPEG', 0, 0, pageW, pageH);

        renderedHeight += pageCanvasHeight;
        pageIndex++;
      }
    }

    const secFilePart = secFilter ? `_sec_${secFilter}` : '_all_sections';
    const statusFilePart = statusFilter ? `_${statusFilter}` : '_all';
    const fileName = type === 'monthly'
      ? `tamween_${year}_${String(month+1).padStart(2,'0')}${secFilePart}${statusFilePart}.pdf`
      : `tamween_annual_${year}${secFilePart}${statusFilePart}.pdf`;

    // Save references for modal & sharing
    currentPdfDoc = doc;
    currentPdfBlob = doc.output('blob');
    currentPdfFileName = fileName;
    currentReportImage = imgData;

    // 1. Render in-app preview container
    const previewContainer = document.getElementById('report-preview-container');
    if (previewContainer) {
      previewContainer.innerHTML = `<img src="${imgData}" style="width:100%;display:block;border-radius:6px;" alt="معاينة التقرير" />`;
    }
    const previewTitle = document.getElementById('report-preview-title');
    if (previewTitle) {
      previewTitle.textContent = `${titleText} (${sectionLabel} - ${statusLabel})`;
    }

    // 2. Open the preview modal on screen immediately!
    openModal('report-preview-modal');
    showToast('تم تجهيز التقرير بنجاح ✓', 'success');

    // 3. For mobile / Android APK: directly trigger native share if available!
    if (isAndroidWebView() || /Android|iPhone|iPad/i.test(navigator.userAgent)) {
      setTimeout(() => {
        shareCurrentPDF();
      }, 400);
    } else {
      // Desktop browser: trigger direct download
      downloadCurrentPDF();
    }
  } catch(err) {
    console.error(err);
    showToast('حدث خطأ أثناء إنشاء PDF', 'error');
  } finally {
    document.body.removeChild(printDiv);
  }
}
