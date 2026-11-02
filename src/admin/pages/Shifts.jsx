import { useState } from 'react';
import { useT } from '../i18n.js';
import { useStore } from '../store.jsx';
import * as att from '../../api/attendance';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Shifts({ user }) {
  const { t } = useT();
  const { staff, setStaff } = useStore();
  const isAdmin = user.role === 'Admin';
  const [shifts, setShifts] = useState(att.listShifts());
  const [edit, setEdit] = useState(null);

  const save = (e) => {
    e.preventDefault();
    const next = edit.id ? shifts.map((s) => (s.id === edit.id ? edit : s)) : [...shifts, { ...edit, id: `SH-${Date.now()}` }];
    setShifts(next); att.saveShifts(next); setEdit(null);
  };

  const assignShift = (staffId, shiftId) => {
    setStaff((list) => list.map((s) => (s.id === staffId ? { ...s, shiftId } : s)));
  };

  const my = staff.find((s) => s.name === user.name || s.email === user.email);

  if (!isAdmin) {
    const shift = shifts.find((s) => s.id === my?.shiftId) || shifts[0];
    return (
      <div className="page">
        <div className="page-header"><h2>{t('My Shift / Roster')}</h2></div>
        <div className="card" style={{ maxWidth: 420 }}>
          <h3>{shift?.name}</h3>
          <p>{shift?.start} – {shift?.end}</p>
          <p className="muted">{t('Grace')}: {shift?.graceMins} {t('min')}</p>
          <p className="muted">{t('Weekly off')}: {(shift?.weeklyOff || []).map((d) => t(DAYS[d])).join(', ')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div><h2>{t('Shifts & Roster')}</h2><p className="muted">{t('Shift timings, weekly off, grace time')}</p></div>
        <button className="btn btn-primary" type="button" onClick={() => setEdit({ name: '', start: '09:00', end: '18:00', graceMins: 10, weeklyOff: [0] })}>{t('Add shift')}</button>
      </div>
      <div className="grid-2">
        <div className="card">
          <h3>{t('Shifts')}</h3>
          <table className="table">
            <thead><tr><th>{t('Name')}</th><th>{t('Timing')}</th><th>{t('Grace')}</th><th>{t('Weekly off')}</th><th /></tr></thead>
            <tbody>
              {shifts.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.start}–{s.end}</td>
                  <td>{s.graceMins} {t('min')}</td>
                  <td>{(s.weeklyOff || []).map((d) => DAYS[d]).join(', ')}</td>
                  <td><button className="btn btn-light" type="button" onClick={() => setEdit({ ...s })}>{t('Edit')}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3>{t('Staff roster')}</h3>
          <table className="table">
            <thead><tr><th>{t('Staff')}</th><th>{t('Shift')}</th></tr></thead>
            <tbody>
              {(staff || []).map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>
                    <select value={s.shiftId || shifts[0]?.id || ''} onChange={(e) => assignShift(s.id, e.target.value)}>
                      {shifts.map((sh) => <option key={sh.id} value={sh.id}>{sh.name}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {edit && (
        <form className="card" onSubmit={save} style={{ marginTop: 16, maxWidth: 480 }}>
          <h3>{edit.id ? t('Edit shift') : t('Add shift')}</h3>
          <label>{t('Name')}<input required value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label>
          <label>{t('Start')}<input type="time" value={edit.start} onChange={(e) => setEdit({ ...edit, start: e.target.value })} /></label>
          <label>{t('End')}<input type="time" value={edit.end} onChange={(e) => setEdit({ ...edit, end: e.target.value })} /></label>
          <label>{t('Grace')} ({t('min')})<input type="number" min={0} value={edit.graceMins} onChange={(e) => setEdit({ ...edit, graceMins: Number(e.target.value) })} /></label>
          <fieldset>
            <legend>{t('Weekly off')}</legend>
            {DAYS.map((d, i) => (
              <label key={d} style={{ marginRight: 12 }}>
                <input type="checkbox" checked={(edit.weeklyOff || []).includes(i)} onChange={(e) => {
                  const set = new Set(edit.weeklyOff || []);
                  e.target.checked ? set.add(i) : set.delete(i);
                  setEdit({ ...edit, weeklyOff: [...set].sort() });
                }} /> {t(d)}
              </label>
            ))}
          </fieldset>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" type="submit">{t('Save')}</button>
            <button className="btn btn-light" type="button" onClick={() => setEdit(null)}>{t('Cancel')}</button>
          </div>
        </form>
      )}
    </div>
  );
}
