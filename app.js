/**
 * Vietnamese PDF Report Signature & Table Splitter
 * Core Engine & Interactive UI
 * Conforms to Decree 30/2020/ND-CP on Vietnamese Administrative Documents
 */

(function () {
  'use strict';

  // Helper to convert base64 to Uint8Array safely without closure memory overhead
  function b64ToUint8(b64) {
    const bin = atob(b64);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      u8[i] = bin.charCodeAt(i);
    }
    return u8;
  }

  // --- STATE ---
  let state = {
    pdfBytes: null,
    pdfFileName: 'report.pdf',
    pdfDoc: null,         // PDF.js Document
    numPages: 0,
    currentPage: 1,
    zoomScale: 1.25,

    // Detection on last page (matching original PDF report geometry)
    detectedStudents: [],
    tableHeaderTop: 813.50,
    tableHeaderBottom: 771.21,
    tableLeft: 14.28,
    tableRight: 579.92,
    tableBottom: 105.07,
    availableSpace: 50,

    // Split settings
    splitEnabled: false,
    splitStudentNum: null,
    splitCutY: 292.89,
    repeatHeader: true,
    addPageNumber: true,

    // Signature settings
    dateText: 'TP. Hồ Chí Minh, Thứ Sáu, ngày 09 tháng 10 năm 2026',
    titleText: 'Giám đốc Chương trình',
    nameText: 'Võ Ngọc Thu',
    sigClearance: 65,
    fontSizeDate: 11,
    fontSizeTitle: 12,
    fontSizeName: 12,

    // Position coordinates (PDF points from bottom-left)
    sigX: 579.92,         // Aligned with table right boundary (Column 4)
    sigY: 550,            // Top of signature block
    sigWidth: 215,        // Width of Column 4 (366.84 to 579.92), center ~473pt
    sigAutoPlaced: true,  // Automatically snaps beneath table until user drags/adjusts
    sigImageBytes: null,

    // Page dimensions
    pageWidth: 596,
    pageHeight: 842,

    // Dragging state
    isDraggingSig: false,
    dragStartMouseX: 0,
    dragStartMouseY: 0,
    dragStartSigX: 0,
    dragStartSigY: 0
  };
  window.appState = state;

  // Rendering concurrency control
  let currentRenderTask = null;
  let isRendering = false;
  let pendingRender = false;
  let renderDebounceTimer = null;

  // --- DOM ELEMENTS ---
  const el = {
    dropzone: document.getElementById('upload-dropzone'),
    fileInput: document.getElementById('file-input'),
    fileInfo: document.getElementById('file-info-bar'),
    fileName: document.getElementById('file-name-display'),
    filePages: document.getElementById('file-pages-display'),
    btnSampleSplit: document.getElementById('btn-sample-split'),
    btnSample5p: document.getElementById('btn-sample-5p'),

    // Signature inputs
    inputDate: document.getElementById('input-date'),
    inputTitle: document.getElementById('input-title'),
    inputName: document.getElementById('input-name'),
    inputClearance: document.getElementById('input-clearance'),
    valClearance: document.getElementById('val-clearance'),
    inputSigImage: document.getElementById('input-sig-image'),

    // Font size inputs
    inputFsDate: document.getElementById('input-fs-date'),
    valFsDate: document.getElementById('val-fs-date'),
    inputFsTitle: document.getElementById('input-fs-title'),
    valFsTitle: document.getElementById('val-fs-title'),
    inputFsName: document.getElementById('input-fs-name'),
    valFsName: document.getElementById('val-fs-name'),

    // Position inputs
    inputSigY: document.getElementById('input-sig-y'),
    valSigY: document.getElementById('val-sig-y'),
    btnPosUnderTable: document.getElementById('btn-pos-undertable'),
    btnPosMidPage: document.getElementById('btn-pos-midpage'),
    btnPosBottomPage: document.getElementById('btn-pos-bottompage'),

    // Space & Split
    spaceBanner: document.getElementById('space-status-banner'),
    bannerText: document.getElementById('banner-text'),
    toggleSplit: document.getElementById('toggle-split'),
    splitOptionsCard: document.getElementById('split-options-card'),
    selectStudentSplit: document.getElementById('select-student-split'),
    inputCutY: document.getElementById('input-cut-y'),
    valCutY: document.getElementById('val-cut-y'),
    chkRepeatHeader: document.getElementById('chk-repeat-header'),
    chkAddPageNum: document.getElementById('chk-add-page-num'),

    // Actions
    btnRefreshPreview: document.getElementById('btn-refresh-preview'),
    btnDownloadPdf: document.getElementById('btn-download-pdf'),

    // Preview
    pageTabs: document.getElementById('page-tabs'),
    canvasWrapper: document.getElementById('canvas-wrapper'),
    pdfCanvas: document.getElementById('pdf-canvas'),
    btnZoomIn: document.getElementById('btn-zoom-in'),
    btnZoomOut: document.getElementById('btn-zoom-out'),
    btnZoomFit: document.getElementById('btn-zoom-fit'),
    emptyState: document.getElementById('empty-state'),
    toast: document.getElementById('toast'),
    toastMsg: document.getElementById('toast-msg')
  };

  // --- CALCULATE SIGNATURE BLOCK HEIGHT ---
  function getSignatureBlockHeight() {
    const dateH = state.fontSizeDate * 1.2;
    const titleH = state.fontSizeTitle * 1.4;
    const clearance = state.sigClearance || 65;
    const nameH = state.fontSizeName * 1.2;
    return Math.round(dateH + 12 + titleH + clearance + nameH);
  }

  // --- INITIALIZATION ---
  window.addEventListener('DOMContentLoaded', async () => {
    setupPDFJSWorker();
    setupEventListeners();
    initDatePresets();
  });

  function setupPDFJSWorker() {
    if (window.pdfjsLib) {
      if (window.pdfjsLib.GlobalWorkerOptions) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = './libs/pdf.worker.umd.min.js';
      }
    }
  }

  // --- VIETNAMESE DATE GENERATOR ---
  function getVietnameseDateString(d = new Date(), includeDayOfWeek = true) {
    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const dayOfWeek = days[d.getDay()];
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();

    if (includeDayOfWeek) {
      return `TP. Hồ Chí Minh, ${dayOfWeek}, ngày ${day} tháng ${month} năm ${year}`;
    }
    return `TP. Hồ Chí Minh, ngày ${day} tháng ${month} năm ${year}`;
  }

  function initDatePresets() {
    const today = new Date();
    const defaultDateStr = getVietnameseDateString(today, true);
    if (!el.inputDate.value) {
      el.inputDate.value = defaultDateStr;
      state.dateText = defaultDateStr;
    }
  }

  // --- EVENT LISTENERS ---
  function setupEventListeners() {
    // Dropzone
    el.dropzone.addEventListener('click', () => el.fileInput.click());
    el.dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      el.dropzone.classList.add('dragover');
    });
    el.dropzone.addEventListener('dragleave', () => el.dropzone.classList.remove('dragover'));
    el.dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      el.dropzone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) {
        loadPdfFile(e.dataTransfer.files[0]);
      }
    });
    el.fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        loadPdfFile(e.target.files[0]);
      }
    });

    // Sample buttons
    el.btnSampleSplit.addEventListener('click', (e) => {
      e.stopPropagation();
      loadSamplePdf('sample_report_page4_full.pdf', 'Báo cáo mẫu (4 trang)');
    });
    el.btnSample5p.addEventListener('click', (e) => {
      e.stopPropagation();
      loadSamplePdf('sample_report_page5_spacious.pdf', 'Báo cáo mẫu (5 trang)');
    });

    // Date chips
    document.querySelectorAll('.date-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const type = chip.getAttribute('data-type');
        const now = new Date();
        if (type === 'today-dow') {
          el.inputDate.value = getVietnameseDateString(now, true);
        } else if (type === 'today') {
          el.inputDate.value = getVietnameseDateString(now, false);
        } else if (type === 'end-month') {
          const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          el.inputDate.value = getVietnameseDateString(endOfMonth, false);
        }
        state.dateText = el.inputDate.value;
        triggerPreviewRefresh();
      });
    });

    // Title chips
    document.querySelectorAll('.title-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        el.inputTitle.value = chip.textContent.trim();
        state.titleText = el.inputTitle.value;
        triggerPreviewRefresh();
      });
    });

    // Text Inputs change
    el.inputDate.addEventListener('input', () => {
      state.dateText = el.inputDate.value;
      triggerPreviewRefresh();
    });
    el.inputTitle.addEventListener('input', () => {
      state.titleText = el.inputTitle.value;
      triggerPreviewRefresh();
    });
    el.inputName.addEventListener('input', () => {
      state.nameText = el.inputName.value;
      triggerPreviewRefresh();
    });

    // Signature Clearance Slider
    el.inputClearance.addEventListener('input', (e) => {
      state.sigClearance = parseInt(e.target.value);
      el.valClearance.textContent = `${state.sigClearance} pt`;
      triggerPreviewRefresh();
    });

    // Font Sizes Sliders
    el.inputFsDate.addEventListener('input', (e) => {
      state.fontSizeDate = parseFloat(e.target.value);
      el.valFsDate.textContent = `${state.fontSizeDate}pt`;
      triggerPreviewRefresh();
    });
    el.inputFsTitle.addEventListener('input', (e) => {
      state.fontSizeTitle = parseFloat(e.target.value);
      el.valFsTitle.textContent = `${state.fontSizeTitle}pt`;
      triggerPreviewRefresh();
    });
    el.inputFsName.addEventListener('input', (e) => {
      state.fontSizeName = parseFloat(e.target.value);
      el.valFsName.textContent = `${state.fontSizeName}pt`;
      triggerPreviewRefresh();
    });

    // Position Y Slider
    el.inputSigY.addEventListener('input', (e) => {
      state.sigY = parseFloat(e.target.value);
      state.sigAutoPlaced = false;
      el.valSigY.textContent = `Y = ${Math.round(state.sigY)} pt`;
      triggerPreviewRefresh();
    });

    // Quick Position Buttons
    el.btnPosUnderTable.addEventListener('click', () => {
      snapSignatureUnderTable();
      triggerPreviewRefresh();
    });
    el.btnPosMidPage.addEventListener('click', () => {
      snapSignatureMidPage();
      triggerPreviewRefresh();
    });
    el.btnPosBottomPage.addEventListener('click', () => {
      snapSignatureBottomPage();
      triggerPreviewRefresh();
    });

    // Signature Image Upload
    el.inputSigImage.addEventListener('change', async (e) => {
      if (e.target.files.length > 0) {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (ev) => {
          const raw = ev.target.result;
          state.sigImageBytes = (raw instanceof ArrayBuffer) ? raw.slice(0) : raw.buffer.slice(0);
          showToast('Đã tải lên hình ảnh chữ ký / con dấu!', 'success');
          triggerPreviewRefresh();
        };
        reader.readAsArrayBuffer(file);
      } else {
        state.sigImageBytes = null;
        triggerPreviewRefresh();
      }
    });

    // Split Toggle (USER CONTROLLED)
    el.toggleSplit.addEventListener('change', (e) => {
      state.splitEnabled = e.target.checked;
      el.splitOptionsCard.style.display = state.splitEnabled ? 'block' : 'none';
      if (state.splitEnabled) {
        state.currentPage = state.numPages + 1;
      } else {
        state.currentPage = state.numPages;
        snapSignatureUnderTable();
      }
      updatePageTabs();
      triggerPreviewRefresh();
    });

    // Split Student Select
    el.selectStudentSplit.addEventListener('change', (e) => {
      const studentNum = parseInt(e.target.value);
      state.splitStudentNum = studentNum;
      updateCutYFromStudent(studentNum);
      triggerPreviewRefresh();
    });

    // Cut Y Slider
    el.inputCutY.addEventListener('input', (e) => {
      state.splitCutY = parseFloat(e.target.value);
      el.valCutY.textContent = `${Math.round(state.splitCutY)} pt`;
      triggerPreviewRefresh();
    });

    // Options Checkboxes
    el.chkRepeatHeader.addEventListener('change', (e) => {
      state.repeatHeader = e.target.checked;
      triggerPreviewRefresh();
    });
    el.chkAddPageNum.addEventListener('change', (e) => {
      state.addPageNumber = e.target.checked;
      triggerPreviewRefresh();
    });

    // Zoom Controls
    el.btnZoomIn.addEventListener('click', () => {
      state.zoomScale = Math.min(2.5, state.zoomScale + 0.2);
      renderCurrentPagePreview();
    });
    el.btnZoomOut.addEventListener('click', () => {
      state.zoomScale = Math.max(0.6, state.zoomScale - 0.2);
      renderCurrentPagePreview();
    });
    el.btnZoomFit.addEventListener('click', () => {
      state.zoomScale = 1.25;
      renderCurrentPagePreview();
    });

    // Action Buttons
    el.btnRefreshPreview.addEventListener('click', () => triggerPreviewRefresh());
    el.btnDownloadPdf.addEventListener('click', () => exportAndDownloadPdf());

    // Canvas Container Global Mouse Events for Dragging
    window.addEventListener('mousemove', onGlobalMouseMove);
    window.addEventListener('mouseup', onGlobalMouseUp);
    window.addEventListener('touchmove', onGlobalTouchMove, { passive: false });
    window.addEventListener('touchend', onGlobalMouseUp);
  }

  function snapSignatureUnderTable() {
    state.sigAutoPlaced = true;
    const sigH = getSignatureBlockHeight();
    const minSafeSigY = 55 + sigH; // Minimum Y to never hang off bottom
    if (state.splitEnabled && state.currentPage === state.numPages + 1) {
      const dy = state.tableHeaderBottom - state.splitCutY;
      const newRowBottom = state.tableBottom + dy;
      state.sigY = Math.max(minSafeSigY, newRowBottom - 25);
    } else {
      state.sigY = Math.max(minSafeSigY, state.tableBottom - 25);
    }
    el.inputSigY.value = Math.round(state.sigY);
    el.valSigY.textContent = `Y = ${Math.round(state.sigY)} pt`;
  }

  function snapSignatureMidPage() {
    state.sigAutoPlaced = false;
    const sigH = getSignatureBlockHeight();
    const minSafeSigY = 55 + sigH;
    const midY = ((state.tableBottom + 55) / 2) + (sigH / 2);
    state.sigY = Math.max(minSafeSigY, Math.min(state.pageHeight - 50, midY));
    el.inputSigY.value = Math.round(state.sigY);
    el.valSigY.textContent = `Y = ${Math.round(state.sigY)} pt (Giữa trang)`;
  }

  function snapSignatureBottomPage() {
    state.sigAutoPlaced = false;
    const sigH = getSignatureBlockHeight();
    state.sigY = 55 + sigH + 10;
    el.inputSigY.value = Math.round(state.sigY);
    el.valSigY.textContent = `Y = ${Math.round(state.sigY)} pt (Đáy trang)`;
  }

  // --- LOAD SAMPLES ---
  async function loadSamplePdf(filename, displayName) {
    showToast(`Đang nạp file mẫu: ${displayName}...`, 'info');

    // 1. Check embedded base64 first (guarantees 100% offline file:// compatibility)
    if (window.SAMPLE_PDF_B64 && filename.includes('sample_report_page4_full')) {
      const u8 = b64ToUint8(window.SAMPLE_PDF_B64);
      await handlePdfArrayBuffer(u8.buffer, 'sample_report_page4_full.pdf');
      showToast('Đã nạp file mẫu thành công!', 'success');
      return;
    }

    // 2. Fetch if running via HTTP
    try {
      const resp = await fetch(filename);
      if (!resp.ok) throw new Error('Fetch failed');
      const arrayBuffer = await resp.arrayBuffer();
      await handlePdfArrayBuffer(arrayBuffer, displayName);
      showToast('Đã nạp file mẫu thành công!', 'success');
    } catch (err) {
      if (window.SAMPLE_PDF_B64) {
        const u8 = b64ToUint8(window.SAMPLE_PDF_B64);
        await handlePdfArrayBuffer(u8.buffer, 'sample_report.pdf');
        showToast('Đã nạp file mẫu thành công!', 'success');
      } else {
        showToast('Trình duyệt chặn fetch trên file://. Vui lòng kéo thả file PDF của bạn vào ô tải tệp.', 'error');
      }
    }
  }

  // --- LOAD USER PDF ---
  async function loadPdfFile(file) {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      showToast('Vui lòng chọn tệp định dạng PDF!', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
      await handlePdfArrayBuffer(e.target.result, file.name);
    };
    reader.readAsArrayBuffer(file);
  }

  // --- PROCESS LOADED PDF ---
  async function handlePdfArrayBuffer(arrayBuffer, fileName) {
    // Keep our own independent copy of the ArrayBuffer so it never gets detached by PDF.js Web Worker
    const rawBuffer = (arrayBuffer instanceof ArrayBuffer) ? arrayBuffer : arrayBuffer.buffer;
    state.pdfBytes = rawBuffer.slice(0);
    state.pdfFileName = fileName;

    // Pass a separate clone to PDF.js worker
    const workerBytes = new Uint8Array(rawBuffer.slice(0));
    const loadingTask = pdfjsLib.getDocument({ data: workerBytes });
    state.pdfDoc = await loadingTask.promise;
    state.numPages = state.pdfDoc.numPages;

    // Update UI info
    el.fileName.textContent = fileName;
    el.filePages.textContent = `${state.numPages} trang`;
    el.fileInfo.style.display = 'flex';
    el.emptyState.style.display = 'none';
    el.canvasWrapper.style.display = 'inline-block';

    // Analyze Last Page
    await analyzeLastPage();

    // Default viewing page: last page of document
    state.currentPage = state.numPages;

    updatePageTabs();
    await renderCurrentPagePreview();
  }

  // --- ACCURATE LAST PAGE ANALYSIS & TABLE BOTTOM DETECTION ---
  async function analyzeLastPage() {
    const lastPageNum = state.numPages;
    const page = await state.pdfDoc.getPage(lastPageNum);
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1.0 });

    state.pageWidth = viewport.width;
    state.pageHeight = viewport.height;

    // Update Y slider max
    el.inputSigY.max = Math.round(state.pageHeight - 50);

    const items = textContent.items.map(it => ({
      str: it.str.trim(),
      x: it.transform[4],
      y: it.transform[5],
      w: it.width,
      h: it.height
    })).filter(it => it.str.length > 0);

    // Calculate table width & margins from text items
    const textMinX = items.length > 0 ? Math.min(...items.map(it => it.x)) : 14.28;
    const textMaxX = items.length > 0 ? Math.max(...items.map(it => it.x + (it.w || 0))) : 579.92;

    // In primary school report templates: standard table is left=14.28, right=579.92 (565.64pt width)
    if (textMinX >= 12 && textMinX <= 30 && textMaxX >= 560 && textMaxX <= 590) {
      state.tableLeft = 14.28;
      state.tableRight = 579.92;
    } else {
      state.tableLeft = Math.max(10, Math.floor(textMinX - 4));
      state.tableRight = Math.min(state.pageWidth - 10, Math.ceil(textMaxX + 7));
    }

    // Find Header bounds
    const headerItems = items.filter(it =>
      it.str.includes('STT') || it.str.includes('Name of Student') ||
      it.str.includes('Họ và tên') || it.str.includes('Comment') ||
      it.str.includes('Nhận xét') || it.str.includes('năng lực') ||
      it.str.includes('phẩm chất') || it.str.includes('ability') ||
      it.str.includes('behaviour')
    );
    if (headerItems.length > 0) {
      const maxH = Math.max(...headerItems.map(it => it.y));
      if (maxH >= 775 && maxH <= 815) {
        state.tableHeaderTop = 813.50;
        state.tableHeaderBottom = 771.21;
      } else {
        state.tableHeaderTop = maxH + 18;
        state.tableHeaderBottom = Math.min(...headerItems.map(it => it.y)) - 10.4;
      }
    } else {
      state.tableHeaderTop = 813.50;
      state.tableHeaderBottom = 771.21;
    }

    // Find STT digits in column 1 (X < 55)
    const rawStt = items.filter(it => it.x < 55 && /^\d+$/.test(it.str) && it.y < state.tableHeaderBottom && it.y >= 55);
    const mergedStt = [];
    rawStt.forEach(stt => {
      const existing = mergedStt.find(m => Math.abs(m.y - stt.y) < 3);
      if (existing) {
        existing.str += stt.str;
      } else {
        mergedStt.push({ ...stt });
      }
    });
    mergedStt.sort((a, b) => b.y - a.y);

    // Group into student records and calculate EXACT row divider lines based on lowest text
    state.detectedStudents = [];
    for (let i = 0; i < mergedStt.length; i++) {
      const stt = mergedStt[i];
      const nextStt = mergedStt[i + 1];

      // Find student name on same row
      const nameItems = items.filter(it => it.x >= 35 && it.x < 185 && Math.abs(it.y - stt.y) < 18);
      const studentName = nameItems.map(p => p.str).join(' ') || `Học sinh số ${stt.str}`;

      // All text items belonging to this student (between this STT line and next STT line)
      const lowerBound = nextStt ? nextStt.y + 4 : 55;
      const studentItems = items.filter(it => it.y <= stt.y + 4 && it.y > lowerBound);
      const lowestTextY = studentItems.length > 0 ? Math.min(...studentItems.map(it => it.y)) : (stt.y - 20);

      // Exact horizontal row dividing line is 10.4pt below the lowest text
      const rowBottom = Math.round((lowestTextY - 10.4) * 100) / 100;
      const rowTop = i === 0 ? state.tableHeaderBottom : state.detectedStudents[i - 1].rowBottom;

      state.detectedStudents.push({
        num: parseInt(stt.str),
        name: studentName,
        sttY: stt.y,
        rowTop: rowTop,
        rowBottom: rowBottom,
        lowestTextY: lowestTextY
      });
    }

    if (state.detectedStudents.length > 0) {
      state.tableBottom = state.detectedStudents[state.detectedStudents.length - 1].rowBottom;
    } else {
      state.tableBottom = 105.07;
    }

    // Free space between tableBottom and footer (footer ~55pt)
    state.availableSpace = Math.max(0, state.tableBottom - 55);

    // DEFAULT SIGNATURE POSITION: Align neatly under Column 4
    state.sigX = state.tableRight;
    state.sigWidth = 215;
    snapSignatureUnderTable();

    // USER HAS FULL CONTROL: DO NOT FORCE SPLIT!
    state.splitEnabled = false;
    el.toggleSplit.checked = false;
    el.splitOptionsCard.style.display = 'none';

    const sigH = getSignatureBlockHeight();
    if (state.availableSpace >= sigH + 10) {
      el.spaceBanner.className = 'space-status-banner status-success';
      el.bannerText.innerHTML = `<strong>✅ Trang cuối còn ${Math.round(state.availableSpace)}pt trống!</strong><br>` +
        `Khối chữ ký được đặt ngay dưới chân bảng (Y = ${Math.round(state.sigY)}). Bạn có thể bấm giữ và kéo để chỉnh vị trí tùy ý.`;
    } else {
      el.spaceBanner.className = 'space-status-banner status-warning';
      el.bannerText.innerHTML = `<strong>💡 Trang cuối còn ${Math.round(state.availableSpace)}pt trống.</strong><br>` +
        `Khối chữ ký được giữ an toàn ở cuối trang (Y = ${Math.round(state.sigY)}). Nếu muốn bảng thoáng hơn, bạn có thể bật công tắc <em>"Tách hàng sang trang mới"</em> bên dưới.`;
    }

    // Populate split student select
    populateStudentSelect();
    if (state.detectedStudents.length > 0) {
      const defaultSplitIdx = Math.max(1, state.detectedStudents.length - 2);
      state.splitStudentNum = state.detectedStudents[defaultSplitIdx].num;
      el.selectStudentSplit.value = state.splitStudentNum;
      updateCutYFromStudent(state.splitStudentNum);
    }
  }

  function populateStudentSelect() {
    el.selectStudentSplit.innerHTML = '';
    state.detectedStudents.forEach((student, idx) => {
      if (idx > 0) {
        const opt = document.createElement('option');
        opt.value = student.num;
        opt.textContent = `STT ${student.num}: ${student.name}`;
        if (student.num === state.splitStudentNum) {
          opt.selected = true;
        }
        el.selectStudentSplit.appendChild(opt);
      }
    });

    if (state.detectedStudents.length <= 1) {
      const opt = document.createElement('option');
      opt.value = '0';
      opt.textContent = 'Trang chỉ có 1 học sinh (Không cần tách)';
      el.selectStudentSplit.appendChild(opt);
    }
  }

  function updateCutYFromStudent(studentNum) {
    const targetStudent = state.detectedStudents.find(s => s.num === studentNum);
    if (targetStudent) {
      state.splitCutY = targetStudent.rowTop;
    } else {
      state.splitCutY = 292.89;
    }
    el.inputCutY.value = Math.round(state.splitCutY);
    el.valCutY.textContent = `${Math.round(state.splitCutY)} pt`;
    if (state.splitEnabled && state.sigAutoPlaced) {
      snapSignatureUnderTable();
    }
  }

  // --- UPDATE PAGE TABS ---
  function updatePageTabs() {
    el.pageTabs.innerHTML = '';
    const totalPages = state.splitEnabled ? state.numPages + 1 : state.numPages;

    for (let p = 1; p <= totalPages; p++) {
      const btn = document.createElement('button');
      btn.className = 'page-tab-btn';
      if (p === state.currentPage) btn.classList.add('active');

      if (state.splitEnabled && p === totalPages) {
        btn.textContent = `Trang ${p} (Tách Mới)`;
        btn.classList.add('is-new-page');
      } else {
        btn.textContent = `Trang ${p}`;
      }

      btn.addEventListener('click', () => {
        state.currentPage = p;
        updatePageTabs();
        renderCurrentPagePreview();
      });

      el.pageTabs.appendChild(btn);
    }
  }

  // --- LIVE CANVAS PREVIEW RENDERING WITH CONCURRENCY CONTROL ---
  function triggerPreviewRefresh() {
    clearTimeout(renderDebounceTimer);
    renderDebounceTimer = setTimeout(() => {
      renderCurrentPagePreview();
    }, 60);
  }

  async function renderCurrentPagePreview() {
    if (!state.pdfDoc) return;

    if (isRendering) {
      if (currentRenderTask) {
        try { currentRenderTask.cancel(); } catch (e) {}
      }
      pendingRender = true;
      return;
    }

    isRendering = true;
    pendingRender = false;

    const canvas = el.pdfCanvas;
    const ctx = canvas.getContext('2d');
    const scale = state.zoomScale;

    // Clear existing HTML overlays
    clearOverlays();

    const isNewSplitPage = state.splitEnabled && state.currentPage === state.numPages + 1;
    const isOriginalLastPage = state.currentPage === state.numPages;

    try {
      if (!isNewSplitPage) {
        // NORMAL ORIGINAL PAGE
        const page = await state.pdfDoc.getPage(state.currentPage);
        const viewport = page.getViewport({ scale: scale });

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        const renderContext = {
          canvasContext: ctx,
          viewport: viewport
        };

        currentRenderTask = page.render(renderContext);
        await currentRenderTask.promise;

        if (isOriginalLastPage) {
          if (state.splitEnabled) {
            // Splitting is active: cleanly mask moved rows below splitCutY
            const cutCanvasY = viewport.height - (state.splitCutY * scale);
            const bottomCanvasY = viewport.height - (55 * scale);

            // Clean white mask across the entire canvas width to erase text and vertical lines below splitCutY
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(
              0,
              cutCanvasY,
              canvas.width,
              bottomCanvasY - cutCanvasY
            );

            // Draw crisp table closing bottom line matching original line thickness and color
            ctx.strokeStyle = '#0f0f0f';
            ctx.lineWidth = Math.max(1, 0.85 * scale);
            ctx.beginPath();
            ctx.moveTo(state.tableLeft * scale, cutCanvasY);
            ctx.lineTo(state.tableRight * scale, cutCanvasY);
            ctx.stroke();

            // Cut line overlay tag
            createCutLineOverlay(cutCanvasY, `Đường cắt: Chuyển các hàng dưới sang Trang ${state.numPages + 1}`);
          } else {
            // NO split: Signature placed on this last page!
            drawVietnameseSignatureOnCanvas(ctx, scale);
          }
        }
      } else {
        // NEW SPLIT PAGE (PAGE N+1)
        const page = await state.pdfDoc.getPage(state.numPages);
        const viewport = page.getViewport({ scale: scale });

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        // Fill clean white background for new page
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Render original page to an offscreen canvas
        const offCanvas = document.createElement('canvas');
        offCanvas.width = canvas.width;
        offCanvas.height = canvas.height;
        const offCtx = offCanvas.getContext('2d');

        currentRenderTask = page.render({ canvasContext: offCtx, viewport: viewport });
        await currentRenderTask.promise;

        const tableWidth = state.tableRight - state.tableLeft;

        // A. Copy Header (if enabled)
        const headerTopCanvas = viewport.height - (state.tableHeaderTop * scale);
        const headerBottomCanvas = viewport.height - (state.tableHeaderBottom * scale);
        const headerHeightCanvas = headerBottomCanvas - headerTopCanvas;

        if (state.repeatHeader) {
          ctx.drawImage(
            offCanvas,
            (state.tableLeft - 1) * scale,
            headerTopCanvas,
            (tableWidth + 2) * scale,
            headerHeightCanvas,
            (state.tableLeft - 1) * scale,
            headerTopCanvas,
            (tableWidth + 2) * scale,
            headerHeightCanvas
          );
        }

        // B. Copy moved rows
        const cutCanvasY = viewport.height - (state.splitCutY * scale);
        const lastRowBottomCanvas = viewport.height - (state.tableBottom * scale);
        const movedHeightCanvas = Math.max(10, lastRowBottomCanvas - cutCanvasY);

        // Destination on new page: right below header
        const destRowTopCanvas = headerBottomCanvas;
        const destRowBottomCanvas = destRowTopCanvas + movedHeightCanvas;

        ctx.drawImage(
          offCanvas,
          (state.tableLeft - 1) * scale,
          cutCanvasY,
          (tableWidth + 2) * scale,
          movedHeightCanvas,
          (state.tableLeft - 1) * scale,
          destRowTopCanvas,
          (tableWidth + 2) * scale,
          movedHeightCanvas
        );

        // Draw crisp closing bottom line on new split page preview
        ctx.strokeStyle = '#0f0f0f';
        ctx.lineWidth = Math.max(1, 0.85 * scale);
        ctx.beginPath();
        ctx.moveTo(state.tableLeft * scale, destRowBottomCanvas);
        ctx.lineTo(state.tableRight * scale, destRowBottomCanvas);
        ctx.stroke();

        // C. Draw Signature Block
        if (state.sigAutoPlaced) {
          const sigH = getSignatureBlockHeight();
          const autoY = (state.pageHeight - (destRowBottomCanvas / scale)) - 28;
          state.sigY = Math.max(55 + sigH, autoY);
          el.inputSigY.value = Math.round(state.sigY);
          el.valSigY.textContent = `Y = ${Math.round(state.sigY)} pt`;
        }
        drawVietnameseSignatureOnCanvas(ctx, scale);

        // D. Draw Page Number Footer
        if (state.addPageNumber) {
          ctx.font = `${Math.round(11 * scale)}px "Times New Roman", Times, serif`;
          ctx.fillStyle = '#000000';
          ctx.textAlign = 'center';
          ctx.fillText(String(state.numPages + 1), canvas.width / 2, canvas.height - (46 * scale));
        }
      }
    } catch (err) {
      if (err && err.name === 'RenderingCancelledException') {
        // Handled gracefully, pendingRender will fire if needed
      } else {
        console.error('Render error:', err);
      }
    } finally {
      currentRenderTask = null;
      isRendering = false;
      if (pendingRender) {
        renderCurrentPagePreview();
      }
    }
  }

  // --- DRAW SIGNATURE BLOCK ON CANVAS & CREATE DRAGGABLE OVERLAY ---
  function drawVietnameseSignatureOnCanvas(ctx, scale) {
    const blockRightCanvas = state.sigX * scale;
    const blockWidthCanvas = state.sigWidth * scale;
    const blockCenterX = blockRightCanvas - blockWidthCanvas / 2;
    const startYCanvas = (state.pageHeight - state.sigY) * scale;

    ctx.textAlign = 'center';
    let curY = startYCanvas;

    // Date line (Italic)
    ctx.font = `italic ${Math.round(state.fontSizeDate * scale)}px "Times New Roman", Times, serif`;
    ctx.fillStyle = '#000000';
    ctx.fillText(state.dateText, blockCenterX, curY);

    // Title line (Bold)
    curY += (Math.max(16, state.fontSizeTitle * 1.4) * scale);
    ctx.font = `bold ${Math.round(state.fontSizeTitle * scale)}px "Times New Roman", Times, serif`;
    ctx.fillText(state.titleText, blockCenterX, curY);

    // Signature clearance / Image
    curY += ((state.sigClearance || 65) * scale);

    // Name line (Bold)
    ctx.font = `bold ${Math.round(state.fontSizeName * scale)}px "Times New Roman", Times, serif`;
    ctx.fillText(state.nameText, blockCenterX, curY);

    // Calculate total height of signature box
    const totalBoxHeight = (curY - startYCanvas) + (18 * scale);
    const boxTopCanvas = startYCanvas - (state.fontSizeDate * 1.1 * scale);

    // CREATE INTERACTIVE DRAGGABLE OVERLAY BOX
    createInteractiveSignatureOverlay(
      blockRightCanvas - blockWidthCanvas,
      boxTopCanvas,
      blockWidthCanvas,
      totalBoxHeight
    );
  }

  function clearOverlays() {
    const oldOverlays = el.canvasWrapper.querySelectorAll('.overlay-cutline, .overlay-signature-box');
    oldOverlays.forEach(o => o.remove());
  }

  function createCutLineOverlay(topPx, label) {
    const div = document.createElement('div');
    div.className = 'overlay-cutline';
    div.style.top = `${topPx}px`;

    const tag = document.createElement('span');
    tag.className = 'overlay-cutline-tag';
    tag.textContent = label;
    div.appendChild(tag);

    el.canvasWrapper.appendChild(div);
  }

  // --- INTERACTIVE SIGNATURE BOX DRAG & DROP ---
  function createInteractiveSignatureOverlay(leftPx, topPx, widthPx, heightPx) {
    const box = document.createElement('div');
    box.className = 'overlay-signature-box';
    box.id = 'interactive-sig-box';
    box.style.left = `${leftPx}px`;
    box.style.top = `${topPx}px`;
    box.style.width = `${widthPx}px`;
    box.style.height = `${heightPx}px`;

    const tag = document.createElement('span');
    tag.className = 'overlay-signature-tag';
    tag.innerHTML = `<span>✥</span> Khối Ký Tên (Bấm giữ để kéo)`;
    box.appendChild(tag);

    const hint = document.createElement('span');
    hint.className = 'overlay-drag-hint';
    hint.textContent = `Y: ${Math.round(state.sigY)}pt`;
    box.appendChild(hint);

    // Mouse down / Touch start on signature box to begin drag
    box.addEventListener('mousedown', (e) => {
      startDragging(e.clientX, e.clientY);
      e.preventDefault();
    });
    box.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        startDragging(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    el.canvasWrapper.appendChild(box);
  }

  function startDragging(clientX, clientY) {
    state.isDraggingSig = true;
    state.dragStartMouseX = clientX;
    state.dragStartMouseY = clientY;
    state.dragStartSigX = state.sigX;
    state.dragStartSigY = state.sigY;
    state.sigAutoPlaced = false;

    const box = document.getElementById('interactive-sig-box');
    if (box) box.classList.add('dragging');
  }

  function onGlobalMouseMove(e) {
    if (!state.isDraggingSig) return;
    handleDragMove(e.clientX, e.clientY);
  }

  function onGlobalTouchMove(e) {
    if (!state.isDraggingSig) return;
    if (e.touches.length === 1) {
      handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
      e.preventDefault();
    }
  }

  function handleDragMove(clientX, clientY) {
    const dxPx = clientX - state.dragStartMouseX;
    const dyPx = clientY - state.dragStartMouseY;
    const scale = state.zoomScale;

    // Convert pixel delta to PDF points
    const dxPdf = dxPx / scale;
    // Y is inverted in PDF (0 is bottom)
    const dyPdf = -dyPx / scale;

    let newX = state.dragStartSigX + dxPdf;
    let newY = state.dragStartSigY + dyPdf;

    const sigH = getSignatureBlockHeight();
    const minSafeSigY = 55 + sigH;

    // Clamping to page boundaries
    newX = Math.max(state.sigWidth + 20, Math.min(state.pageWidth - 10, newX));
    newY = Math.max(minSafeSigY, Math.min(state.pageHeight - 50, newY));

    state.sigX = newX;
    state.sigY = newY;

    // Update Y slider & label
    el.inputSigY.value = Math.round(newY);
    el.valSigY.textContent = `Y = ${Math.round(newY)} pt`;

    triggerPreviewRefresh();
  }

  function onGlobalMouseUp() {
    if (state.isDraggingSig) {
      state.isDraggingSig = false;
      const box = document.getElementById('interactive-sig-box');
      if (box) box.classList.remove('dragging');
    }
  }

  // --- EXPORT AND DOWNLOAD PDF ---
  async function exportAndDownloadPdf() {
    if (!state.pdfBytes) {
      showToast('Vui lòng tải tệp PDF lên trước khi xuất!', 'error');
      return;
    }

    try {
      showToast('Đang tạo tệp PDF với chữ ký và phông chữ chuẩn...', 'info');

      const PDFLib = window.PDFLib;
      if (!PDFLib) throw new Error('Thư viện PDF-Lib chưa được nạp!');

      const { PDFDocument, rgb, pushGraphicsState, popGraphicsState, rectangle, clip, endPath } = PDFLib;
      
      // Ensure we pass a fresh, non-detached Uint8Array clone to PDFDocument.load
      const rawPdfBytes = new Uint8Array(state.pdfBytes.slice(0));
      const srcDoc = await PDFDocument.load(rawPdfBytes);
      const outDoc = await PDFDocument.create();

      // Register fontkit
      if (window.fontkit) {
        outDoc.registerFontkit(window.fontkit);
      }

      // Load Times New Roman fonts
      let fontRegular, fontBold, fontItalic;
      try {
        if (window.TIMES_NORMAL_B64 && window.TIMES_BOLD_B64 && window.TIMES_ITALIC_B64) {
          const normalBytes = b64ToUint8(window.TIMES_NORMAL_B64);
          const boldBytes = b64ToUint8(window.TIMES_BOLD_B64);
          const italicBytes = b64ToUint8(window.TIMES_ITALIC_B64);

          fontRegular = await outDoc.embedFont(normalBytes);
          fontBold = await outDoc.embedFont(boldBytes);
          fontItalic = await outDoc.embedFont(italicBytes);
        } else {
          // Fallback to standard
          fontRegular = await outDoc.embedFont(PDFLib.StandardFonts.TimesRoman);
          fontBold = await outDoc.embedFont(PDFLib.StandardFonts.TimesRomanBold);
          fontItalic = await outDoc.embedFont(PDFLib.StandardFonts.TimesRomanItalic);
        }
      } catch (fontErr) {
        console.warn('Font embedding notice:', fontErr);
        fontRegular = await outDoc.embedFont(PDFLib.StandardFonts.TimesRoman);
        fontBold = await outDoc.embedFont(PDFLib.StandardFonts.TimesRomanBold);
        fontItalic = await outDoc.embedFont(PDFLib.StandardFonts.TimesRomanItalic);
      }

      // Embed signature image if provided
      let embeddedSigImage = null;
      if (state.sigImageBytes) {
        try {
          const imgBytes = new Uint8Array(state.sigImageBytes.slice(0));
          embeddedSigImage = await outDoc.embedPng(imgBytes);
        } catch (e1) {
          try {
            const imgBytes2 = new Uint8Array(state.sigImageBytes.slice(0));
            embeddedSigImage = await outDoc.embedJpg(imgBytes2);
          } catch (e2) {
            console.error('Signature image embedding failed:', e2);
          }
        }
      }

      const tableLeft = state.tableLeft;
      const tableRight = state.tableRight;
      const tableWidth = tableRight - tableLeft;
      const headerTop = state.tableHeaderTop;
      const headerBottom = state.tableHeaderBottom;

      if (!state.splitEnabled) {
        // CASE 1: NO SPLIT (FIT ON CURRENT LAST PAGE)
        const pages = await outDoc.copyPages(srcDoc, Array.from({ length: state.numPages }, (_, i) => i));
        pages.forEach(p => outDoc.addPage(p));

        const lastPage = outDoc.getPage(state.numPages - 1);
        drawPdfSignatureBlock(lastPage, fontRegular, fontBold, fontItalic, embeddedSigImage, PDFLib);
      } else {
        // CASE 2: TABLE SPLIT
        if (state.numPages > 1) {
          const prevPages = await outDoc.copyPages(srcDoc, Array.from({ length: state.numPages - 1 }, (_, i) => i));
          prevPages.forEach(p => outDoc.addPage(p));
        }

        // Modified Page N
        const [pageN] = await outDoc.copyPages(srcDoc, [state.numPages - 1]);
        outDoc.addPage(pageN);

        // Mask out rows below splitCutY on Page N across full width 0 to pageWidth down to 55pt
        pageN.drawRectangle({
          x: 0,
          y: 55,
          width: state.pageWidth,
          height: state.splitCutY - 55,
          color: rgb(1, 1, 1),
        });

        // Draw clean closing bottom line on Page N matching original table stroke
        pageN.drawLine({
          start: { x: tableLeft, y: state.splitCutY },
          end: { x: tableRight, y: state.splitCutY },
          thickness: 0.85,
          color: rgb(0.058, 0.058, 0.058),
        });

        // New Page N+1
        const [embeddedLast] = await outDoc.embedPdf(srcDoc, [state.numPages - 1]);
        const pageNext = outDoc.addPage([state.pageWidth, state.pageHeight]);

        // A. Repeat Table Header (if enabled)
        if (state.repeatHeader) {
          pageNext.pushOperators(
            pushGraphicsState(),
            rectangle(tableLeft - 1, headerBottom - 0.5, tableWidth + 2, (headerTop - headerBottom) + 1),
            clip(),
            endPath()
          );
          pageNext.drawPage(embeddedLast, { x: 0, y: 0 });
          pageNext.pushOperators(popGraphicsState());
        }

        // B. Draw moved student rows
        const dy = headerBottom - state.splitCutY;
        const movedHeight = state.splitCutY - state.tableBottom;
        const newRowBottom = state.tableBottom + dy;

        pageNext.pushOperators(
          pushGraphicsState(),
          rectangle(tableLeft - 1, newRowBottom - 0.5, tableWidth + 2, movedHeight + 1),
          clip(),
          endPath()
        );
        pageNext.drawPage(embeddedLast, { x: 0, y: dy });
        pageNext.pushOperators(popGraphicsState());

        // Note: The original table already contains its bottom border under the last row,
        // which is shifted to newRowBottom - no duplicate line needed!

        // C. Signature block on new page
        drawPdfSignatureBlock(pageNext, fontRegular, fontBold, fontItalic, embeddedSigImage, PDFLib);

        // D. Page number footer
        if (state.addPageNumber) {
          const pageNumStr = String(state.numPages + 1);
          const wNum = fontRegular.widthOfTextAtSize(pageNumStr, 11);
          pageNext.drawText(pageNumStr, {
            x: state.pageWidth / 2 - wNum / 2,
            y: 45.9,
            size: 11,
            font: fontRegular,
            color: rgb(0, 0, 0),
          });
        }
      }

      // Save and trigger download
      const outBytes = await outDoc.save();
      const blob = new Blob([outBytes], { type: 'application/pdf' });
      const downloadUrl = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = downloadUrl;
      const baseName = state.pdfFileName.replace(/\.pdf$/i, '');
      // Name formatted as requested: "signature_section_added"
      a.download = `${baseName}_signature_section_added.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      showToast('Đã xuất và tải xuống tệp PDF thành công!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Lỗi khi xuất PDF: ' + err.message, 'error');
    }
  }

  function drawPdfSignatureBlock(page, fontRegular, fontBold, fontItalic, sigImage, PDFLib) {
    const { rgb } = PDFLib;
    const blockRight = state.sigX;
    const blockWidth = state.sigWidth;
    const blockCenterX = blockRight - blockWidth / 2;

    let curY = state.sigY;

    // Date (Italic)
    const wDate = fontItalic.widthOfTextAtSize(state.dateText, state.fontSizeDate);
    page.drawText(state.dateText, {
      x: blockCenterX - wDate / 2,
      y: curY,
      size: state.fontSizeDate,
      font: fontItalic,
      color: rgb(0, 0, 0),
    });

    // Title (Bold)
    curY -= Math.max(16, state.fontSizeTitle * 1.4);
    const wTitle = fontBold.widthOfTextAtSize(state.titleText, state.fontSizeTitle);
    page.drawText(state.titleText, {
      x: blockCenterX - wTitle / 2,
      y: curY,
      size: state.fontSizeTitle,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    // Clearance / Image
    if (sigImage) {
      const imgWidth = Math.min(140, sigImage.width);
      const imgHeight = (imgWidth / sigImage.width) * sigImage.height;
      page.drawImage(sigImage, {
        x: blockCenterX - imgWidth / 2,
        y: curY - imgHeight - 10,
        width: imgWidth,
        height: imgHeight,
      });
      curY -= (state.sigClearance || 65);
    } else {
      curY -= (state.sigClearance || 65);
    }

    // Name (Bold)
    const wName = fontBold.widthOfTextAtSize(state.nameText, state.fontSizeName);
    page.drawText(state.nameText, {
      x: blockCenterX - wName / 2,
      y: curY,
      size: state.fontSizeName,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
  }

  // --- TOAST NOTIFICATIONS ---
  function showToast(message, type = 'info') {
    el.toastMsg.textContent = message;
    el.toast.className = 'toast show';
    if (type === 'success') el.toast.classList.add('toast-success');
    if (type === 'error') el.toast.classList.add('toast-error');

    setTimeout(() => {
      el.toast.classList.remove('show');
    }, 3500);
  }

})();
