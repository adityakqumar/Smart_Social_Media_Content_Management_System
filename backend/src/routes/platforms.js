const express = require('express');
const { db } = require('../db');
const { auth, allow } = require('../middleware/auth');
const { isNonEmpty } = require('../utils/validation');

const router = express.Router();

router.get('/', auth(), (_req, res) => {
  const platforms = db
    .prepare('SELECT * FROM platforms ORDER BY is_active DESC, name ASC')
    .all();
  res.json({ platforms });
});

router.post('/', auth(), allow('admin'), (req, res) => {
  const name = String(req.body.name || '').trim();
  const slug = String(req.body.slug || name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const accent = String(req.body.accent || '#d8ff4a').trim();
  const icon = String(req.body.icon || 'globe').trim();

  if (!isNonEmpty(name, 40) || !isNonEmpty(slug, 40)) {
    return res.status(400).json({ error: 'Platform name is required.' });
  }

  try {
    const info = db
      .prepare('INSERT INTO platforms (name, slug, accent, icon, is_active) VALUES (?, ?, ?, ?, 1)')
      .run(name, slug, accent, icon);
    const platform = db.prepare('SELECT * FROM platforms WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ platform });
  } catch {
    res.status(409).json({ error: 'A platform with that name already exists.' });
  }
});

router.put('/:id', auth(), allow('admin'), (req, res) => {
  const platform = db.prepare('SELECT * FROM platforms WHERE id = ?').get(req.params.id);
  if (!platform) return res.status(404).json({ error: 'Platform not found.' });

  const name = req.body.name !== undefined ? String(req.body.name).trim() : platform.name;
  const accent = req.body.accent !== undefined ? String(req.body.accent).trim() : platform.accent;
  const icon = req.body.icon !== undefined ? String(req.body.icon).trim() : platform.icon;
  const is_active =
    req.body.is_active !== undefined ? (req.body.is_active ? 1 : 0) : platform.is_active;

  if (!isNonEmpty(name, 40)) return res.status(400).json({ error: 'Platform name is required.' });

  try {
    db.prepare(
      `UPDATE platforms SET name = ?, accent = ?, icon = ?, is_active = ? WHERE id = ?`
    ).run(name, accent, icon, is_active, platform.id);
  } catch {
    return res.status(409).json({ error: 'A platform with that name already exists.' });
  }

  res.json({ platform: db.prepare('SELECT * FROM platforms WHERE id = ?').get(platform.id) });
});

module.exports = router;
