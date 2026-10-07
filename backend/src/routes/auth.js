const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { signToken, auth } = require('../middleware/auth');
const { validateEmail } = require('../utils/validation');

const router = express.Router();

router.post('/login', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!validateEmail(email) || !password) {
    return res.status(400).json({ error: 'Enter a valid email and password.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }

  const publicUser = { id: user.id, name: user.name, email: user.email, role: user.role };
  res.json({ token: signToken(publicUser), user: publicUser });
});

router.post('/signup', (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (name.length < 2 || name.length > 60 || !validateEmail(email) || password.length < 8) {
    return res.status(400).json({
      error: 'Use a name, a valid email address, and a password of at least 8 characters.',
    });
  }
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
    return res.status(409).json({ error: 'An account with that email already exists.' });
  }

  const passwordHash = bcrypt.hashSync(password, 12);
  const result = db
    .prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'creator')")
    .run(name, email, passwordHash);
  const user = { id: Number(result.lastInsertRowid), name, email, role: 'creator' };
  res.status(201).json({ token: signToken(user), user });
});

router.get('/me', auth(), (req, res) => {
  res.json({ user: req.user });
});

router.get('/users', auth(), (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admins only.' });
  }
  const users = db.prepare('SELECT id, name, email, role, created_at FROM users ORDER BY id').all();
  res.json({ users });
});

module.exports = router;
