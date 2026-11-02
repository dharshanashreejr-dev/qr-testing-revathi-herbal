import { useMemo, useState } from 'react';
import { useT } from '../i18n.js';
import { useStore } from '../store.jsx';
import Badge from '../components/Badge.jsx';
import * as att from '../../api/attendance';

export default function LeaveMgmt({ user }) {
  const { t } = useT();
  const { staff, addAudit } = useStore();
  const isAdmin = user.role === 'Admin';
  const [, tick] = useState(0);
  const refresh = () => tick((n) => n + 1);
  const list = att.listLeave();
  const holidays = att.listHolidays();
  const my = useMemo(() => (staff || []).find((s) => s.name === user.name || s.email === user.email), [staff, user]);
  const [form, setForm] = useState({ type: 'Casual', from: '', to: '', reason: '' });
  const [hol, setHol] = useState({ date: '', name: '' });
  const [tab, setTab] = useState(isAdmin ? 'Requests' : 'Apply');

  const daysBetween = (a, b) => {
    const d0 = new Date(a), d1 = new Date(b);
    return Math.max(1, Math.round((d1 - d0) / 86400000) + 1);
  };

  const apply = (e) => {
    e.preventDefault();
    if (!my) return alert(t('Staff profile not linked'));
    const days = daysBetween(form.from, form.to);
    att.applyLeave({ staffId: my.id, staffName: my.name, type: form.type, from: form.from, to: form.to, days, reason: form.reason });
    setForm({ type: 'Casual', from: '', to: '', reason: '' });
    refresh();
  };

  const bal = my ? att.getBalance(my.id) : null;

  return (
    <div className="page">
      <div className="page-header">
        <div><h2>{isAdmin ? t('Leave & Holidays') : t('Apply Leave')}</h2>
          <p className="muted">{isAdmin ? t('Approve leave and manage holiday calendar') : t('Request leave and track status')}</p></div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {(isAdmin ? ['Requests', 'Holidays'] : ['Apply', 'My requests', 'Holidays']).map((x) => (
          <button key={x} type="button" className={`btn ${tab === x ? 'btn-primary' : 'btn-light'}`} onClick={() => setTab(x)}>{t(x)}</button>
        ))}
      </div>

      {tab === 'Apply' && !isAdmin && (
        <div className="grid-2">
          <form className="card" onSubmit={apply}>
            <h3>{t('New leave request')}</h3>
            {bal && <p className="muted">{t('Balance')}: CL {bal.casual} · SL {bal.sick} · EL {bal.earned}</p>}
            <label>{t('Type')}<select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option>Casual</option><option>Sick</option><option>Earned</option><option>Unpaid</option>
            </select></label>
            <label>{t('From')}<input type="date" required value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} /></label>
            <label>{t('To')}<input type="date" required value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} /></label>
            <label>{t('Reason')}<textarea required rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></label>
            <button className="btn btn-primary" type="submit">{t('Submit')}</button>
          </form>
        </div>
      )}

      {(tab === 'Requests' || tab === 'My requests') && (
        <div className="card">
          <table className="table">
            <thead><tr><th>{t('Staff')}</th><th>{t('Type')}</th><th>{t('From')}</th><th>{t('To')}</th><th>{t('Days')}</th><th>{t('Status')}</th><th /></tr></thead>
            <tbody>
              {list.filter((l) => isAdmin || l.staffId === my?.id).map((l) => (
                <tr key={l.id}>
                  <td>{l.staffName}</td><td>{l.type}</td><td>{l.from}</td><td>{l.to}</td><td>{l.days}</td>
                  <td><Badge>{t(l.status)}</Badge></td>
                  <td>
                    {isAdmin && l.status === 'Pending' && (
                      <>
                        <button type="button" className="btn btn-light" onClick={() => { att.decideLeave(l.id, 'Approved', user.name); addAudit?.('Leave approved', `${l.staffName} ${l.from}`, user.name); refresh(); }}>{t('Approve')}</button>
                        <button type="button" className="btn btn-light" onClick={() => { att.decideLeave(l.id, 'Rejected', user.name); refresh(); }}>{t('Reject')}</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'Holidays' && (
        <div className="grid-2">
          <div className="card">
            <h3>{t('Holiday calendar')}</h3>
            <ul className="list">{holidays.map((h) => (
              <li key={h.id}><strong>{h.date}</strong><span className="muted">{h.name}</span></li>
            ))}</ul>
          </div>
          {isAdmin && (
            <form className="card" onSubmit={(e) => {
              e.preventDefault();
              const next = [...holidays, { id: `H-${Date.now()}`, ...hol }];
              att.saveHolidays(next); setHol({ date: '', name: '' }); refresh();
            }}>
              <h3>{t('Add holiday')}</h3>
              <label>{t('Date')}<input type="date" required value={hol.date} onChange={(e) => setHol({ ...hol, date: e.target.value })} /></label>
              <label>{t('Name')}<input required value={hol.name} onChange={(e) => setHol({ ...hol, name: e.target.value })} /></label>
              <button className="btn btn-primary" type="submit">{t('Save')}</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
