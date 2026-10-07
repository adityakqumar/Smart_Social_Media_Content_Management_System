const { db, logPost } = require('./db');

function publishDuePosts() {
  const due = db
    .prepare(
      `SELECT sp.id, sp.post_id, sp.platform_id, p.status AS post_status
       FROM scheduled_posts sp
       JOIN posts p ON p.id = sp.post_id
       WHERE sp.status = 'scheduled' AND datetime(sp.scheduled_at) <= datetime('now')`
    )
    .all();

  const updateSlot = db.prepare(
    `UPDATE scheduled_posts SET status = 'published', published_at = datetime('now') WHERE id = ?`
  );
  const updatePost = db.prepare(
    `UPDATE posts SET status = 'published', updated_at = datetime('now') WHERE id = ?`
  );
  const ensureEngagement = db.prepare(
    `INSERT OR IGNORE INTO engagements (post_id, likes, comments, shares) VALUES (?, 0, 0, 0)`
  );
  const bump = db.prepare(
    `UPDATE engagements
     SET likes = likes + ?, comments = comments + ?, shares = shares + ?, updated_at = datetime('now')
     WHERE post_id = ?`
  );

  const run = db.transaction((rows) => {
    for (const row of rows) {
      updateSlot.run(row.id);
      updatePost.run(row.post_id);
      ensureEngagement.run(row.post_id);
      const likes = 8 + Math.floor(Math.random() * 80);
      const comments = 1 + Math.floor(Math.random() * 18);
      const shares = Math.floor(Math.random() * 12);
      bump.run(likes, comments, shares, row.post_id);
      logPost(row.post_id, null, 'published', {
        source: 'auto-engine',
        scheduled_post_id: row.id,
        platform_id: row.platform_id,
      });
    }
  });

  if (due.length) run(due);
  return due.length;
}

function startPublishEngine(intervalMs = 8000) {
  publishDuePosts();
  return setInterval(publishDuePosts, intervalMs);
}

module.exports = { publishDuePosts, startPublishEngine };
