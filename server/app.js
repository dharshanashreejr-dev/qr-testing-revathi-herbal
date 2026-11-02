// QR + fingerprint attendance API (Express). Runs locally (server/index.js) and on Vercel (api/index.js).
// State lives in Upstash Redis on Vercel, or in server/data.json locally. See store.js.
// BACKEND LATER: same routes become Spring Boot REST calls.
import express from 'express';
import crypto from 'node:crypto';
import {
  generateRegistrationOptions, verifyRegistrationResponse,
  generateAuthenticationOptions, verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import * as store from './store.js';

const QR_ROTATE_MS = 20000, QR_VALID_MS = 30000;
const app = express();
app.set('trust proxy', true);
app.use(express.json());

const loadDb = async () => ({ devices: {}, requests: [], alerts: [], punches: [], settings: { wifiCheck: false, allowedIps: [] }, ...(await store.get('db', {})) });
const saveDb = (db) => store.set('db', db);
const h = (fn) => (req, res) => fn(req, res).catch((e) => { console.error(e); res.status(500).json({ error: e.message || 'Server error' }); });

const rid = (n = 6) => crypto.randomBytes(n).toString('hex');
const nowISO = () => new Date().toISOString();
const clientIp = (req) => (req.ip || '').replace('::ffff:', '');
const rp = (req) => {
  const origin = req.headers.origin || `${req.protocol}://${req.get('host')}`;
  return { origin, rpID: new URL(origin).hostname };
};

async function currentQr() {
  let tokens = (await store.get('qr', [])).filter((x) => x.expiresAt > Date.now() - 60000);
  const last = tokens[tokens.length - 1];
  if (last && Date.now() - last.createdAt < QR_ROTATE_MS) return last;
  const t = { token: 'DQR-' + rid(6), createdAt: Date.now(), expiresAt: Date.now() + QR_VALID_MS, usedBy: [] };
  tokens.push(t); await store.set('qr', tokens);
  return t;
}
const findQr = async (token) => (await store.get('qr', [])).find((x) => x.token === String(token || '').trim());
const markQrUsed = async (token, staffId) => {
  const tokens = await store.get('qr', []);
  const q = tokens.find((x) => x.token === token); if (q) { q.usedBy.push(staffId); await store.set('qr', tokens); }
};

const statusFor = (db, staffId, deviceId) => {
  const d = db.devices[staffId];
  if (d && d.deviceId === deviceId) return 'approved';
  if (db.requests.some((r) => r.staffId === staffId && r.deviceId === deviceId && r.status === 'pending')) return 'pending';
  return d ? 'other-device' : 'none';
};

// ---- Admin ----
app.get('/api/qr/current', h(async (req, res) => {
  const q = await currentQr();
  res.json({ token: q.token, rotateInMs: Math.max(0, q.createdAt + QR_ROTATE_MS - Date.now()), rotateTotalMs: QR_ROTATE_MS });
}));
app.get('/api/qr/state', h(async (req, res) => {
  const db = await loadDb();
  res.json({
    requests: db.requests.filter((r) => r.status === 'pending'),
    alerts: db.alerts.slice(-50).reverse(),
    devices: Object.entries(db.devices).map(([staffId, d]) => ({ staffId, name: d.name, enrolled: d.credentials.length > 0, approvedAt: d.approvedAt })),
    settings: db.settings, yourIp: clientIp(req),
  });
}));
app.get('/api/qr/punches', h(async (req, res) => res.json((await loadDb()).punches.slice(-500))));
app.post('/api/qr/requests/:id/approve', h(async (req, res) => {
  const db = await loadDb();
  const r = db.requests.find((x) => x.rid === req.params.id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  db.devices[r.staffId] = { name: r.staffName, deviceId: r.deviceId, credentials: [], approvedAt: nowISO() }; // new phone => enrol fingerprint again
  r.status = 'approved'; await saveDb(db); res.json({ ok: true });
}));
app.post('/api/qr/requests/:id/reject', h(async (req, res) => {
  const db = await loadDb();
  const r = db.requests.find((x) => x.rid === req.params.id); if (r) r.status = 'rejected';
  await saveDb(db); res.json({ ok: true });
}));
app.post('/api/qr/devices/:staffId/reset', h(async (req, res) => {
  const db = await loadDb(); delete db.devices[req.params.staffId]; await saveDb(db); res.json({ ok: true });
}));
app.post('/api/qr/settings', h(async (req, res) => {
  const db = await loadDb(); const { wifiCheck, allowedIps } = req.body;
  if (typeof wifiCheck === 'boolean') db.settings.wifiCheck = wifiCheck;
  if (Array.isArray(allowedIps)) db.settings.allowedIps = allowedIps.map((x) => String(x).trim()).filter(Boolean);
  await saveDb(db); res.json(db.settings);
}));
app.post('/api/qr/clear', h(async (req, res) => { const db = await loadDb(); db.punches = []; db.alerts = []; await saveDb(db); res.json({ ok: true }); }));

// ---- Staff phone: device binding ----
app.get('/api/qr/device-status', h(async (req, res) => {
  const db = await loadDb(); const { staffId, deviceId } = req.query;
  const st = statusFor(db, staffId, deviceId);
  res.json({ status: st, enrolled: st === 'approved' && db.devices[staffId].credentials.length > 0 });
}));
app.post('/api/qr/device-request', h(async (req, res) => {
  const { staffId, staffName, deviceId } = req.body;
  if (!staffId || !deviceId) return res.status(400).json({ error: 'Missing staff or device' });
  const db = await loadDb(); const st = statusFor(db, staffId, deviceId);
  if (st === 'approved' || st === 'pending') return res.json({ status: st });
  db.requests.push({ rid: rid(4), staffId, staffName, deviceId, otp: String(Math.floor(100000 + Math.random() * 900000)), status: 'pending', at: nowISO(),
    kind: st === 'other-device' ? 'NEW DEVICE (staff already has an approved phone)' : 'FIRST DEVICE' });
  if (st === 'other-device') db.alerts.push({ at: nowISO(), level: 'danger', msg: `${staffName} (${staffId}): login attempt from an UNKNOWN phone. Approve only if it is really them.` });
  await saveDb(db); res.json({ status: 'pending' });
}));
app.post('/api/qr/device-otp', h(async (req, res) => {
  const { staffId, deviceId, otp } = req.body; const db = await loadDb();
  const r = db.requests.find((x) => x.staffId === staffId && x.deviceId === deviceId && x.status === 'pending' && x.otp === String(otp || '').trim());
  if (!r) return res.status(401).json({ error: 'Wrong OTP' });
  db.devices[staffId] = { name: r.staffName, deviceId, credentials: [], approvedAt: nowISO() };
  r.status = 'approved'; await saveDb(db); res.json({ status: 'approved' });
}));

// ---- Fingerprint enrol (WebAuthn passkey) ----
async function approvedDevice(req, res) {
  const db = await loadDb(); const { staffId, deviceId } = req.body; const d = db.devices[staffId];
  if (!d || d.deviceId !== deviceId) { res.status(403).json({ error: 'This phone is not approved for this staff ID' }); return null; }
  return { db, d };
}
app.post('/api/qr/enroll/options', h(async (req, res) => {
  const x = await approvedDevice(req, res); if (!x) return;
  const { staffId } = req.body;
  const opts = await generateRegistrationOptions({
    rpName: 'Revathi Herbal Attendance', rpID: rp(req).rpID, userName: staffId, userDisplayName: x.d.name,
    userID: new TextEncoder().encode(staffId), attestationType: 'none',
    authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
    excludeCredentials: x.d.credentials.map((c) => ({ id: c.id })),
  });
  await store.set('ch:reg:' + staffId, opts.challenge, 300);
  res.json(opts);
}));
app.post('/api/qr/enroll/verify', h(async (req, res) => {
  const x = await approvedDevice(req, res); if (!x) return;
  const { staffId, response } = req.body;
  try {
    const v = await verifyRegistrationResponse({ response, expectedChallenge: await store.get('ch:reg:' + staffId, ''), expectedOrigin: rp(req).origin, expectedRPID: rp(req).rpID, requireUserVerification: true });
    if (!v.verified) return res.status(400).json({ error: 'Fingerprint not verified' });
    const c = v.registrationInfo.credential;
    x.d.credentials.push({ id: c.id, publicKey: Buffer.from(c.publicKey).toString('base64'), counter: c.counter });
    await saveDb(x.db); res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
}));

// ---- Punch: QR token + phone + WiFi, then fingerprint signature ----
app.post('/api/qr/punch/challenge', h(async (req, res) => {
  const x = await approvedDevice(req, res); if (!x) return;
  const { staffId, staffName, token } = req.body;
  const q = await findQr(token);
  if (!q) return res.status(400).json({ error: 'Invalid QR code' });
  if (q.expiresAt < Date.now()) return res.status(400).json({ error: 'QR expired. Scan the latest QR on the reception screen.' });
  if (q.usedBy.includes(staffId)) return res.status(400).json({ error: 'You already used this QR. Wait for the next one.' });
  if (!x.d.credentials.length) return res.status(400).json({ error: 'Enrol your fingerprint first' });
  if (x.db.settings.wifiCheck && !x.db.settings.allowedIps.includes(clientIp(req))) {
    x.db.alerts.push({ at: nowISO(), level: 'warn', msg: `${staffName || staffId}: punch blocked, not on salon WiFi (IP ${clientIp(req)})` }); await saveDb(x.db);
    return res.status(403).json({ error: 'Connect to the salon WiFi to punch' });
  }
  const opts = await generateAuthenticationOptions({ rpID: rp(req).rpID, userVerification: 'required', allowCredentials: x.d.credentials.map((c) => ({ id: c.id })) });
  await store.set('ch:auth:' + staffId, { challenge: opts.challenge, token: q.token }, 300);
  res.json(opts);
}));
app.post('/api/qr/punch/verify', h(async (req, res) => {
  const x = await approvedDevice(req, res); if (!x) return;
  const { staffId, staffName, response } = req.body;
  const ch = await store.get('ch:auth:' + staffId, null);
  if (!ch) return res.status(400).json({ error: 'No active challenge, scan again' });
  const cred = x.d.credentials.find((c) => c.id === response?.id);
  if (!cred) return res.status(400).json({ error: 'Unknown fingerprint credential' });
  try {
    const v = await verifyAuthenticationResponse({
      response, expectedChallenge: ch.challenge, expectedOrigin: rp(req).origin, expectedRPID: rp(req).rpID,
      credential: { id: cred.id, publicKey: Buffer.from(cred.publicKey, 'base64'), counter: cred.counter }, requireUserVerification: true,
    });
    if (!v.verified) return res.status(400).json({ error: 'Fingerprint not verified' });
    cred.counter = v.authenticationInfo.newCounter;
    await markQrUsed(ch.token, staffId); await store.del('ch:auth:' + staffId);
    const today = nowISO().slice(0, 10);
    const last = x.db.punches.filter((p) => p.staffId === staffId && p.at.slice(0, 10) === today).slice(-1)[0];
    const rec = { id: 'QP-' + rid(4), staffId, staffName: staffName || x.d.name, at: nowISO(), type: last && last.type === 'IN' ? 'OUT' : 'IN', source: 'QR', deviceId: 'QR-RECEPTION', note: 'QR + phone fingerprint' };
    x.db.punches.push(rec); await saveDb(x.db);
    res.json({ ok: true, record: rec });
  } catch (e) { res.status(400).json({ error: e.message }); }
}));

export default app;
