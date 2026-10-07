require('dotenv').config();
require('./seed');
const express = require('express');
const cors = require('cors');
const path = require('path');
const { startPublishEngine } = require('./engine');
const authRoutes = require('./routes/auth');
const postRoutes = require('./routes/posts');
const platformRoutes = require('./routes/platforms');

const app = express();
const port = Number(process.env.PORT || 4000);
const publicDir = path.join(__dirname, '..', 'public');

app.use(cors({ origin: process.env.CLIENT_ORIGIN || true }));
app.use(express.json({ limit: '1mb' }));
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'Pulse Studio' }));
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/platforms', platformRoutes);
app.use(express.static(publicDir));
app.get('*', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));

app.listen(port, () => {
  startPublishEngine();
  console.log(`Pulse Studio is running at http://localhost:${port}`);
});
