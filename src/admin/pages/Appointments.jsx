import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Clock, ChevronLeft, ChevronRight, UserRound, Calendar } from 'lucide-react';
import { useStore } from '../store.jsx';
import {
  SERVICES, APPOINTMENT_STATUSES, TIME_SLOTS, TODAY, fmtDate, inr
} from '../data/mockData.js';
import { nextId, servicePrice } from '../utils.js';
import PageHeader from '../components/PageHeader.jsx';
import DataTable from '../components/DataTable.jsx';
import Badge from '../components/Badge.jsx';
import Modal from '../components/Modal.jsx';
import Field from '../components/Field.jsx';
import { useT } from '../i18n.js';

const SERVICE_ROLES = ['Skin Specialist', 'Hair Therapist', 'Beauty Specialist', 'Wellness Specialist'];
const addDays = (iso, n) => {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
const dayLabel = (iso, lang = 'en') => new Date(iso + 'T00:00:00').toLocaleDateString({ en: 'en-IN', ta: 'ta-IN' }[lang] || 'en-IN', { weekday: 'short', day: 'numeric' });
const monthStart = (iso) => {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(1);
  return d.toISOString().slice(0, 10);
};
const daysInMonth = (iso) => {
  const d = new Date(iso + 'T00:00:00');
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
};

export default function Appointments({ intent, onIntentHandled }) {
  const { appointments, setAppointments, approveAppointment, rejectAppointment, customers, staff, notify, user, sendMessage, addAudit } = useStore();
  const { t, lang } = useT();
  const [tab, setTab] = useState('schedule');
  const [viewMode, setViewMode] = useState('daily'); // daily | weekly | monthly
  const [date, setDate] = useState(TODAY);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('All');
  const [specialist, setSpecialist] = useState('All');
  const [openId, setOpenId] = useState(null);
  const [form, setForm] = useState(null);
  const [reschedule, setReschedule] = useState(null);
  const [errors, setErrors] = useState({});

  const specialists = staff.filter((s) => SERVICE_ROLES.includes(s.role));
  const staffName = (id) => staff.find((s) => s.id === id)?.name || t('Unassigned');
  const isBusy = (sid, d, t, ignore) => appointments.some((a) => a.id !== ignore && a.specialistId === sid && a.date === d && a.time === t && a.status !== 'Cancelled' && a.status !== 'No-Show');

  const blankForm = (time = '', d = date) => ({
    customerId: customers[0]?.id || '', service: SERVICES[0]?.name || '', date: d, time,
    specialistId: specialists[0]?.id || '', notes: ''
  });
  const openAdd = (time = '', d = date) => { setErrors({}); setForm(blankForm(time, d)); };

  useEffect(() => {
    if (intent === 'add') { openAdd(); onIntentHandled(); }
  }, [intent]);

  const filtered = useMemo(
    () =>
      appointments.filter((a) =>
        (status === 'All' || a.status === status) &&
        (specialist === 'All' || a.specialistId === specialist) &&
        (!q.trim() || `${a.customer} ${a.service} ${a.id}`.toLowerCase().includes(q.trim().toLowerCase()))
      ).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)),
    [appointments, q, status, specialist]
  );

  const listRows = useMemo(() => {
    if (tab === 'today') return filtered.filter((a) => a.date === TODAY);
    if (tab === 'upcoming') return filtered.filter((a) => a.date > TODAY);
    return filtered;
  }, [filtered, tab]);

  const open = appointments.find((a) => a.id === openId);
  const patch = (id, changes, message) => {
    if (user?.role === 'Staff' && changes.status) sendMessage(`${user.name} (Staff) marked appointment ${id} as ${changes.status}.`, 'appointments', user.name);
    setAppointments((list) => list.map((a) => (a.id === id ? { ...a, ...changes } : a)));
    notify(message);
    if (changes.status) {
      addAudit?.('Appointment status', `${id} → ${changes.status}`, user?.name || 'System');
      if (changes.status === 'Scheduled' || changes.status === 'Checked-In') {
        // SMS trigger for confirmation / check-in
        sendMessage(`SMS sent: Appointment ${id} ${changes.status.toLowerCase()}`, 'sms', user?.name || 'System');
      }
    }
  };

  const reassign = (a, sid) => {
    if (isBusy(sid, a.date, a.time, a.id)) {
      notify(`${staffName(sid)} already has an appointment at ${a.time} on ${fmtDate(a.date, lang)}.`, 'error');
      return;
    }
    patch(a.id, { specialistId: sid }, `${a.id} reassigned to ${staffName(sid)}.`);
    addAudit?.('Appointment reassign', `${a.id} → ${staffName(sid)}`, user?.name);
  };

  const doReschedule = () => {
    if (!reschedule) return;
    const e = {};
    if (!reschedule.date) e.date = 'Choose a date.';
    else if (reschedule.date < TODAY) e.date = 'Date cannot be in the past.';
    if (!reschedule.time) e.time = 'Pick a time slot.';
    else if (isBusy(reschedule.specialistId || open.specialistId, reschedule.date, reschedule.time, open.id)) e.time = 'Specialist already booked.';
    setErrors(e);
    if (Object.keys(e).length) { notify('Please fix the highlighted fields.', 'error'); return; }
    patch(open.id, {
      date: reschedule.date,
      time: reschedule.time,
      specialistId: reschedule.specialistId || open.specialistId,
      status: 'Rescheduled'
    }, `${open.id} rescheduled to ${fmtDate(reschedule.date, lang)} ${reschedule.time}.`);
    setReschedule(null);
    setOpenId(null);
  };

  const submit = () => {
    const e = {};
    if (!form.date) e.date = 'Choose a date.';
    else if (form.date < TODAY) e.date = 'Date cannot be in the past.';
    if (!form.time) e.time = 'Pick an available time slot.';
    else if (isBusy(form.specialistId, form.date, form.time)) e.time = 'This specialist is already booked at that time.';
    if (!form.specialistId) e.specialistId = 'Select a specialist.';
    setErrors(e);
    if (Object.keys(e).length) { notify('Please fix the highlighted fields.', 'error'); return; }
    const c = customers.find((x) => x.id === form.customerId);
    const appt = { id: nextId('APT', appointments, 3010), customerId: c.id, customer: c.name, service: form.service, date: form.date, time: form.time, specialistId: form.specialistId, status: 'Scheduled', notes: form.notes.trim() };
    setAppointments((list) => [...list, appt]);
    notify(`Appointment ${appt.id} booked for ${c.name}.`);
    addAudit?.('Appointment created', `${appt.id} for ${c.name}`, user?.name);
    sendMessage(`SMS: Appointment ${appt.id} scheduled for ${c.name} on ${form.date} at ${form.time}`, 'sms', user?.name);
    setDate(form.date);
    setForm(null);
  };

  // Daily strip (7 days around selected)
  const week = Array.from({ length: 7 }, (_, i) => addDays(date, i - 3));
  // Weekly grid (Mon-Sun of the week containing date)
  const weekStart = (() => {
    const d = new Date(date + 'T00:00:00');
    const day = d.getDay(); // 0 Sun
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d.toISOString().slice(0, 10);
  })();
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  // Monthly grid
  const mStart = monthStart(date);
  const mDays = daysInMonth(date);
  const firstDow = new Date(mStart + 'T00:00:00').getDay();
  const monthCells = [];
  for (let i = 0; i < (firstDow === 0 ? 6 : firstDow - 1); i++) monthCells.push(null);
  for (let d = 1; d <= mDays; d++) {
    const iso = `${date.slice(0, 8)}${String(d).padStart(2, '0')}`;
    monthCells.push(iso);
  }

  const dayAppts = appointments.filter((a) => a.date === date && a.status !== 'Cancelled' && a.status !== 'No-Show');

  const columns = [
    { key: 'when', label: t('Date and time'), render: (a) => <div><strong>{fmtDate(a.date, lang)}</strong><span className="muted block">{a.time}</span></div> },
    { key: 'customer', label: t('Customer'), render: (a) => <div><strong>{a.customer}</strong><span className="muted block">{a.id}</span></div> },
    { key: 'service', label: t('Service') },
    { key: 'specialist', label: t('Specialist'), render: (a) => staffName(a.specialistId) },
    { key: 'status', label: t('Status'), render: (a) => <Badge>{a.status}</Badge> }
  ];

  const tabs = [['schedule', t('Schedule')], ['today', t("Today's")], ['upcoming', t('Upcoming')], ['all', t('All appointments')]];

  return (
    <div className="page">
      <PageHeader title={t('Appointments')} subtitle={t('Plan the day, assign specialists and keep every booking on track.')}
        actions={<button className="btn btn-primary" onClick={() => openAdd()}><Plus size={17} />{t('New appointment')}</button>} />

      <div className="tabs" role="tablist">
        {tabs.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}
      </div>

      {tab === 'schedule' && (
        <div className="filters" style={{ marginBottom: 12 }}>
          <div className="chip-row">
            {['daily', 'weekly', 'monthly'].map((m) => (
              <button key={m} type="button" className={`chip ${viewMode === m ? 'active' : ''}`} onClick={() => setViewMode(m)}>
                {m === 'daily' ? t('Daily') : m === 'weekly' ? t('Weekly') : t('Monthly')}
              </button>
            ))}
          </div>
        </div>
      )}

      {tab !== 'schedule' && (
        <div className="filters">
          <div className="search-box"><Search size={17} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Search customer, service or ID')} aria-label={t('Search appointments')} /></div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t('Filter by status')}><option value="All">{t('All statuses')}</option>{APPOINTMENT_STATUSES.map((s) => <option key={s} value={s}>{t(s)}</option>)}</select>
          <select value={specialist} onChange={(e) => setSpecialist(e.target.value)} aria-label={t('Filter by specialist')}><option value="All">{t('All specialists')}</option>{specialists.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        </div>
      )}

      {tab === 'schedule' ? (
        <div className="card">
          {/* Navigation */}
          <div className="date-strip">
            <button className="icon-btn" onClick={() => setDate(addDays(date, viewMode === 'monthly' ? -30 : viewMode === 'weekly' ? -7 : -1))} aria-label={t('Previous')}><ChevronLeft size={18} /></button>
            <div className="date-chips" style={{ flex: 1, justifyContent: 'center' }}>
              {viewMode === 'daily' && week.map((d) => (
                <button key={d} className={`date-chip ${d === date ? 'active' : ''}`} onClick={() => setDate(d)}>
                  <span>{dayLabel(d, lang)}</span>
                  {d === TODAY && <em>{t('Today')}</em>}
                  <i>{appointments.filter((a) => a.date === d && a.status !== 'Cancelled' && a.status !== 'No-Show').length}</i>
                </button>
              ))}
              {viewMode === 'weekly' && (
                <strong>{fmtDate(weekStart, lang)} – {fmtDate(addDays(weekStart, 6))}</strong>
              )}
              {viewMode === 'monthly' && (
                <strong>{new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</strong>
              )}
            </div>
            <button className="icon-btn" onClick={() => setDate(addDays(date, viewMode === 'monthly' ? 30 : viewMode === 'weekly' ? 7 : 1))} aria-label={t('Next')}><ChevronRight size={18} /></button>
          </div>

          {viewMode === 'daily' && (
            <>
              <h3 className="section-title">{fmtDate(date, lang)} <span className="muted">{t('{n} booked, {m} slots free', { n: dayAppts.length, m: TIME_SLOTS.length - new Set(dayAppts.map((a) => a.time)).size })}</span></h3>
              <div className="schedule">
                {TIME_SLOTS.map((slot) => {
                  const items = dayAppts.filter((a) => a.time === slot);
                  return (
                    <div className="slot-row" key={slot}>
                      <span className="slot-time"><Clock size={14} />{slot}</span>
                      <div className="slot-body">
                        {items.map((a) => (
                          <button key={a.id} className={`appt-card st-${a.status.replace(/[\s-]/g, '').toLowerCase()}`} onClick={() => setOpenId(a.id)}>
                            <strong>{a.customer}</strong>
                            <span>{a.service}</span>
                            <span className="appt-meta"><UserRound size={13} />{staffName(a.specialistId)}</span>
                            <Badge>{a.status}</Badge>
                          </button>
                        ))}
                        {items.length === 0 && <button className="slot-free" onClick={() => openAdd(slot, date)}><Plus size={14} />{t('Available, book this slot')}</button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {viewMode === 'weekly' && (
            <div className="week-grid" style={{ display: 'grid', gridTemplateColumns: '80px repeat(7, 1fr)', gap: 4, overflowX: 'auto' }}>
              <div />
              {weekDays.map((d) => (
                <div key={d} style={{ textAlign: 'center', fontWeight: 600, padding: 6, background: d === TODAY ? 'var(--cream)' : 'transparent', borderRadius: 6 }}>
                  {dayLabel(d, lang)}
                  <div className="muted" style={{ fontSize: 12 }}>{appointments.filter((a) => a.date === d && a.status !== 'Cancelled').length} appts</div>
                </div>
              ))}
              {TIME_SLOTS.map((slot) => (
                <>
                  <div key={`t-${slot}`} className="slot-time" style={{ fontSize: 12, padding: 4 }}>{slot}</div>
                  {weekDays.map((d) => {
                    const items = appointments.filter((a) => a.date === d && a.time === slot && a.status !== 'Cancelled' && a.status !== 'No-Show');
                    return (
                      <div key={`${d}-${slot}`} style={{ minHeight: 36, border: '1px solid var(--line)', borderRadius: 4, padding: 2, cursor: 'pointer' }} onClick={() => items.length ? setOpenId(items[0].id) : openAdd(slot, d)}>
                        {items.map((a) => <div key={a.id} style={{ fontSize: 11, background: 'var(--cream)', borderRadius: 3, padding: '1px 4px', marginBottom: 1 }}>{a.customer.split(' ')[0]}</div>)}
                      </div>
                    );
                  })}
                </>
              ))}
            </div>
          )}

          {viewMode === 'monthly' && (
            <div className="month-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} style={{ textAlign: 'center', fontWeight: 600, padding: 6 }}>{t(d)}</div>)}
              {monthCells.map((iso, i) => {
                if (!iso) return <div key={`e-${i}`} />;
                const count = appointments.filter((a) => a.date === iso && a.status !== 'Cancelled').length;
                return (
                  <button key={iso} type="button" onClick={() => { setDate(iso); setViewMode('daily'); }}
                    style={{ minHeight: 64, border: '1px solid var(--line)', borderRadius: 6, padding: 6, textAlign: 'left', background: iso === TODAY ? 'var(--cream)' : iso === date ? '#f0cdd4' : '#fff' }}>
                    <strong>{Number(iso.slice(8))}</strong>
                    {count > 0 && <div className="muted" style={{ fontSize: 12 }}>{count} booking{count > 1 ? 's' : ''}</div>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="card flush"><DataTable columns={columns} rows={listRows} onRowClick={(a) => setOpenId(a.id)} empty={t('No appointments in this view.')} /></div>
      )}

      {open && !reschedule && (
        <Modal title={`Appointment ${open.id}`} subtitle={`${open.service} on ${fmtDate(open.date, lang)} at ${open.time}`} wide onClose={() => setOpenId(null)}
          footer={<>
            {open.status === 'Pending Review' && <><button className="btn btn-soft" onClick={() => { approveAppointment(open.id); notify(`${open.id} approved. The customer is notified.`); addAudit?.('Appointment approved', open.id, user?.name); }}>{t('Approve')}</button>
              <button className="btn btn-ghost" style={{ color: '#c62828' }} onClick={() => { rejectAppointment(open.id); notify(`${open.id} rejected.`); addAudit?.('Appointment rejected', open.id, user?.name); setOpenId(null); }}>{t('Reject')}</button></>}
            {open.status === 'Scheduled' && <button className="btn btn-soft" onClick={() => patch(open.id, { status: 'Checked-In' }, `${open.id} checked in.`)}>{t('Check in')}</button>}
            {open.status === 'Checked-In' && <button className="btn btn-soft" onClick={() => patch(open.id, { status: 'In Session' }, `${open.id} session started.`)}>{t('Start session')}</button>}
            {open.status === 'In Session' && <button className="btn btn-soft" onClick={() => patch(open.id, { status: 'Completed' }, `${open.id} completed (checked out).`)}>{t('Complete')}</button>}
            {['Scheduled', 'Checked-In', 'Rescheduled'].includes(open.status) && (
              <button className="btn btn-ghost" onClick={() => setReschedule({ date: open.date, time: open.time, specialistId: open.specialistId })}>{t('Reschedule')}</button>
            )}
            {open.status !== 'Cancelled' && open.status !== 'Completed' && open.status !== 'No-Show' && (
              <button className="btn btn-ghost" style={{ color: '#c62828' }} onClick={() => { patch(open.id, { status: 'Cancelled' }, `${open.id} cancelled.`); addAudit?.('Appointment cancelled', open.id, user?.name); }}>{t('Cancel')}</button>
            )}
            <button className="btn btn-primary" onClick={() => setOpenId(null)}>{t('Done')}</button>
          </>}>
          <div className="detail-grid">
            <div>
              <h4 className="mini-title">{t('Booking details')}</h4>
              <dl className="dl">
                <dt>{t('Customer')}</dt><dd>{open.customer}</dd>
                <dt>{t('Service')}</dt><dd>{open.service}</dd>
                <dt>{t('Price')}</dt><dd>{inr(open.price || servicePrice(open.service))}</dd>
                <dt>{t('Date')}</dt><dd>{fmtDate(open.date, lang)}, {open.time}</dd>
                <dt>{t('Specialist')}</dt><dd>{staffName(open.specialistId)}</dd>
                <dt>{t('Notes')}</dt><dd>{open.notes || t('No notes')}</dd>
              </dl>
            </div>
            <div>
              <h4 className="mini-title">{t('Manage')}</h4>
              <Field label={t('Status')}>
                <select value={open.status} onChange={(e) => patch(open.id, { status: e.target.value }, `${open.id} marked as ${e.target.value}.`)}>
                  {APPOINTMENT_STATUSES.map((s) => <option key={s} value={s}>{t(s)}</option>)}
                </select>
              </Field>
              <Field label={t('Assigned specialist')}>
                <select value={open.specialistId} onChange={(e) => reassign(open, e.target.value)}>
                  {specialists.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
                </select>
              </Field>
              <Badge>{open.status}</Badge>
            </div>
          </div>
        </Modal>
      )}

      {reschedule && open && (
        <Modal title={t('Reschedule appointment')} subtitle={`${open.id} – ${open.customer}`} wide onClose={() => setReschedule(null)}
          footer={<><button className="btn btn-ghost" onClick={() => setReschedule(null)}>{t('Cancel')}</button><button className="btn btn-primary" onClick={doReschedule}>{t('Save new slot')}</button></>}>
          <div className="form-grid">
            <Field label={t('Date')} error={errors.date}><input type="date" min={TODAY} value={reschedule.date} onChange={(e) => setReschedule({ ...reschedule, date: e.target.value, time: '' })} /></Field>
            <Field label={t('Specialist')}><select value={reschedule.specialistId} onChange={(e) => setReschedule({ ...reschedule, specialistId: e.target.value, time: '' })}>{specialists.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
          </div>
          <Field label={t('Available time slots')} error={errors.time}>
            <div className="chip-row">
              {TIME_SLOTS.map((slot) => {
                const busy = isBusy(reschedule.specialistId, reschedule.date, slot, open.id);
                return <button type="button" key={slot} disabled={busy} className={`chip ${reschedule.time === slot ? 'active' : ''}`} onClick={() => setReschedule({ ...reschedule, time: slot })}>{slot}</button>;
              })}
            </div>
          </Field>
        </Modal>
      )}

      {form && (
        <Modal title={t('New appointment')} subtitle={t('Choose an available slot for the selected specialist')} wide onClose={() => setForm(null)}
          footer={<><button className="btn btn-ghost" onClick={() => setForm(null)}>{t('Cancel')}</button><button className="btn btn-primary" onClick={submit}>{t('Book appointment')}</button></>}>
          <div className="form-grid">
            <Field label={t('Customer')}><select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
            <Field label={t('Service')}><select value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })}>{SERVICES.map((s) => <option key={s.name} value={s.name}>{s.name} - {inr(s.price)}</option>)}</select></Field>
            <Field label={t('Date')} error={errors.date}><input type="date" min={TODAY} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value, time: '' })} /></Field>
            <Field label={t('Specialist')} error={errors.specialistId}><select value={form.specialistId} onChange={(e) => setForm({ ...form, specialistId: e.target.value, time: '' })}>{specialists.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}</select></Field>
          </div>
          <Field label={t('Available time slots')} error={errors.time}>
            <div className="chip-row">
              {TIME_SLOTS.map((slot) => {
                const busy = isBusy(form.specialistId, form.date, slot);
                return <button type="button" key={slot} disabled={busy} className={`chip ${form.time === slot ? 'active' : ''}`} onClick={() => setForm({ ...form, time: slot })}>{slot}</button>;
              })}
            </div>
          </Field>
          <Field label={t('Notes (optional)')}><textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={t('Allergies, preferences or special requests')} /></Field>
        </Modal>
      )}
    </div>
  );
}
