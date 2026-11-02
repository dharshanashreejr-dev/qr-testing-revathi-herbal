// Client for the QR + fingerprint attendance mock API (server/index.js).
// BACKEND LATER: same routes become Spring Boot REST calls. Nothing else in the UI changes.
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { mergePunches } from '../../api/attendance';

export const deviceId = () => {
  let id = localStorage.getItem('rhbc-qr-device');
  if (!id) { id = 'dev-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); localStorage.setItem('rhbc-qr-device', id); }
  return id;
};

async function call(path, method = 'GET', body) {
  const r = await fetch('/api/qr' + path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Server error (is the mock API running?)');
  return j;
}

// admin
export const getQr = () => call('/current');
export const getState = () => call('/state');
export const approve = (id) => call(`/requests/${id}/approve`, 'POST', {});
export const reject = (id) => call(`/requests/${id}/reject`, 'POST', {});
export const resetDevice = (staffId) => call(`/devices/${staffId}/reset`, 'POST', {});
export const saveSettings = (s) => call('/settings', 'POST', s);
export const clearAll = () => call('/clear', 'POST', {});

// staff phone
export const deviceStatus = (staffId) => call(`/device-status?staffId=${encodeURIComponent(staffId)}&deviceId=${deviceId()}`);
export const requestDevice = (staffId, staffName) => call('/device-request', 'POST', { staffId, staffName, deviceId: deviceId() });
export const submitOtp = (staffId, otp) => call('/device-otp', 'POST', { staffId, deviceId: deviceId(), otp });

export async function enrollFingerprint(staffId) {
  const base = { staffId, deviceId: deviceId() };
  const optionsJSON = await call('/enroll/options', 'POST', base);
  const response = await startRegistration({ optionsJSON });
  return call('/enroll/verify', 'POST', { ...base, response });
}

export async function punchWithQr(staffId, staffName, token) {
  const base = { staffId, staffName, deviceId: deviceId() };
  const optionsJSON = await call('/punch/challenge', 'POST', { ...base, token });
  const response = await startAuthentication({ optionsJSON });
  const r = await call('/punch/verify', 'POST', { ...base, response });
  mergePunches([r.record]);
  return r.record;
}

/** Pull server punches into the local attendance store so Live board / Punch log / calendar update. Returns true if something new arrived. */
export async function syncPunches() {
  try { return mergePunches(await call('/punches')); } catch { return false; }
}
