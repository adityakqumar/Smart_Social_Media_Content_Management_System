const express = require('express');
const { db, logPost } = require('../db');
const { auth, allow } = require('../middleware/auth');
const { validatePostBody, parseDateTime, toSqlDateTime } = require('../utils/validation');
const { generateCaption } = require('../captions');
const { publishDuePosts } = require('../engine');

const router = express.Router();

function attachMeta(post) {
  const schedule = db
    .prepare(
      `SELECT sp.*, p.name AS platform_name, p.slug AS platform_slug, p.accent AS platform_accent
       FROM scheduled_posts sp
       JOIN platforms p ON p.id = sp.platform_id
       WHERE sp.post_id = ?
       ORDER BY sp.scheduled_at DESC`
    )
    .all(post.id);
  const engagement = db
    .prepare('SELECT likes, comments, shares FROM engagements WHERE post_id = ?')
    .get(post.id) || { likes: 0, comments: 0, shares: 0 };
  const author = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(post.user_id);
  return { ...post, author, schedule, engagement };
}

function canMutate(user, post) {
  if (user.role === 'admin') return true;
  return post.user_id === user.id;
}

router.get('/', auth(), (req, res) => {
  const { status, platform, q } = req.query;
  let sql = `
    SELECT DISTINCT posts.*
    FROM posts
    LEFT JOIN scheduled_posts sp ON sp.post_id = posts.id
    WHERE 1=1
  `;
  const params = [];

  if (req.user.role === 'creator') {
    sql += ' AND posts.user_id = ?';
    params.push(req.user.id);
  }
  if (status) {
    sql += ' AND posts.status = ?';
    params.push(status);
  }
  if (platform) {
    sql += ' AND sp.platform_id = ?';
    params.push(Number(platform));
  }
  if (q) {
    sql += ' AND (posts.title LIKE ? OR posts.content LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }
  sql += ' ORDER BY datetime(posts.updated_at) DESC';

  const posts = db.prepare(sql).all(...params).map(attachMeta);
  res.json({ posts });
});

router.get('/:id', auth(), (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found.' });
  if (req.user.role === 'creator' && post.user_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only view your own posts.' });
  }
  const logs = db
    .prepare(
      `SELECT pl.*, u.name AS actor_name
       FROM post_logs pl
       LEFT JOIN users u ON u.id = pl.user_id
       WHERE pl.post_id = ?
       ORDER BY datetime(pl.created_at) DESC`
    )
    .all(post.id);
  res.json({ post: attachMeta(post), logs });
});

router.post('/', auth(), allow('admin', 'creator', 'manager'), (req, res) => {
  const errors = validatePostBody(req.body);
  if (Object.keys(errors).length) return res.status(400).json({ errors });

  const title = req.body.title.trim();
  const content = req.body.content.trim();
  const image_url = req.body.image_url ? String(req.body.image_url).trim() : null;

  const info = db
    .prepare(
      `INSERT INTO posts (user_id, title, content, image_url, status) VALUES (?, ?, ?, ?, 'draft')`
    )
    .run(req.user.id, title, content, image_url);

  logPost(info.lastInsertRowid, req.user.id, 'created', { title });
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ post: attachMeta(post) });
});

