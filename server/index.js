// Local server: API + built app (npm run demo) on :3001. On Vercel the API runs from api/index.js instead.
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { fileURLToPath } from 'node:url';
import app from './app.js';
import { usingRedis } from './store.js';

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`QR attendance API on http://localhost:${PORT} (${usingRedis ? 'Upstash Redis' : 'local data.json'})${fs.existsSync(dist) ? ', serving built app' : ''}`));
