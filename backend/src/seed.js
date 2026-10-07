const bcrypt = require('bcryptjs');
const { db } = require('./db');

function addUser(name, email, role) {
  db.prepare(
    'INSERT OR IGNORE INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
  ).run(name, email, bcrypt.hashSync('demo1234', 10), role);
}

function addPlatform(name, slug, accent, icon) {
  db.prepare(
    'INSERT OR IGNORE INTO platforms (name, slug, accent, icon) VALUES (?, ?, ?, ?)'
  ).run(name, slug, accent, icon);
}

addUser('Maya Chen', 'maya@pulse.studio', 'admin');
addUser('Theo Brooks', 'theo@pulse.studio', 'creator');
addUser('Nia Patel', 'nia@pulse.studio', 'manager');

addPlatform('Instagram', 'instagram', '#f05f87', 'ig');
addPlatform('LinkedIn', 'linkedin', '#2367d1', 'in');
addPlatform('X', 'x', '#1c2630', 'x');
addPlatform('TikTok', 'tiktok', '#2acfc2', 'tt');

const hasPosts = db.prepare('SELECT COUNT(*) AS count FROM posts').get().count > 0;
if (!hasPosts) {
  const maya = db.prepare('SELECT id FROM users WHERE email = ?').get('maya@pulse.studio');
  const instagram = db.prepare("SELECT id FROM platforms WHERE slug = 'instagram'").get();
  const linkedin = db.prepare("SELECT id FROM platforms WHERE slug = 'linkedin'").get();
  const now = Date.now();
  const makeDate = (offsetHours) =>
    new Date(now + offsetHours * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
  const create = db.prepare(
    "INSERT INTO posts (user_id, title, content, image_url, status) VALUES (?, ?, ?, ?, ?)"
  );
  const schedule = db.prepare(
    "INSERT INTO scheduled_posts (post_id, platform_id, scheduled_at, status, published_at) VALUES (?, ?, ?, ?, ?)"
  );
  const engagement = db.prepare(
    'INSERT INTO engagements (post_id, likes, comments, shares) VALUES (?, ?, ?, ?)'
  );

  const first = create.run(
    maya.id,
    'Lumen: a brighter morning ritual',
    'A little color therapy for the top of your feed. Meet Lumen, the everyday ritual made for slow mornings and bright ideas. Save this for your next reset. #Lumen #SkincareRoutine #StudioNotes',
    '/assets/lumen-campaign.png',
    'scheduled'
  );
  schedule.run(first.lastInsertRowid, instagram.id, makeDate(21), 'scheduled', null);

  const second = create.run(
    maya.id,
    'Behind the scenes: packaging that keeps up',
    'The smallest details can make the biggest difference. Here is how we chose packaging that looks sharp and works harder.',
    '/assets/lumen-campaign.png',
    'scheduled'
  );
  schedule.run(second.lastInsertRowid, linkedin.id, makeDate(45), 'scheduled', null);

  const third = create.run(
    maya.id,
    'Three ways to make a product launch feel human',
    'The best launch content starts with a point of view, not a template. Here are three small moves that made ours feel more like us.',
    '/assets/lumen-campaign.png',
    'published'
  );
  schedule.run(third.lastInsertRowid, linkedin.id, makeDate(-52), 'published', makeDate(-52));
  engagement.run(third.lastInsertRowid, 842, 68, 91);
}

console.log('Pulse Studio demo data is ready. Sign in with maya@pulse.studio / demo1234');
