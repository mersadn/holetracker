const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'data.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- ابزارهای دیتابیس ساده (فایل JSON روی دیسک) ---
function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ records: [] }, null, 2));
  }
  const raw = fs.readFileSync(DB_FILE, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch {
    return { records: [] };
  }
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// --- API ---

// گرفتن همه رکوردها
app.get('/api/records', (req, res) => {
  const db = readDB();
  res.json(db.records.sort((a, b) => b.id - a.id));
});

// افزودن رکورد جدید
app.post('/api/records', (req, res) => {
  const { customerName, holeNumber, note } = req.body;
  if (!customerName || !holeNumber) {
    return res.status(400).json({ error: 'نام مشتری و شماره سوراخ الزامی است' });
  }
  const db = readDB();
  const newRecord = {
    id: Date.now(),
    customerName: String(customerName).trim(),
    holeNumber: String(holeNumber).trim(),
    note: note ? String(note).trim() : '',
    delivered: false,
    deliveredAt: null,
    createdAt: new Date().toISOString(),
  };
  db.records.push(newRecord);
  writeDB(db);
  res.status(201).json(newRecord);
});

// ویرایش رکورد (شامل تغییر وضعیت تحویل)
app.put('/api/records/:id', (req, res) => {
  const id = Number(req.params.id);
  const { customerName, holeNumber, note, delivered } = req.body;
  const db = readDB();
  const idx = db.records.findIndex(r => r.id === id);
  if (idx === -1) return res.status(404).json({ error: 'رکورد پیدا نشد' });

  const current = db.records[idx];
  const nextDelivered = typeof delivered === 'boolean' ? delivered : current.delivered;

  db.records[idx] = {
    ...current,
    customerName: customerName ?? current.customerName,
    holeNumber: holeNumber ?? current.holeNumber,
    note: note ?? current.note,
    delivered: nextDelivered,
    deliveredAt: nextDelivered !== current.delivered
      ? (nextDelivered ? new Date().toISOString() : null)
      : current.deliveredAt,
  };
  writeDB(db);
  res.json(db.records[idx]);
});

// حذف رکورد
app.delete('/api/records/:id', (req, res) => {
  const id = Number(req.params.id);
  const db = readDB();
  const before = db.records.length;
  db.records = db.records.filter(r => r.id !== id);
  if (db.records.length === before) {
    return res.status(404).json({ error: 'رکورد پیدا نشد' });
  }
  writeDB(db);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`✅ سرور روشن شد → http://localhost:${PORT}`);
});
