/* ===== REPORTS & PDF ===== */

let currentPdfDoc = null;
let currentPdfBlob = null;
let currentPdfFileName = '';
let currentReportHTML = '';

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

// 1. Save Report as High-Res Image (PNG - Works 100% on all Android phones & Gallery)
async function saveReportAsImage() {
  const container = document.getElementById('report-preview-container');
  if (!container || !container.innerHTML) {
    showToast('لا يوجد تقرير للحفظ', 'error');
    return;
  }
  showToast('جاري حفظ صورة التقرير عالية الدقة...', 'info');

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      logging: false
    });

    const imgData = canvas.toDataURL('image/png');
    const imgName = `${(currentPdfFileName || 'tamween_report').replace('.pdf', '')}.png`;

    // If mobile supports sharing files (Android native share to Photos / Drive / WhatsApp)
    if (navigator.canShare) {
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], imgName, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: 'تقرير تموين',
              text: 'صورة تقرير تموين'
            });
            showToast('تمت مشاركة صورة التقرير بنجاح ✓', 'success');
            return;
          } catch (e) {
            if (e.name === 'AbortError') return;
          }
        }
        // Fallback: direct download link
        const a = document.createElement('a');
        a.href = imgData;
        a.download = imgName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast('تم حفظ الصورة في مجلد الصور والتنزيلات ✓', 'success');
      }, 'image/png');
    } else {
      const a = document.createElement('a');
      a.href = imgData;
      a.download = imgName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast('تم حفظ الصورة بنجاح ✓', 'success');
    }
  } catch (err) {
    console.error('Image capture error:', err);
    showToast('حدث خطأ أثناء حفظ الصورة: ' + err.message, 'error');
  }
}

// 2. Send Report Summary directly to WhatsApp
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

