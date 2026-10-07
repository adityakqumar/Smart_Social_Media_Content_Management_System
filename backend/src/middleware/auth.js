const jwt = require('jsonwebtoken');
const { db } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'pulse-studio-dev-secret';

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function auth(required = true) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      if (!required) return next();
      return res.status(401).json({ error: 'Sign in required.' });
    }
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(payload.id);
      if (!user) return res.status(401).json({ error: 'Account no longer exists.' });
      req.user = user;
      next();
    } catch {
      return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    }
  };
}

function allow(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission for this action.' });
    }
    next();
  };
}

module.exports = { signToken, auth, allow, JWT_SECRET };
