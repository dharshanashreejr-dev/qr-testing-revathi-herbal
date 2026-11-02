import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store.jsx';
import { useT } from '../i18n.js';
import Badge from '../components/Badge.jsx';
import * as att from '../../api/attendance';
import * as qrApi from '../lib/qrAttendance.js';
import { ReceptionQr, StaffQrPanel } from './QrAttendance.jsx';

const tabsAdmin = ['Live board', 'Reception QR', 'Calendar', 'Punch log', 'Corrections', 'Disputes'];
const tabsStaff = ['QR Punch', 'My calendar', 'Request correction'];

export default function Attendance({ user, qrToken }) {
  const { t } = useT();
  const { staff, addAudit } = useStore();
  const isAdmin = user.role === 'Admin';
  const [tab, setTab] = useState(isAdmin ? 'Live board' : 'QR Punch');
  const [filter, setFilter] = useState('All');
  const [month, setMonth] = useState(att.monthKey());
  const [reason, setReason] = useState('');
  const [corr, setCorr] = useState({ staffId: '', type: 'IN', at: '', date: new Date().toISOString().slice(0, 10) });
  const [disputeMsg, setDisputeMsg] = useState('');
  const [disputeDate, setDisputeDate] = useState(new Date().toISOString().slice(0, 10));
  const [, tick] = useState(0);
  const refresh = () => tick((n) => n + 1);

  useEffect(() => {
    if (staff?.length) att.seedDemoPunches(staff.map((s) => ({ id: s.id, name: s.name })));
    refresh();
  }, [staff]);

  // QR + fingerprint punches are stored on the mock server; pull them in every 3 s so admin and staff screens update live
  useEffect(() => {
    let on = true;
    const pull = async () => { if (await qrApi.syncPunches() && on) refresh(); };
    pull(); const id = setInterval(pull, 3000);
    return () => { on = false; clearInterval(id); };
  }, []);

  const board = useMemo(() => att.liveBoard(staff || []), [staff, tick]);
  const filtered = board.filter((b) => filter === 'All' || b.status === filter);
  const punches = att.listPunches();
  const corrections = att.listCorrections();
  const disputes = att.listDisputes();

  const myId = useMemo(() => {
    const s = (staff || []).find((x) => x.name === user.name || x.email === user.email || x.username === user.email);
    return s?.id;
  }, [staff, user]);

  const submitCorrection = (e) => {
    e.preventDefault();
    if (!reason.trim()) return alert(t('Reason is mandatory'));
    const s = (staff || []).find((x) => x.id === corr.staffId);
    if (!s) return;
    const at = `${corr.date}T${corr.at || '09:00'}:00`;
    att.addCorrection({ staffId: s.id, staffName: s.name, date: corr.date, type: corr.type, at, reason: reason.trim(), by: user.name }, user.name);
    addAudit?.('Attendance correction', `${s.name} ${corr.type} ${corr.date}: ${reason.trim()}`, user.name);
    setReason('');
    refresh();
  };

  const submitDispute = (e) => {
    e.preventDefault();
    if (!myId || !disputeMsg.trim()) return;
    const s = (staff || []).find((x) => x.id === myId);
    att.addDispute({ staffId: myId, staffName: s?.name || user.name, date: disputeDate, message: disputeMsg.trim() });
    setDisputeMsg('');
    refresh();
  };

  const tabs = isAdmin ? tabsAdmin : tabsStaff;

  return (
    <div className="page">
      <div className="page-header">
        <div><h2>{isAdmin ? t('Attendance') : t('My Attendance')}</h2>
          <p className="muted">{isAdmin ? t('Live board, calendar, punches and corrections') : t('Your monthly attendance and correction requests')}</p></div>
      </div>
      <div className="tabs" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {tabs.map((x) => (
          <button key={x} className={`btn ${tab === x ? 'btn-primary' : 'btn-light'}`} onClick={() => setTab(x)}>{t(x)}</button>
        ))}
      </div>

      {tab === 'Reception QR' && isAdmin && <ReceptionQr />}
      {tab === 'QR Punch' && !isAdmin && (myId
        ? <StaffQrPanel staffId={myId} staffName={(staff || []).find((x) => x.id === myId)?.name || user.name} onPunched={refresh} autoToken={qrToken} />
        : <div className="card"><p className="muted">{t('Your login is not linked to a staff record.')}</p></div>)}

      {tab === 'Live board' && isAdmin && (
        <div className="card">
          <div className="card-head" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <h3>{t('Today')}</h3>
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              {['All', 'Present', 'Late', 'Absent', 'Leave'].map((s) => <option key={s}>{t(s)}</option>)}
            </select>
            <span className="muted">{filtered.filter((b) => b.status === 'Present' || b.status === 'Late').length} {t('in')} · {filtered.filter((b) => b.status === 'Absent').length} {t('absent')}</span>
          </div>
          <table className="table">
            <thead><tr><th>{t('Staff')}</th><th>{t('Shift')}</th><th>{t('Status')}</th><th>{t('In')}</th><th>{t('Out')}</th><th>{t('Late')}</th></tr></thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.staffId}>
                  <td><strong>{b.name}</strong></td>
                  <td>{b.shift}</td>
                  <td><Badge>{t(b.status)}</Badge></td>
                  <td>{b.inAt ? new Date(b.inAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                  <td>{b.outAt ? new Date(b.outAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                  <td>{b.lateMins ? `${b.lateMins} ${t('min')}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(tab === 'Calendar' || tab === 'My calendar') && (
        <div className="card">
          <div className="card-head"><h3>{t('Month')}</h3>
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <p className="muted">{t('Summary from punches (mock). Device sync will fill this automatically.')}</p>
          <table className="table">
            <thead><tr><th>{t('Staff')}</th><th>{t('Present')}</th><th>{t('Late')}</th><th>{t('Absent')}</th></tr></thead>
            <tbody>
              {(isAdmin ? staff : staff.filter((s) => s.id === myId)).map((s) => {
                const ps = punches.filter((p) => p.staffId === s.id && p.at.startsWith(month) && p.type === 'IN');
                return (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>{ps.length}</td>
                    <td>—</td>
                    <td>—</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'Punch log' && isAdmin && (
        <div className="card">
          <div className="card-head"><h3>{t('Raw punches')}</h3></div>
          <table className="table">
            <thead><tr><th>{t('Time')}</th><th>{t('Staff')}</th><th>{t('Type')}</th><th>{t('Source')}</th><th>{t('Note')}</th></tr></thead>
            <tbody>
              {punches.slice(0, 50).map((p) => (
                <tr key={p.id}>
                  <td>{new Date(p.at).toLocaleString()}</td>
                  <td>{p.staffName}</td>
                  <td>{p.type}</td>
                  <td>{p.source}</td>
                  <td>{p.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'Corrections' && isAdmin && (
        <div className="grid-2">
          <form className="card" onSubmit={submitCorrection}>
            <h3>{t('Manual correction')}</h3>
            <p className="muted">{t('Reason is mandatory and is written to the audit log.')}</p>
            <label>{t('Staff')}<select required value={corr.staffId} onChange={(e) => setCorr({ ...corr, staffId: e.target.value })}>
              <option value="">{t('Select')}</option>
              {(staff || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select></label>
            <label>{t('Date')}<input type="date" value={corr.date} onChange={(e) => setCorr({ ...corr, date: e.target.value })} /></label>
            <label>{t('Time')}<input type="time" value={corr.at} onChange={(e) => setCorr({ ...corr, at: e.target.value })} /></label>
            <label>{t('Type')}<select value={corr.type} onChange={(e) => setCorr({ ...corr, type: e.target.value })}><option>IN</option><option>OUT</option></select></label>
            <label>{t('Reason')}<textarea required value={reason} onChange={(e) => setReason(e.target.value)} rows={3} /></label>
            <button className="btn btn-primary" type="submit">{t('Save correction')}</button>
          </form>
          <div className="card">
            <h3>{t('Recent corrections')}</h3>
            <ul className="list">{corrections.slice(0, 20).map((c) => (
              <li key={c.id}><div><strong>{c.staffName}</strong> · {c.type} · {c.date}<span className="muted">{c.reason}</span></div><span className="muted">{c.by}</span></li>
            ))}</ul>
          </div>
        </div>
      )}

      {tab === 'Disputes' && isAdmin && (
        <div className="card">
          <h3>{t('Correction requests')}</h3>
          <table className="table">
            <thead><tr><th>{t('Staff')}</th><th>{t('Date')}</th><th>{t('Message')}</th><th>{t('Status')}</th><th /></tr></thead>
            <tbody>
              {disputes.map((d) => (
                <tr key={d.id}>
                  <td>{d.staffName}</td><td>{d.date}</td><td>{d.message}</td><td><Badge>{t(d.status)}</Badge></td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    {d.status === 'Pending' && (
                      <>
                        <button className="btn btn-light" type="button" onClick={() => { att.decideDispute(d.id, 'Approved', user.name); addAudit?.('Dispute approved', d.id, user.name); refresh(); }}>{t('Approve')}</button>
                        <button className="btn btn-light" type="button" onClick={() => { att.decideDispute(d.id, 'Rejected', user.name); refresh(); }}>{t('Reject')}</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'Request correction' && !isAdmin && (
        <form className="card" onSubmit={submitDispute} style={{ maxWidth: 480 }}>
          <h3>{t('Punch missed / dispute')}</h3>
          <label>{t('Date')}<input type="date" value={disputeDate} onChange={(e) => setDisputeDate(e.target.value)} /></label>
          <label>{t('Message')}<textarea required rows={4} value={disputeMsg} onChange={(e) => setDisputeMsg(e.target.value)} placeholder={t('Describe the missed punch')} /></label>
          <button className="btn btn-primary" type="submit">{t('Submit request')}</button>
          <h4 style={{ marginTop: 24 }}>{t('My requests')}</h4>
          <ul className="list">{disputes.filter((d) => d.staffId === myId).map((d) => (
            <li key={d.id}><div><strong>{d.date}</strong><span className="muted">{d.message}</span></div><Badge>{t(d.status)}</Badge></li>
          ))}</ul>
        </form>
      )}
    </div>
  );
}