// 3. Open Clean Report Page in Browser for 100% Native Printing / Save as PDF
function openPrintInBrowser() {
  const container = document.getElementById('report-preview-container');
  if (!container || !container.innerHTML) {
    showToast('لا يوجد تقرير للطباعة', 'error');
    return;
  }

  const printHTML = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>${currentPdfFileName || 'تقرير تموين'}</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet" />
      <style>
        @page { size: A4 portrait; margin: 10mm; }
        * { box-sizing: border-box; font-family: 'Cairo', sans-serif; }
        body { direction: rtl; background: #ffffff; padding: 20px; text-align: right; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 15px; }
        th, td { padding: 10px 8px; border: 1px solid #cbd5e1; text-align: right; }
        th { background: #1e40af; color: #ffffff; font-weight: 700; }
        @media print {
          .no-print { display: none !important; }
          body { padding: 0; }
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="text-align:center;margin-bottom:24px;padding:16px;background:#eff6ff;border-radius:12px;border:1.5px dashed #3b82f6;">
        <button onclick="window.print()" style="background:#1e40af;color:#ffffff;padding:14px 28px;border:none;border-radius:10px;font-size:16px;font-weight:800;cursor:pointer;box-shadow:0 4px 12px rgba(30,64,175,0.3);">
          🖨️ اضغط هنا للطباعة أو الحفظ كـ PDF
        </button>
        <div style="font-size:12px;color:#64748b;margin-top:8px;">سيفتح مربع الطباعة في جهازك، يمكنك اختيار "حفظ بتنسيق PDF" مباشرة</div>
      </div>
      ${container.innerHTML}
    </body>
    </html>
  `;

  const blob = new Blob([printHTML], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win || win.closed) {
    const a = document.createElement('a');
    a.href = url;
    a.download = 'تقرير_تموين_للطباعة.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('تم تنزيل صفحة الطباعة — افتحها بالمتصفح للطباعة المباشرة ✓', 'info');
  }
}

// 4. Direct PDF Download
async function downloadCurrentPDF() {
  if (!currentPdfDoc) {
    showToast('جاري بناء ملف PDF...', 'info');
    await buildPdfFromPreview();
  }
  if (!currentPdfDoc) {
    showToast('تعذر إنشاء ملف PDF — يمكنك استخدام زر حفظ كصورة أو فتح للطباعة', 'error');
    return;
  }
  savePdfSmart(currentPdfDoc, currentPdfFileName);
  showToast('بدأ تحميل ملف PDF ✓', 'success');
}

// Builds the PDF from the visible in-app preview container
async function buildPdfFromPreview() {
  const container = document.getElementById('report-preview-container');
  if (!container || !container.innerHTML) return null;

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      logging: false
    });

    if (!canvas || canvas.width === 0 || canvas.height === 0) {
      throw new Error('Canvas capture empty');
    }

    const { jsPDF } = window.jspdf;
    const pageW = 210;
    const pageH = 297;
    const imgH = (canvas.height * pageW) / canvas.width;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    if (imgH <= pageH) {
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      doc.addImage(imgData, 'JPEG', 0, 0, pageW, imgH);
    } else {
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

    currentPdfDoc = doc;
    currentPdfBlob = doc.output('blob');
    return doc;
  } catch (err) {
    console.error('PDF build error:', err);
    return null;
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

// ===== MAIN EXPORT & PREVIEW ACTION =====
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

  const secFilePart = secFilter ? `_sec_${secFilter}` : '_all_sections';
  const statusFilePart = statusFilter ? `_${statusFilter}` : '_all';
  const fileName = type === 'monthly'
    ? `tamween_${year}_${String(month+1).padStart(2,'0')}${secFilePart}${statusFilePart}.pdf`
    : `tamween_annual_${year}${secFilePart}${statusFilePart}.pdf`;

  currentPdfFileName = fileName;
  currentPdfDoc = null;
  currentPdfBlob = null;

  // Build the complete styled report HTML
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
                    <td style="padding:9px 8px;color:#64748b;font-weight:600;">${i+1}</td>
                    <td style="padding:9px 8px;font-weight:700;color:#0f172a;">${u.name}</td>
                    <td style="padding:9px 8px;color:#475569;">${sec ? sec.name : '—'}</td>
                    <td style="padding:9px 8px;color:#475569;">${cat ? cat.name : '—'}</td>
                    <td style="padding:9px 8px;text-align:center;font-weight:800;color:#1e40af;font-family:monospace;">${u.cardPass || '—'}</td>
                    <td style="padding:9px 8px;text-align:center;font-weight:800;color:#0f172a;">${ind}</td>
                    <td style="padding:9px 8px;text-align:center;">
                      <span style="background:${u.registeredExternal?'#d1fae5':'#fee2e2'};color:${u.registeredExternal?'#065f46':'#991b1b'};padding:3px 8px;border-radius:14px;font-weight:700;font-size:11px;">
                        ${u.registeredExternal ? '✔ نعم' : '✘ لا'}
                      </span>
                    </td>
                    <td style="padding:9px 8px;text-align:center;">
                      <span style="background:${u.receivedTamween?'#d1fae5':'#fee2e2'};color:${u.receivedTamween?'#065f46':'#991b1b'};padding:3px 8px;border-radius:14px;font-weight:700;font-size:11px;">
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

  // 1. Render directly into the in-app preview container (100% visible on screen!)
  const container = document.getElementById('report-preview-container');
  if (container) {
    container.innerHTML = reportHTML;
  }
  const previewTitle = document.getElementById('report-preview-title');
  if (previewTitle) {
    previewTitle.textContent = `${titleText} (${sectionLabel} - ${statusLabel})`;
  }

  // 2. Open the preview modal so user immediately sees their report!
  openModal('report-preview-modal');
  showToast('تم إظهار التقرير بنجاح ✓', 'success');

  // 3. Build the PDF in the background from the now-visible container
  setTimeout(async () => {
    await buildPdfFromPreview();
  }, 300);
}
