(() => {
  "use strict";

  /* ============================================================
     Constants & helpers
  ============================================================ */
  // ترتیب دقیق سوراخ ها طبق نقشه
  const HOLE_LAYOUT = [
    [13, 16, 17, 14, 18],
    [19, 20, 21, 22, 23],
    [24, 25, 26, 27],
    [28, 29, 30, 31, 32],
    [33, 34, 35, 36, 37],
    [38, 39, 40, 41, 42],
    [43, 44, 45, 46, 47],
    [48, 49, 50, 51, 52],
    [53, 54, 55, 56, 57],
    [58, 59, 60, 61, 62],
    [63, 64, 65, 66, 67]
  ];
  const HOLE_START = 14;
  const HOLE_END = 67;
  const DB_KEY = "dtf_tracker_db_v1";
  const BACKUP_PATH_KEY = "dtf_backup_path_v1";
  const BACKUP_UPLOADS_PATH_KEY = "dtf_backup_uploads_path_v1";

  const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
  const toFa = (n) => String(n).replace(/[0-9]/g, (d) => FA_DIGITS[d]);
  const toEn = (s) => String(s).replace(/[۰-۹]/g, (d) => FA_DIGITS.indexOf(d));

  const $ = (sel) => document.querySelector(sel);
  const el = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };
  const uid = () => `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  function faDate(iso) {
    try {
      return toFa(new Intl.DateTimeFormat("fa-IR", { month: "2-digit", day: "2-digit" }).format(new Date(iso)));
    } catch (e) { return ""; }
  }

  function normalize(str) {
    return toEn(String(str || "")).trim().toLowerCase().replace(/[يى]/g, "ی").replace(/ك/g, "ک");
  }

  /* ============================================================
     Persistence
  ============================================================ */
  function emptyDb() {
    return { version: 1, updatedAt: new Date().toISOString(), records: [] };
  }

  function loadDb() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (!raw) return emptyDb();
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.records)) return emptyDb();
      return parsed;
    } catch (e) {
      console.error("Failed to load DB", e);
      return emptyDb();
    }
  }

  function saveDb() {
    db.updatedAt = new Date().toISOString();
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    render();
  }

  let db = loadDb();
  let searchQuery = "";
  let matchedHoleSet = new Set();
  let selectedHoleForForm = null;

  /* ============================================================
     Derived state
  ============================================================ */
  function occupiedHoleMap() {
    // hole number -> active (waiting) record
    const map = new Map();
    for (const r of db.records) {
      if (r.status === "waiting") map.set(r.hole, r);
    }
    return map;
  }

  function allHoleNumbers() {
    return HOLE_LAYOUT.flat();
  }

  function availableHoles() {
    const occ = occupiedHoleMap();
    return allHoleNumbers().filter((n) => !occ.has(n));
  }

  /* ============================================================
     Toast & modal
  ============================================================ */
  let toastTimer = null;
  function toast(msg, kind = "") {
    const t = $("#toast");
    t.textContent = msg;
    t.className = "toast show" + (kind ? " " + kind : "");
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.classList.remove("show"); }, 2600);
  }

  function confirmDialog(text) {
    return new Promise((resolve) => {
      const overlay = $("#confirmModal");
      $("#confirmText").textContent = text;
      overlay.hidden = false;
      const onCancel = () => { cleanup(); resolve(false); };
      const onOk = () => { cleanup(); resolve(true); };
      function cleanup() {
        overlay.hidden = true;
        $("#confirmCancel").removeEventListener("click", onCancel);
        $("#confirmOk").removeEventListener("click", onOk);
      }
      $("#confirmCancel").addEventListener("click", onCancel);
      $("#confirmOk").addEventListener("click", onOk);
    });
  }

  /* ============================================================
     Render: stats
  ============================================================ */
  function renderStats() {
    const total = HOLE_END - HOLE_START + 1;
    const filled = occupiedHoleMap().size;
    const empty = total - filled;
    const pct = total ? Math.round((filled / total) * 100) : 0;
    $("#statTotal").textContent = toFa(total);
    $("#statEmpty").textContent = toFa(empty);
    $("#statFilled").textContent = toFa(filled);
    $("#statPercent").textContent = `٪${toFa(pct)}`;
  }

  /* ============================================================
     Render: hole map
  ============================================================ */
  function renderMap() {
    const container = $("#holeMap");
    container.innerHTML = "";
    const occ = occupiedHoleMap();

    HOLE_LAYOUT.forEach((rowHoles, rowIdx) => {
      const row = el("div", "hole-row" + (rowIdx % 2 === 1 ? " offset" : ""));
      rowHoles.forEach((n) => {
        const rec = occ.get(n);
        const btn = el("button", "hole");
        btn.type = "button";
        btn.dataset.hole = n;

        if (rec) btn.classList.add("is-filled");
        if (matchedHoleSet.has(n)) btn.classList.add("is-match");
        if (selectedHoleForForm === n && !rec) btn.classList.add("is-selected");

        btn.innerHTML = `${toFa(n)}<span class="hole-tip">${rec ? "پر — " + escapeHtml(rec.customer) : "آزاد — کلیک برای انتخاب"}</span>`;

        btn.addEventListener("click", () => onHoleClick(n, rec));
        row.appendChild(btn);
      });
      container.appendChild(row);
    });
  }

  function onHoleClick(n, rec) {
    if (rec) {
      toast(`سوراخ ${toFa(n)} در حال حاضر برای «${rec.customer}» رزرو است`, "error");
      return;
    }
    selectedHoleForForm = n;
    $("#holeSelect").value = String(n);
    $("#customerName").focus();
    renderMap();
  }

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /* ============================================================
     Render: hole select (form dropdown)
  ============================================================ */
  function renderHoleSelect() {
    const sel = $("#holeSelect");
    const current = sel.value;
    sel.innerHTML = `<option value="" disabled>انتخاب شماره سوراخ...</option>`;
    availableHoles().forEach((n) => {
      const opt = el("option");
      opt.value = String(n);
      opt.textContent = `سوراخ شماره ${toFa(n)}`;
      sel.appendChild(opt);
    });
    if (selectedHoleForForm && availableHoles().includes(selectedHoleForForm)) {
      sel.value = String(selectedHoleForForm);
    } else if (current && availableHoles().includes(Number(current))) {
      sel.value = current;
    } else {
      sel.selectedIndex = 0;
      selectedHoleForForm = null;
    }
  }

  /* ============================================================
     Render: list
  ============================================================ */
  function renderList() {
    const body = $("#listBody");
    body.innerHTML = "";
    const records = [...db.records].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    $("#listCount").textContent = `${toFa(records.length)} رکورد`;
    $("#listEmpty").hidden = records.length !== 0;

    records.forEach((r, idx) => {
      const tr = el("tr");
      if (matchedHoleSet.has(r.hole) && r.status === "waiting") tr.classList.add("row-match");

      const delivered = r.status === "delivered";
      tr.innerHTML = `
        <td class="row-idx">${toFa(records.length - idx)}</td>
        <td>
          <span class="row-name">${escapeHtml(r.customer)}</span>
          ${r.notes ? `<span class="row-notes">${escapeHtml(r.notes)}</span>` : ""}
        </td>
        <td><span class="hole-badge ${delivered ? "delivered" : ""}">${toFa(r.hole)}</span></td>
        <td>
          <span class="status-pill ${delivered ? "delivered" : ""}"><i></i>${delivered ? "تحویل شده" : "در انتظار"}</span>
        </td>
        <td class="row-date">${faDate(r.createdAt)}</td>
        <td>
          <button class="deliver-btn ${delivered ? "is-delivered" : ""}" data-id="${r.id}" title="${delivered ? "بازگرداندن به «در انتظار»" : "ثبت تحویل و آزاد کردن سوراخ"}">
            ${delivered
              ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5"/></svg> در انتظار`
              : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg> تحویل داده شد`}
          </button>
        </td>
      `;
      body.appendChild(tr);
    });

    body.querySelectorAll(".deliver-btn").forEach((b) => b.addEventListener("click", () => toggleDelivery(b.dataset.id)));
  }

  function toggleDelivery(id) {
    const rec = db.records.find((r) => r.id === id);
    if (!rec) return;
    if (rec.status === "waiting") {
      // حذف خودکار سفارش تحویل شده
      const idx = db.records.indexOf(rec);
      if (idx !== -1) {
        const customer = rec.customer;
        const hole = rec.hole;
        db.records.splice(idx, 1);
        toast(`رول «${customer}» تحویل داده شد و حذف گردید، سوراخ ${toFa(hole)} آزاد شد`, "success");
      }
    } else {
      const occ = occupiedHoleMap();
      if (occ.has(rec.hole)) {
        toast(`سوراخ ${toFa(rec.hole)} توسط رکورد دیگری اشغال شده و نمی‌توان برگرداند`, "error");
        return;
      }
      rec.status = "waiting";
      rec.deliveredAt = null;
      toast(`رکورد «${rec.customer}» به «در انتظار» برگشت`, "");
    }
    saveDb();
  }

  /* ============================================================
     Add form
  ============================================================ */
  $("#addForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("#customerName").value.trim();
    const holeVal = $("#holeSelect").value;
    const notes = $("#notesInput").value.trim();

    if (!name) { toast("نام مشتری را وارد کنید", "error"); return; }
    if (!holeVal) { toast("یک شماره سوراخ انتخاب کنید", "error"); return; }
    const hole = Number(holeVal);
    if (!availableHoles().includes(hole)) { toast("این سوراخ دیگر آزاد نیست، شماره دیگری انتخاب کنید", "error"); return; }

    db.records.push({
      id: uid(),
      customer: name,
      hole,
      notes,
      status: "waiting",
      createdAt: new Date().toISOString(),
      deliveredAt: null,
    });

    toast(`رول «${name}» در سوراخ ${toFa(hole)} ثبت شد`, "success");

    $("#addForm").reset();
    selectedHoleForForm = null;
    saveDb();
  });

  /* ============================================================
     Search
  ============================================================ */
  const searchInput = $("#searchInput");
  const searchResults = $("#searchResults");
  const searchClear = $("#searchClear");

  function computeMatches(query) {
    const q = normalize(query);
    if (!q) return [];
    const qNum = /^[0-9]+$/.test(toEn(query)) ? Number(toEn(query)) : null;

    return db.records
      .filter((r) => r.status === "waiting")
      .filter((r) => {
        const name = normalize(r.customer);
        if (name.startsWith(q) || name.includes(q)) return true;
        if (qNum !== null && r.hole === qNum) return true;
        return false;
      })
      .sort((a, b) => normalize(a.customer).indexOf(q) - normalize(b.customer).indexOf(q));
  }

  function updateSearch(query, { keepOpen = true } = {}) {
    searchQuery = query;
    searchClear.hidden = !query;
    const matches = computeMatches(query);
    matchedHoleSet = new Set(matches.map((m) => m.hole));

    if (!query) {
      searchResults.hidden = true;
      matchedHoleSet = new Set();
    } else if (keepOpen) {
      renderSearchDropdown(matches, query);
    }
    renderMap();
    renderList();
  }

  function renderSearchDropdown(matches, query) {
    searchResults.innerHTML = "";
    if (matches.length === 0) {
      const d = el("div", "search-empty");
      d.textContent = "موردی با این مشخصات پیدا نشد";
      searchResults.appendChild(d);
      searchResults.hidden = false;
      return;
    }
    matches.slice(0, 8).forEach((r) => {
      const item = el("div", "search-result-item");
      item.innerHTML = `
        <span class="search-result-name">${escapeHtml(r.customer)}</span>
        <span class="search-result-meta">در انتظار <span class="search-result-badge">${toFa(r.hole)}</span></span>
      `;
      item.addEventListener("click", () => {
        searchInput.value = r.customer;
        updateSearch(r.customer, { keepOpen: false });
        searchResults.hidden = true;
        flashHole(r.hole);
      });
      searchResults.appendChild(item);
    });
    searchResults.hidden = false;
  }

  function flashHole(n) {
    const btn = document.querySelector(`.hole[data-hole="${n}"]`);
    if (btn) btn.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  searchInput.addEventListener("input", (e) => updateSearch(e.target.value));
  searchInput.addEventListener("focus", () => { if (searchQuery) searchResults.hidden = false; });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-wrap")) searchResults.hidden = true;
  });
  searchClear.addEventListener("click", () => {
    searchInput.value = "";
    updateSearch("");
    searchInput.focus();
  });

  /* ============================================================
     Export / Import database
  ============================================================ */
  $("#btnExport").addEventListener("click", () => {
    const data = JSON.stringify(db, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = el("a");
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
    a.href = url;
    a.download = `dtf-database-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast("فایل پشتیبان دیتابیس دانلود شد", "success");
  });

  $("#btnImport").addEventListener("click", () => $("#fileImport").click());

  $("#fileImport").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || !Array.isArray(parsed.records)) throw new Error("invalid");

      const ok = await confirmDialog(`دیتابیس فعلی با ${toFa(parsed.records.length)} رکورد از فایل جایگزین شود؟ اطلاعات فعلی از بین می‌رود (پیشنهاد می‌شود ابتدا خروجی بگیرید).`);
      if (!ok) { e.target.value = ""; return; }

      db = { version: 1, updatedAt: new Date().toISOString(), records: parsed.records };
      selectedHoleForForm = null;
      matchedHoleSet = new Set();
      searchInput.value = "";
      searchQuery = "";
      saveDb();
      toast("دیتابیس با موفقیت بازیابی شد", "success");
    } catch (err) {
      console.error(err);
      toast("فایل انتخاب‌شده معتبر نیست", "error");
    } finally {
      e.target.value = "";
    }
  });

  /* ============================================================
     PWA install
  ============================================================ */
  let deferredPrompt = null;
  const installBtn = $("#btnInstall");

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.hidden = false;
  });

  installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") toast("برنامه روی سیستم نصب شد", "success");
    deferredPrompt = null;
    installBtn.hidden = true;
  });

  window.addEventListener("appinstalled", () => { installBtn.hidden = true; });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch((err) => console.error("SW registration failed", err));
    });
  }

  /* ============================================================
     Settings & Backup Management
  ============================================================ */
  const settingsModal = el("div", "modal-overlay");
  settingsModal.id = "settingsModal";
  settingsModal.innerHTML = `
    <div class="modal-box settings-box">
      <div class="settings-header">
        <h2>تنظیمات و بک‌آپ</h2>
        <button class="close-btn" id="closeSettings">✕</button>
      </div>
      <div class="settings-content">
        <div class="settings-section">
          <h3>مسیر ذخیره بک‌آپ</h3>
          <p class="settings-help">مسیری که فایل های بک‌آپ در آن ذخیره می‌شوند:</p>
          <div class="settings-input-group">
            <input type="text" id="backupPathInput" placeholder="مثال: C:\\Backups یا /home/user/backups" class="settings-input">
            <button id="saveBackupPath" class="ghost-btn">ذخیره</button>
          </div>
          <span id="currentBackupPath" class="settings-info"></span>
        </div>

        <div class="settings-section">
          <h3>مسیر آپلود بک‌آپ</h3>
          <p class="settings-help">مسیری که فایل های بک‌آپ از آنجا بارگذاری می‌شوند:</p>
          <div class="settings-input-group">
            <input type="text" id="uploadPathInput" placeholder="مثال: C:\\BackupFiles یا /home/user/backup-files" class="settings-input">
            <button id="saveUploadPath" class="ghost-btn">ذخیره</button>
          </div>
          <span id="currentUploadPath" class="settings-info"></span>
        </div>

        <div class="settings-divider"></div>

        <div class="settings-section">
          <h3>عملیات بک‌آپ</h3>
          <div class="settings-buttons">
            <button id="btnBackupNow" class="action-btn backup-btn">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>
              ایجاد بک‌آپ جدید
            </button>
            <button id="btnUploadBackup" class="action-btn upload-btn">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21V9m0 0-4 4m4-4 4 4M4 7V4a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v3"/></svg>
              بارگذاری بک‌آپ
            </button>
            <button id="btnRestoreBackup" class="action-btn restore-btn">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5"/></svg>
              بازیابی بک‌آپ
            </button>
          </div>
        </div>

        <div class="settings-divider"></div>

        <div class="settings-section">
          <h3>اطلاعات سیستم</h3>
          <div class="settings-info-list">
            <div class="info-item">
              <span class="info-label">کل رکوردها:</span>
              <span class="info-value" id="settingsRecordCount">۰</span>
            </div>
            <div class="info-item">
              <span class="info-label">آخرین به‌روزرسانی:</span>
              <span class="info-value" id="settingsLastUpdate">-</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(settingsModal);

  function loadSettingsUI() {
    const backupPath = localStorage.getItem(BACKUP_PATH_KEY) || "";
    const uploadPath = localStorage.getItem(BACKUP_UPLOADS_PATH_KEY) || "";
    $("#backupPathInput").value = backupPath;
    $("#uploadPathInput").value = uploadPath;
    $("#currentBackupPath").textContent = backupPath ? `مسیر فعلی: ${backupPath}` : "مسیری تعیین نشده است";
    $("#currentUploadPath").textContent = uploadPath ? `مسیر فعلی: ${uploadPath}` : "مسیری تعیین نشده است";
    $("#settingsRecordCount").textContent = toFa(db.records.length);
    $("#settingsLastUpdate").textContent = faDate(db.updatedAt) || "-";
  }

  function openSettings() {
    loadSettingsUI();
    settingsModal.hidden = false;
  }

  function closeSettings() {
    settingsModal.hidden = true;
  }

  $("#btnSettings").addEventListener("click", openSettings);
  $("#closeSettings").addEventListener("click", closeSettings);
  settingsModal.addEventListener("click", (e) => {
    if (e.target === settingsModal) closeSettings();
  });

  // ذخیره مسیرها
  $("#saveBackupPath").addEventListener("click", () => {
    const path = $("#backupPathInput").value.trim();
    localStorage.setItem(BACKUP_PATH_KEY, path);
    toast(path ? "مسیر بک‌آپ ذخیره شد" : "مسیر پاک شد", "success");
    loadSettingsUI();
  });

  $("#saveUploadPath").addEventListener("click", () => {
    const path = $("#uploadPathInput").value.trim();
    localStorage.setItem(BACKUP_UPLOADS_PATH_KEY, path);
    toast(path ? "مسیر آپلود ذخیره شد" : "مسیر پاک شد", "success");
    loadSettingsUI();
  });

  // ایجاد بک‌آپ جدید
  $("#btnBackupNow").addEventListener("click", () => {
    const data = JSON.stringify(db, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = el("a");
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
    const fileName = `dtf-backup-${stamp}.json`;
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast("فایل بک‌آپ دانلود شد", "success");
    loadSettingsUI();
  });

  // بارگذاری بک‌آپ
  const fileBackupInput = el("input");
  fileBackupInput.type = "file";
  fileBackupInput.accept = "application/json";
  fileBackupInput.style.display = "none";
  document.body.appendChild(fileBackupInput);

  $("#btnUploadBackup").addEventListener("click", () => {
    fileBackupInput.click();
  });

  fileBackupInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || !Array.isArray(parsed.records)) throw new Error("invalid");

      const ok = await confirmDialog(`دیتابیس فعلی با ${toFa(parsed.records.length)} رکورد از بک‌آپ جایگزین شود؟`);
      if (!ok) { e.target.value = ""; return; }

      db = { version: 1, updatedAt: new Date().toISOString(), records: parsed.records };
      selectedHoleForForm = null;
      matchedHoleSet = new Set();
      searchInput.value = "";
      searchQuery = "";
      saveDb();
      toast("دیتابیس با بک‌آپ بازیابی شد", "success");
      loadSettingsUI();
    } catch (err) {
      console.error(err);
      toast("فایل انتخاب‌شده معتبر نیست", "error");
    } finally {
      e.target.value = "";
    }
  });

  // بازیابی بک‌آپ (فیلتر شده)
  $("#btnRestoreBackup").addEventListener("click", () => {
    // این دکمه برای انتخاب از بک‌آپ های قبلی است
    toast("این قابلیت نیاز به سیستم فایل دارد", "info");
  });

  /* ============================================================
     Master render
  ============================================================ */
  function render() {
    renderStats();
    renderMap();
    renderHoleSelect();
    renderList();
  }

  render();
})();
