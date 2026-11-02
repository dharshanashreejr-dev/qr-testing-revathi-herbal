import { useEffect, useRef, useState } from 'react';
import { Fingerprint, ScanLine, Smartphone, ShieldAlert, Wifi, RefreshCw } from 'lucide-react';
import { useT } from '../i18n.js';
import Badge from '../components/Badge.jsx';
import { qrcode } from '../lib/qrcode.js';
import { makeQrDecoder } from '../lib/qrScan.js';
import * as qr from '../lib/qrAttendance.js';

/* ------------------------------------------------------------------ */
/* ADMIN: reception QR + device approvals + alerts + WiFi settings     */
/* ------------------------------------------------------------------ */
function QrCanvas({ text, size = 280 }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!text || !ref.current) return;
    const q = qrcode(0, 'M'); q.addData(text); q.make();
    const n = q.getModuleCount(), cell = Math.floor(size / (n + 4)), px = cell * (n + 4);
    const c = ref.current; c.width = px; c.height = px;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, px, px); g.fillStyle = '#000';
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) g.fillRect((k + 2) * cell, (r + 2) * cell, cell, cell);
  }, [text, size]);
  return <canvas ref={ref} style={{ width: size, maxWidth: '100%', borderRadius: 12, border: '1px solid var(--line)' }} />;
}

function useQrState() {
  const [S, setS] = useState(null);
  const refresh = async () => { try { setS(await qr.getState()); } catch { /* shown by the QR card */ } };
  useEffect(() => { refresh(); const id = setInterval(refresh, 3000); return () => clearInterval(id); }, []);
  return [S, refresh];
}

function PendingList({ S, refresh }) {
  const { t } = useT();
  const act = (fn) => async () => { await fn(); refresh(); };
  return S?.requests?.length ? S.requests.map((r) => (
    <div key={r.rid} className={`alert ${r.kind.startsWith('NEW') ? 'alert-error' : ''}`} style={{ display: 'block', marginBottom: 10 }}>
      <strong>{r.staffName} ({r.staffId})</strong> · {r.kind}
      <div className="muted">{new Date(r.at).toLocaleTimeString()}</div>
      <div>{t('OTP for staff')}: <strong style={{ fontSize: 20, letterSpacing: 3 }}>{r.otp}</strong></div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button className="btn btn-primary" onClick={act(() => qr.approve(r.rid))}>{t('Approve phone')}</button>
        <button className="btn btn-light" onClick={act(() => qr.reject(r.rid))}>{t('Reject')}</button>
      </div>
    </div>
  )) : <p className="muted">{t('No pending requests')}</p>;
}

/* ADMIN > Attendance > Reception QR: the QR (reception screen) + quick phone approvals */
export function ReceptionQr() {
  const { t } = useT();
  const [code, setCode] = useState(null);
  const [left, setLeft] = useState(1);
  const [err, setErr] = useState('');
  const [S, refresh] = useQrState();
  const endAt = useRef(0);

  const loadQr = async () => {
    try { const q = await qr.getQr(); setCode(q); endAt.current = Date.now() + q.rotateInMs; setErr(''); }
    catch (e) { setErr(e.message); }
  };
  useEffect(() => { loadQr(); }, []);
  useEffect(() => {
    const id = setInterval(() => {
      if (!code) return;
      const ms = endAt.current - Date.now();
      setLeft(Math.max(0, ms / code.rotateTotalMs));
      if (ms <= -300) { endAt.current = Date.now() + 5000; loadQr(); }
    }, 250);
    return () => clearInterval(id);
  }, [code]);

  return (
    <>
      {err && <div className="alert alert-error">{err}. {t('Start the mock API with npm run dev or npm run demo.')}</div>}
      <div className="grid-2">
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="card-head"><h3><ScanLine size={18} style={{ verticalAlign: -3 }} /> {t('Reception QR (acts as the reception screen)')}</h3></div>
          {code ? <QrCanvas text={`${window.location.origin}/#/attendance/${code.token}`} /> : <p className="muted">{t('Loading...')}</p>}
          <div style={{ height: 8, background: '#eadde0', borderRadius: 6, overflow: 'hidden', maxWidth: 280, margin: '12px auto' }}>
            <div style={{ height: '100%', width: `${left * 100}%`, background: 'var(--rose-deep)', transition: 'width .25s linear' }} />
          </div>
          <p className="muted">{t('Changes every 20 seconds')} · {t('Token')}: <strong>{code?.token}</strong></p>
          <p className="muted">{t('Staff scan this with their registered phone. Opening it here on the admin login does not punch.')}</p>
        </div>
        <div className="card">
          <div className="card-head"><h3><Smartphone size={18} style={{ verticalAlign: -3 }} /> {t('Phone approvals')}</h3></div>
          <PendingList S={S} refresh={refresh} />
          <p className="muted" style={{ marginTop: 10 }}>{t('All phones, alerts and WiFi check: Staff Phones page.')}</p>
        </div>
      </div>
    </>
  );
}

