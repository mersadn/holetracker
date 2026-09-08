const HOLE_MIN = 14;
const HOLE_MAX = 67;

// چیدمان نقشه سوراخ‌ها (لانه‌زنبوری) — دقیقاً منطبق با چیدمان فیزیکی رَک:
// هر ردیف با یک میزان تورفتگی (indent) نسبت به لبه راست جابه‌جا می‌شود تا
// دایره‌ها مثل تصویر مرجع کنار/داخل هم قرار بگیرند.
const RACK_ROWS = [
  { start: 14, end: 18, indent: 0 },
  { start: 19, end: 23, indent: 1 },
  { start: 24, end: 27, indent: 2 },
  { start: 28, end: 32, indent: 0 },
  { start: 33, end: 37, indent: 1 },
  { start: 38, end: 42, indent: 0 },
  { start: 43, end: 47, indent: 1 },
  { start: 48, end: 52, indent: 0 },
  { start: 53, end: 57, indent: 1 },
  { start: 58, end: 62, indent: 0 },
  { start: 63, end: 67, indent: 1 },
];
const INDENT_STEP_PX = 22; // فاصله هر واحد تورفتگی

const form = document.getElementById('recordForm');
const customerNameInput = document.getElementById('customerName');
const holeNumberSelect = document.getElementById('holeNumber');
const noteInput = document.getElementById('note');
const recordsBody = document.getElementById('recordsBody');
const emptyState = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');
const toast = document.getElementById('toast');
const submitBtn = document.getElementById('submitBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const formTitle = document.getElementById('formTitle');
const statTotal = document.getElementById('statTotal');
const statPending = document.getElementById('statPending');
const statDelivered = document.getElementById('statDelivered');
const statFree = document.getElementById('statFree');
const filterTabs = document.querySelectorAll('.tab');
const rackBody = document.getElementById('rackBody');

let allRecords = [];
let editingId = null;
let activeFilter = 'all';
let highlightedHole = null;
let toastTimer = null;

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

function toPersianDigits(str) {
  const fa = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(str).replace(/[0-9]/g, d => fa[d]);
}

async function fetchRecords() {
  const res = await fetch('/api/records');
  allRecords = await res.json();
  populateHoleSelect();
  renderRackMap();
  render();
}

// مجموعه سوراخ‌های در حال استفاده (رکوردهایی که هنوز تحویل داده نشده‌اند)،
// به‌جز سوراخِ رکوردی که در حال ویرایش آن هستیم.
function getOccupiedHoles() {
  return new Set(
    allRecords
      .filter(r => !r.delivered && r.id !== editingId)
      .map(r => String(r.holeNumber))
  );
}

// شماره‌های ۱۴ تا ۶۷ را در انتخاب‌گر می‌سازد و سوراخ‌های اشغال را غیرفعال می‌کند.
function populateHoleSelect() {
  const occupied = getOccupiedHoles();

  const previousValue = holeNumberSelect.value;
  holeNumberSelect.innerHTML = '';

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'انتخاب شماره سوراخ...';
  placeholder.disabled = true;
  placeholder.selected = true;
  holeNumberSelect.appendChild(placeholder);

  for (let n = HOLE_MIN; n <= HOLE_MAX; n++) {
    const opt = document.createElement('option');
    opt.value = String(n);
    const isOccupied = occupied.has(String(n));
    opt.textContent = isOccupied
      ? `${toPersianDigits(n)} (در حال استفاده)`
      : toPersianDigits(n);
    opt.disabled = isOccupied;
    holeNumberSelect.appendChild(opt);
  }

  if (previousValue && [...holeNumberSelect.options].some(o => o.value === previousValue)) {
    holeNumberSelect.value = previousValue;
  }
}

// نقشه لانه‌زنبوریِ سوراخ‌ها را می‌سازد (کنار فرم، بدون اسکرول کل صفحه).
function renderRackMap() {
  const occupied = getOccupiedHoles();
  const selectedValue = holeNumberSelect.value;

  rackBody.innerHTML = '';
  RACK_ROWS.forEach(row => {
    const rowEl = document.createElement('div');
    rowEl.className = 'rack-row';
    rowEl.style.marginInlineStart = `${row.indent * INDENT_STEP_PX}px`;

    for (let n = row.start; n <= row.end; n++) {
      const isOccupied = occupied.has(String(n));
      const holeEl = document.createElement('button');
      holeEl.type = 'button';
      holeEl.className = 'rack-hole' + (isOccupied ? ' occupied' : '') +
        (selectedValue === String(n) ? ' selected' : '');
      holeEl.textContent = toPersianDigits(n);
      holeEl.title = isOccupied
        ? (allRecords.find(r => !r.delivered && String(r.holeNumber) === String(n))?.customerName || 'اشغال')
        : 'آزاد — برای انتخاب کلیک کنید';
      holeEl.addEventListener('click', () => onRackHoleClick(n, isOccupied));
      rowEl.appendChild(holeEl);
    }
    rackBody.appendChild(rowEl);
  });
}

function onRackHoleClick(n, isOccupied) {
  if (isOccupied) {
    const record = allRecords.find(r => !r.delivered && String(r.holeNumber) === String(n));
    showToast(record ? `سوراخ ${toPersianDigits(n)} — مشتری: ${record.customerName}` : `سوراخ ${toPersianDigits(n)} اشغال است`);
    return;
  }
  if (holeNumberSelect.querySelector(`option[value="${n}"]`)) {
    holeNumberSelect.value = String(n);
    renderRackMap();
    customerNameInput.focus();
  }
}

function render() {
  const query = searchInput.value.trim().toLowerCase();

  let filtered = allRecords.filter(r =>
    r.customerName.toLowerCase().includes(query) ||
    String(r.holeNumber).toLowerCase().includes(query)
  );

  if (activeFilter === 'pending') filtered = filtered.filter(r => !r.delivered);
  if (activeFilter === 'delivered') filtered = filtered.filter(r => r.delivered);

  const total = allRecords.length;
  const deliveredCount = allRecords.filter(r => r.delivered).length;
  const occupiedCount = getOccupiedHoles().size;
  const totalHoles = HOLE_MAX - HOLE_MIN + 1;
  statTotal.textContent = toPersianDigits(total);
  statDelivered.textContent = toPersianDigits(deliveredCount);
  statPending.textContent = toPersianDigits(total - deliveredCount);
  statFree.textContent = toPersianDigits(totalHoles - occupiedCount);

  if (filtered.length === 0) {
    recordsBody.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';

  recordsBody.innerHTML = filtered.map(r => `
    <tr class="${r.delivered ? 'delivered' : ''} ${highlightedHole === String(r.holeNumber) ? 'highlight' : ''}">
      <td><span class="customer-name">${escapeHtml(r.customerName)}</span></td>
      <td>
        <span class="hole-badge ${r.delivered ? 'is-delivered' : ''}" title="برای تغییر وضعیت کلیک کنید" onclick="toggleDelivered(${r.id})">
          ${r.delivered ? '✓ ' : ''}${escapeHtml(toPersianDigits(r.holeNumber))}
        </span>
      </td>
      <td><span class="status-text ${r.delivered ? 'done' : ''}">${r.delivered ? 'تحویل داده شد' : 'در انتظار'}</span></td>
      <td><span class="note-text">${escapeHtml(r.note || '—')}</span></td>
      <td>
        <div class="row-actions">
          <button class="icon-btn" title="ویرایش" onclick="startEdit(${r.id})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
          </button>
          <button class="icon-btn danger" title="حذف" onclick="deleteRecord(${r.id})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    customerName: customerNameInput.value.trim(),
    holeNumber: holeNumberSelect.value.trim(),
    note: noteInput.value.trim(),
  };
  if (!payload.customerName || !payload.holeNumber) return;

  if (editingId) {
    await fetch(`/api/records/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    showToast('رکورد ویرایش شد ✅');
    resetFormState();
  } else {
    await fetch('/api/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    showToast('رکورد ثبت شد ✅');
    form.reset();
  }

  await fetchRecords();
});

function resetFormState() {
  editingId = null;
  form.reset();
  submitBtn.textContent = 'افزودن رکورد';
  formTitle.textContent = 'افزودن رکورد جدید';
  cancelEditBtn.style.display = 'none';
}

cancelEditBtn.addEventListener('click', async () => {
  resetFormState();
  await fetchRecords();
});

window.startEdit = function (id) {
  const record = allRecords.find(r => r.id === id);
  if (!record) return;
  editingId = id;
  populateHoleSelect();
  customerNameInput.value = record.customerName;
  holeNumberSelect.value = String(record.holeNumber);
  noteInput.value = record.note || '';
  submitBtn.textContent = 'ذخیره تغییرات';
  formTitle.textContent = 'ویرایش رکورد';
  cancelEditBtn.style.display = 'block';
  renderRackMap();
  customerNameInput.focus();
};

window.deleteRecord = async function (id) {
  if (!confirm('آیا از حذف این رکورد مطمئن هستید؟')) return;
  await fetch(`/api/records/${id}`, { method: 'DELETE' });
  showToast('رکورد حذف شد 🗑️');
  if (editingId === id) resetFormState();
  await fetchRecords();
};

// کلیک روی برچسب شماره سوراخ: تغییر وضعیت بین «در انتظار» و «تحویل داده شد»
window.toggleDelivered = async function (id) {
  const record = allRecords.find(r => r.id === id);
  if (!record) return;
  const nextDelivered = !record.delivered;
  await fetch(`/api/records/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ delivered: nextDelivered }),
  });
  showToast(nextDelivered ? 'به مشتری تحویل داده شد ✅' : 'به حالت «در انتظار» بازگشت ↩️');
  await fetchRecords();
};

filterTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    filterTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    activeFilter = tab.dataset.filter;
    render();
  });
});

searchInput.addEventListener('input', render);
holeNumberSelect.addEventListener('change', renderRackMap);

populateHoleSelect();
renderRackMap();
fetchRecords();

// قابلیت نصب روی دسکتاپ (PWA) — قبلاً فایل‌های manifest/sw خارج از پوشه public
// بودند و سرور اصلاً آن‌ها را سرو نمی‌کرد، به همین دلیل گزینه «نصب» ظاهر نمی‌شد.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