router.put('/:id', auth(), (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found.' });
  if (!canMutate(req.user, post)) return res.status(403).json({ error: 'You cannot edit this post.' });
  if (post.status !== 'draft') {
    return res.status(409).json({ error: 'Only draft posts can be edited.' });
  }

  const errors = validatePostBody(req.body, { partial: true });
  if (Object.keys(errors).length) return res.status(400).json({ errors });

  const title = req.body.title !== undefined ? req.body.title.trim() : post.title;
  const content = req.body.content !== undefined ? req.body.content.trim() : post.content;
  const image_url =
    req.body.image_url !== undefined
      ? req.body.image_url
        ? String(req.body.image_url).trim()
        : null
      : post.image_url;

  db.prepare(
    `UPDATE posts SET title = ?, content = ?, image_url = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(title, content, image_url, post.id);

  logPost(post.id, req.user.id, 'edited', { title, content });
  const updated = db.prepare('SELECT * FROM posts WHERE id = ?').get(post.id);
  res.json({ post: attachMeta(updated) });
});

router.delete('/:id', auth(), (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found.' });
  if (!canMutate(req.user, post)) return res.status(403).json({ error: 'You cannot delete this post.' });
  if (post.status !== 'draft') {
    return res.status(409).json({ error: 'Only draft posts can be deleted.' });
  }
  db.prepare('DELETE FROM posts WHERE id = ?').run(post.id);
  res.json({ ok: true });
});

function hasConflict(platformId, scheduledAtSql, excludeId = null) {
  const row = db
    .prepare(
      `SELECT id FROM scheduled_posts
       WHERE platform_id = ? AND scheduled_at = ? AND status = 'scheduled' ${excludeId ? 'AND id != ?' : ''}
       LIMIT 1`
    )
    .get(...(excludeId ? [platformId, scheduledAtSql, excludeId] : [platformId, scheduledAtSql]));
  return Boolean(row);
}

function scheduleOne(post, platformId, when, user) {
  if (post.status === 'published') {
    return { error: 'Published posts cannot be scheduled again.', status: 409 };
  }
  const platform = db.prepare('SELECT * FROM platforms WHERE id = ? AND is_active = 1').get(platformId);
  if (!platform) return { error: 'Choose an active platform.', status: 400 };

  const date = parseDateTime(when);
  if (!date) return { error: 'Provide a valid schedule date and time.', status: 400 };
  if (date.getTime() <= Date.now() - 5000) {
    return { error: 'Schedule time must be in the future.', status: 400 };
  }

  const sqlTime = toSqlDateTime(date);
  if (hasConflict(platform.id, sqlTime)) {
    return {
      error: `Another post is already scheduled on ${platform.name} at that exact time.`,
      status: 409,
    };
  }

  db.prepare(
    `INSERT INTO scheduled_posts (post_id, platform_id, scheduled_at, status) VALUES (?, ?, ?, 'scheduled')`
  ).run(post.id, platform.id, sqlTime);

  db.prepare(`UPDATE posts SET status = 'scheduled', updated_at = datetime('now') WHERE id = ?`).run(post.id);
  logPost(post.id, user.id, 'scheduled', { platform: platform.name, scheduled_at: sqlTime });
  return { ok: true };
}

router.post('/:id/schedule', auth(), allow('admin', 'creator', 'manager'), (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found.' });
  if (req.user.role === 'creator' && post.user_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only schedule your own posts.' });
  }

  const result = scheduleOne(post, Number(req.body.platform_id), req.body.scheduled_at, req.user);
  if (result.error) return res.status(result.status).json({ error: result.error });

  const updated = db.prepare('SELECT * FROM posts WHERE id = ?').get(post.id);
  res.json({ post: attachMeta(updated) });
});

router.post('/bulk-schedule', auth(), allow('admin', 'creator', 'manager'), (req, res) => {
  const ids = Array.isArray(req.body.post_ids) ? req.body.post_ids.map(Number) : [];
  const platformId = Number(req.body.platform_id);
  const interval = Math.max(0, Number(req.body.interval_minutes) || 0);
  const start = parseDateTime(req.body.scheduled_at);

  if (!ids.length) return res.status(400).json({ error: 'Select at least one post.' });
  if (!start) return res.status(400).json({ error: 'Provide a valid start time.' });

  const results = [];
  ids.forEach((id, index) => {
    const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(id);
    if (!post) {
      results.push({ id, error: 'Not found.' });
      return;
    }
    if (req.user.role === 'creator' && post.user_id !== req.user.id) {
      results.push({ id, error: 'Not allowed.' });
      return;
    }
    const when = new Date(start.getTime() + index * interval * 60 * 1000);
    const result = scheduleOne(post, platformId, when.toISOString(), req.user);
    results.push(result.error ? { id, error: result.error } : { id, ok: true, scheduled_at: when.toISOString() });
  });

  res.json({ results });
});

router.post('/:id/engage', auth(), allow('admin', 'manager'), (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found.' });
  if (post.status !== 'published') {
    return res.status(409).json({ error: 'Engagement can only be added to published posts.' });
  }

  const likes = Math.max(0, Number(req.body.likes) || Math.floor(Math.random() * 40) + 5);
  const comments = Math.max(0, Number(req.body.comments) || Math.floor(Math.random() * 10) + 1);
  const shares = Math.max(0, Number(req.body.shares) || Math.floor(Math.random() * 8));

  db.prepare(
    `INSERT INTO engagements (post_id, likes, comments, shares)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(post_id) DO UPDATE SET
       likes = likes + excluded.likes,
       comments = comments + excluded.comments,
       shares = shares + excluded.shares,
       updated_at = datetime('now')`
  ).run(post.id, likes, comments, shares);

  logPost(post.id, req.user.id, 'engagement', { likes, comments, shares });
  res.json({ post: attachMeta(db.prepare('SELECT * FROM posts WHERE id = ?').get(post.id)) });
});

router.post('/captions/generate', auth(), (req, res) => {
  const result = generateCaption(req.body);
  if (result.error) return res.status(400).json({ error: result.error });
  res.json(result);
});

router.post('/engine/tick', auth(), allow('admin'), (_req, res) => {
  const published = publishDuePosts();
  res.json({ published });
});

module.exports = router;
