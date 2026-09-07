const form = document.getElementById('recordForm');
const customerNameInput = document.getElementById('customerName');
const holeNumberInput = document.getElementById('holeNumber');
const noteInput = document.getElementById('note');
const recordsBody = document.getElementById('recordsBody');
const emptyState = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');
const toast = document.getElementById('toast');
const countPill = document.getElementById('countPill');
const submitBtn = document.getElementById('submitBtn');

let allRecords = [];
let editingId = null;

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

function toPersianDigits(str) {
  const fa = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
  return String(str).replace(/[0-9]/g, d => fa[d]);
}

async function fetchRecords() {
  const res = await fetch('/api/records');
  allRecords = await res.json();
  render();
}

function render() {
  const query = searchInput.value.trim().toLowerCase();
  const filtered = allRecords.filter(r =>
    r.customerName.toLowerCase().includes(query) ||
    r.holeNumber.toLowerCase().includes(query)
  );

  countPill.textContent = toPersianDigits(allRecords.length);

  if (filtered.length === 0) {
    recordsBody.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';

  recordsBody.innerHTML = filtered.map(r => `
    <tr>
      <td>${escapeHtml(r.customerName)}</td>
      <td><span class="hole-badge">${escapeHtml(r.holeNumber)}</span></td>
      <td><span class="note-text">${escapeHtml(r.note || '—')}</span></td>
      <td>
        <div class="row-actions">
          <button class="icon-btn" title="ویرایش" onclick="startEdit(${r.id})">✏️</button>
          <button class="icon-btn danger" title="حذف" onclick="deleteRecord(${r.id})">🗑️</button>
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
    holeNumber: holeNumberInput.value.trim(),
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
    editingId = null;
    submitBtn.textContent = 'افزودن رکورد';
  } else {
    await fetch('/api/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    showToast('رکورد ثبت شد ✅');
  }

  form.reset();
  await fetchRecords();
});

window.startEdit = function (id) {
  const record = allRecords.find(r => r.id === id);
  if (!record) return;
  customerNameInput.value = record.customerName;
  holeNumberInput.value = record.holeNumber;
  noteInput.value = record.note || '';
  editingId = id;
  submitBtn.textContent = 'ذخیره تغییرات';
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.deleteRecord = async function (id) {
  if (!confirm('آیا از حذف این رکورد مطمئن هستید؟')) return;
  await fetch(`/api/records/${id}`, { method: 'DELETE' });
  showToast('رکورد حذف شد 🗑️');
  await fetchRecords();
};

searchInput.addEventListener('input', render);

fetchRecords();