/* ADMIN > Staff Phones page: approvals, registered phones + fingerprint status, alerts, salon WiFi check */
export function PhonesPanel({ staff }) {
  const { t } = useT();
  const [S, refresh] = useQrState();
  const [ips, setIps] = useState('');
  const [wifi, setWifi] = useState('false');
  const editing = useRef(false);
  useEffect(() => { if (S && !editing.current) { setIps(S.settings.allowedIps.join(', ')); setWifi(String(S.settings.wifiCheck)); } }, [S]);
  const act = (fn) => async () => { await fn(); refresh(); };
  const nameOf = (id) => staff.find((s) => s.id === id)?.name || id;

  return (
    <>
      <div className="grid-2">
        <div className="card">
          <div className="card-head"><h3><Smartphone size={18} style={{ verticalAlign: -3 }} /> {t('Phone approvals')}</h3></div>
          <PendingList S={S} refresh={refresh} />
        </div>
        <div className="card">
          <div className="card-head"><h3><ShieldAlert size={18} style={{ verticalAlign: -3 }} /> {t('Security alerts')}</h3></div>
          {S?.alerts?.length ? S.alerts.slice(0, 8).map((a, i) => (
            <div key={i} className="alert alert-error" style={{ display: 'block', marginBottom: 6 }}>{a.msg}<div className="muted">{new Date(a.at).toLocaleString()}</div></div>
          )) : <p className="muted">{t('No alerts')}</p>}
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head"><h3>{t('Registered phones & fingerprints')}</h3></div>
          <table className="table">
            <thead><tr><th>{t('Staff')}</th><th>{t('Phone')}</th><th>{t('Fingerprint')}</th><th /></tr></thead>
            <tbody>
              {(S?.devices || []).map((d) => (
                <tr key={d.staffId}>
                  <td><strong>{nameOf(d.staffId)}</strong><div className="muted">{d.staffId}</div></td>
                  <td><Badge tone="green">{t('Approved')}</Badge></td>
                  <td><Badge tone={d.enrolled ? 'green' : 'amber'}>{d.enrolled ? t('Enrolled') : t('Not enrolled')}</Badge></td>
                  <td><button className="btn btn-light" onClick={act(() => qr.resetDevice(d.staffId))}>{t('Reset phone')}</button></td>
                </tr>
              ))}
              {!S?.devices?.length && <tr><td colSpan={4} className="muted">{t('No staff phone registered yet')}</td></tr>}
            </tbody>
          </table>
          <p style={{ marginTop: 12 }}><button className="btn btn-ghost" onClick={async () => { if (confirm(t('Clear all QR punches and alerts?'))) { await qr.clearAll(); localStorage.removeItem('rhb-hr-punches'); refresh(); } }}><RefreshCw size={15} /> {t('Reset demo punches')}</button></p>
        </div>

        <div className="card">
          <div className="card-head"><h3><Wifi size={18} style={{ verticalAlign: -3 }} /> {t('Salon WiFi check')}</h3></div>
          <p className="muted">{t('Demo: keep OFF. For the MD test on office WiFi, tap "Add my IP" on that WiFi, then turn ON.')}</p>
          <select value={wifi} onFocus={() => (editing.current = true)} onChange={(e) => setWifi(e.target.value)} style={{ marginBottom: 8, width: '100%' }}>
            <option value="false">{t('OFF (demo)')}</option><option value="true">{t('ON (salon WiFi only)')}</option>
          </select>
          <input value={ips} onFocus={() => (editing.current = true)} onChange={(e) => setIps(e.target.value)} placeholder="Allowed IPs, comma separated" style={{ width: '100%', marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-light" onClick={() => { editing.current = true; const v = ips.split(',').map((x) => x.trim()).filter(Boolean); if (S?.yourIp && !v.includes(S.yourIp)) v.push(S.yourIp); setIps(v.join(', ')); }}>{t('Add my IP')} ({S?.yourIp || '?'})</button>
            <button className="btn btn-primary" onClick={async () => { await qr.saveSettings({ wifiCheck: wifi === 'true', allowedIps: ips.split(',') }); editing.current = false; refresh(); }}>{t('Save')}</button>
          </div>
          <p className="muted" style={{ marginTop: 14 }}>{t('Limit: the phone fingerprint proves a live unlock on the registered phone, not whose finger it is. Identity = staff ID + approved phone.')}</p>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* STAFF: register phone, enrol fingerprint, scan QR, punch            */
/* ------------------------------------------------------------------ */
const parseToken = (txt) => (String(txt || '').match(/DQR-[0-9a-f]+/i) || [])[0] || '';

export function StaffQrPanel({ staffId, staffName, onPunched, autoToken }) {
  const { t } = useT();
  const [st, setSt] = useState(null);       // { status, enrolled }
  const [msg, setMsg] = useState(null);     // { type: 'ok'|'err'|'info', text }
  const [otp, setOtp] = useState('');
  const [manual, setManual] = useState('');
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const video = useRef(null);
  const stream = useRef(null);
  const timer = useRef(null);
  const autoDone = useRef(false);

  const load = async () => { try { setSt(await qr.deviceStatus(staffId)); } catch (e) { setMsg({ type: 'err', text: e.message }); } };
  useEffect(() => { load(); const id = setInterval(load, 3000); return () => clearInterval(id); }, [staffId]);
  useEffect(() => () => stopScan(), []);

  const say = (type, text) => setMsg({ type, text });
  const run = async (fn) => { setBusy(true); try { await fn(); } catch (e) { say('err', e.message || String(e)); } setBusy(false); load(); };

  const register = () => run(async () => { await qr.requestDevice(staffId, staffName); say('info', t('Request sent. Ask admin to approve this phone.')); });
  const sendOtp = () => run(async () => { await qr.submitOtp(staffId, otp); setOtp(''); say('ok', t('Phone approved with OTP.')); });
  const enrol = () => run(async () => { await qr.enrollFingerprint(staffId); say('ok', t('Fingerprint enrolled on this phone.')); });

  const punch = (token) => run(async () => {
    say('info', t('QR checked. Now give your fingerprint...'));
    const rec = await qr.punchWithQr(staffId, staffName, token);
    say('ok', `${t('Punch')} ${rec.type} ${t('recorded at')} ${new Date(rec.at).toLocaleTimeString()}`);
    onPunched?.();
  });

  // Opened from the phone's normal camera: the QR link brings the token here
  useEffect(() => {
    if (!autoToken || !st || autoDone.current) return;
    autoDone.current = true;
    const token = parseToken(autoToken);
    window.location.hash = '/attendance';
    if (st.status === 'approved' && st.enrolled && token) punch(token);
    else say('err', t('Finish phone registration and fingerprint enrolment first, then scan the QR again.'));
  }, [autoToken, st]);

  async function startScan() {
    setMsg(null);
    try {
      const decode = await makeQrDecoder();
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setScanning(true);
      requestAnimationFrame(async () => {
        const v = video.current; if (!v) return;
        v.srcObject = stream.current; await v.play().catch(() => {});
        timer.current = setInterval(async () => {
          let txt = ''; try { txt = await decode(v); } catch { /* keep trying */ }
          const tok = parseToken(txt); if (tok) { stopScan(); punch(tok); }
        }, 350);
      });
    } catch (e) { say('err', `${t('Camera error')}: ${e.message || e}. ${t('Camera needs HTTPS and permission. Use the manual token box below.')}`); }
  }
  function stopScan() {
    clearInterval(timer.current); timer.current = null;
    stream.current?.getTracks().forEach((x) => x.stop()); stream.current = null; setScanning(false);
  }

  const status = st?.status;
  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <div className="card-head"><h3><Fingerprint size={18} style={{ verticalAlign: -3 }} /> {t('QR + fingerprint punch')}</h3></div>
      <p className="muted">{staffName} ({staffId})</p>

      {status === 'none' && <>
        <p>{t('This phone is not registered for your staff ID yet.')}</p>
        <button className="btn btn-primary" disabled={busy} onClick={register}>{t('Register this phone')}</button>
      </>}

      {(status === 'pending' || status === 'other-device') && <>
        {status === 'other-device'
          ? <div className="alert alert-error" style={{ display: 'block' }}>{t('Your staff ID already has another approved phone. Admin has been alerted. Enter the OTP given by admin, or wait for approval.')}</div>
          : <div className="alert" style={{ display: 'block' }}>{t('Waiting for admin to approve this phone... (or enter the OTP admin gives you)')}</div>}
        {status === 'other-device' && <button className="btn btn-primary" disabled={busy} onClick={register} style={{ marginBottom: 10 }}>{t('Request approval for this phone')}</button>}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder={t('OTP from admin')} inputMode="numeric" style={{ flex: 1 }} />
          <button className="btn btn-light" disabled={busy || !otp} onClick={sendOtp}>{t('Verify OTP')}</button>
        </div>
      </>}

      {status === 'approved' && <>
        <p><Badge tone="green">{t('Phone approved')}</Badge> {' '}
          <Badge tone={st.enrolled ? 'green' : 'amber'}>{st.enrolled ? t('Fingerprint enrolled') : t('Fingerprint not enrolled')}</Badge></p>
        {!st.enrolled && <button className="btn btn-primary btn-block" disabled={busy} onClick={enrol}><Fingerprint size={17} /> {t('Enrol fingerprint (one time)')}</button>}
        {st.enrolled && <>
          {!scanning
            ? <button className="btn btn-primary btn-block" disabled={busy} onClick={startScan}><ScanLine size={17} /> {t('Scan reception QR')}</button>
            : <div style={{ textAlign: 'center' }}>
                <video ref={video} playsInline muted style={{ width: '100%', maxWidth: 360, borderRadius: 12, background: '#000' }} />
                <div><button className="btn btn-light" onClick={stopScan} style={{ marginTop: 8 }}>{t('Stop camera')}</button></div>
              </div>}
          <details style={{ marginTop: 14 }}>
            <summary className="muted" style={{ cursor: 'pointer' }}>{t('Camera not working? Type the QR token')}</summary>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="DQR-xxxxxxxxxxxx" style={{ flex: 1 }} />
              <button className="btn btn-light" disabled={busy || !manual} onClick={() => punch(parseToken(manual) || manual.trim())}>{t('Punch')}</button>
            </div>
          </details>
        </>}
      </>}

      {msg && <div className={`alert ${msg.type === 'err' ? 'alert-error' : ''}`} style={{ display: 'block', marginTop: 14 }}>{msg.text}</div>}
    </div>
  );
}
