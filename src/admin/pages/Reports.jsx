import { useMemo, useState } from 'react';
import { Download, IndianRupee, Package, CalendarCheck, ShoppingBag, Receipt, FlaskConical, UserCheck, Clock, Wallet } from 'lucide-react';
import { useStore } from '../store.jsx';
import { api } from '../../api';
import { inr, ORDER_STATUSES, SERVICES } from '../data/mockData.js';
import { revenueSeries, productRevenue, appointmentRevenue, orderTotal, countsAsRevenue, productOf, downloadCsv } from '../utils.js';
import PageHeader from '../components/PageHeader.jsx';
import StatCard from '../components/StatCard.jsx';
import Badge from '../components/Badge.jsx';
import { BarChart, Donut, HBars, chartColor } from '../components/Charts.jsx';
import { useT } from '../i18n.js';
import * as att from '../../api/attendance';
import * as pay from '../../api/payroll';

const RANGES = [
  { id: '3', label: 'Last 3 months', n: 3 },
  { id: '6', label: 'Last 6 months', n: 6 },
  { id: '7', label: 'April to October', n: 7 },
  { id: '1', label: 'Current month (October)', n: 1 }
];


// ---- HR report rules (assumptions: confirm with the MD before going live) ----
const HALF_DAY_HOURS = 4.5;   // worked less than this = half day
const OT_MIN_MINS = 30;       // overtime counts only after this many minutes beyond shift end
const pad = (n) => String(n).padStart(2, '0');
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthNow = () => dateKey(new Date()).slice(0, 7);
const mins = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '');

/** Build per-staff monthly attendance from punches, shifts, leave and holidays (mock). BACKEND: GET /api/reports/attendance?month= */
function buildMonth(month, staff) {
  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const todayKey = dateKey(new Date());
  const shifts = att.listShifts();
  const holidays = new Set(att.listHolidays().map((h) => h.date));
  const leave = att.listLeave().filter((l) => l.status === 'Approved');
  const punches = att.listPunches();
  return (staff || []).map((s) => {
    const shift = shifts.find((x) => x.id === s.shiftId) || shifts[0];
    const row = { staffId: s.id, name: s.name, shift: shift?.name || '', present: 0, late: 0, half: 0, absent: 0, leave: 0, off: 0, holiday: 0, lateMins: 0, otMins: 0, lateDays: [], workedDays: 0 };
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${month}-${pad(d)}`;
      if (key > todayKey) break;
      const wd = new Date(y, m - 1, d).getDay();
      if (shift?.weeklyOff?.includes(wd)) { row.off++; continue; }
      if (holidays.has(key)) { row.holiday++; continue; }
      if (leave.some((l) => l.staffId === s.id && l.from <= key && l.to >= key)) { row.leave++; continue; }
      const mine = punches.filter((p) => p.staffId === s.id && dateKey(new Date(p.at)) === key).sort((a, b) => a.at.localeCompare(b.at));
      const inn = mine.find((p) => p.type === 'IN');
      if (!inn) { row.absent++; continue; }
      const out = [...mine].reverse().find((p) => p.type === 'OUT');
      row.workedDays++;
      const inD = new Date(inn.at);
      const inMin = inD.getHours() * 60 + inD.getMinutes();
      const lateBy = shift ? inMin - (mins(shift.start) + shift.graceMins) : 0;
      let isHalf = false;
      if (out) {
        const outD = new Date(out.at);
        const outMin = outD.getHours() * 60 + outD.getMinutes();
        if ((outMin - inMin) / 60 < HALF_DAY_HOURS) isHalf = true;
        if (shift && !isHalf) {
          const ot = outMin - mins(shift.end);
          if (ot >= OT_MIN_MINS) row.otMins += ot;
        }
      }
      if (isHalf) row.half++;
      else if (lateBy > 0) { row.late++; row.lateMins += lateBy; row.lateDays.push(key.slice(8)); }
      else row.present++;
      if (isHalf && lateBy > 0) { row.lateMins += lateBy; row.lateDays.push(key.slice(8)); }
    }
    row.payable = row.present + row.late + row.half * 0.5 + row.leave + row.off + row.holiday;
    return row;
  });
}

/** Demo only: add sample punches for the past days of a month so the HR reports have data. */
function seedMonthPunches(month, staff) {
  const [y, m] = month.split('-').map(Number);
  const todayKey = dateKey(new Date());
  const shifts = att.listShifts();
  (staff || []).forEach((s, si) => {
    const shift = shifts.find((x) => x.id === s.shiftId) || shifts[0];
    const [sh, sm] = (shift?.start || '09:00').split(':').map(Number);
    const [eh, em] = (shift?.end || '18:00').split(':').map(Number);
    for (let d = 1; d <= new Date(y, m, 0).getDate(); d++) {
      const key = `${month}-${pad(d)}`;
      if (key >= todayKey) break;
      const wd = new Date(y, m - 1, d).getDay();
      if (shift?.weeklyOff?.includes(wd)) continue;
      const seed = (d * 7 + si * 13) % 11;
      if (seed === 0) continue;                       // absent
      const lateAdd = seed % 4 === 1 ? 25 + (seed * 3) : (seed % 3);   // some late days
      const inn = new Date(y, m - 1, d, sh, sm + lateAdd);
      const half = seed === 5;
      const out = half ? new Date(y, m - 1, d, sh + 4, sm) : new Date(y, m - 1, d, eh, em + (seed % 5 === 2 ? 55 : 3));
      att.addPunch({ staffId: s.id, staffName: s.name, at: inn.toISOString(), type: 'IN', source: 'Device', deviceId: 'DEV-01', note: 'sample' });
      att.addPunch({ staffId: s.id, staffName: s.name, at: out.toISOString(), type: 'OUT', source: 'Device', deviceId: 'DEV-01', note: 'sample' });
    }
  });
}

export default function Reports() {
  const { orders, appointments, products, staff, notify } = useStore();
  const { t, lang } = useT();
  const [range, setRange] = useState('7');
  const [hrMonth, setHrMonth] = useState(monthNow());
  const [hrTick, setHrTick] = useState(0);

  const all = useMemo(() => revenueSeries(orders, appointments, products), [orders, appointments, products]);
  const series = all.slice(-RANGES.find((r) => r.id === range).n);
  const sum = (key) => series.reduce((s, m) => s + m[key], 0);
  const productSales = sum('products');
  const serviceRevenue = sum('appointments');
  const totalRevenue = productSales + serviceRevenue;

  const paidOrders = orders.filter(countsAsRevenue);
  const aov = paidOrders.length ? Math.round(productRevenue(orders, products) / paidOrders.length) : 0;

  const revenueByProduct = useMemo(() => {
    const map = {};
    paidOrders.forEach((o) => o.items.forEach((i) => {
      const p = productOf(products, i.productId);
      if (p) map[p.name] = (map[p.name] || 0) + p.price * i.qty;
    }));
    return Object.entries(map).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [paidOrders, products]);

  const byService = SERVICES.map((s, i) => ({ label: t(s.name) !== s.name ? t(s.name) : s.name, value: appointments.filter((a) => a.service === s.name && a.status !== 'Cancelled').length, color: chartColor(i) }));
  const byOrderStatus = ORDER_STATUSES.map((s) => ({ label: t(s), value: orders.filter((o) => o.status === s).length }));
  const posSummary = api.pos.posRevenueSummary();

  const exportCsv = () => {
    const rows = [
      ['Revathi Herbal Beauty Care - Revenue report (SAMPLE / DEMO DATA)'],
      ['Range', RANGES.find((r) => r.id === range).label],
      [],
      ['Month', 'Product sales (INR)', 'Appointment revenue (INR)', 'Total (INR)'],
      ...series.map((m) => [m.month, m.products, m.appointments, m.total]),
      [],
      ['Orders', 'Customer', 'Payment', 'Status', 'Total (INR)'],
      ...orders.map((o) => [o.id, o.customer, o.payment, o.status, orderTotal(o, products)])
    ];
    downloadCsv('maison-bloom-demo-report.csv', rows);
    notify('Demo report exported as a CSV file.');
  };

  // ---- HR reports ----
  const hrRows = useMemo(() => buildMonth(hrMonth, staff), [hrMonth, staff, hrTick]);
  const lateRows = hrRows.filter((r) => r.late > 0 || r.lateMins > 0).sort((a, b) => b.lateMins - a.lateMins);
  const otRows = hrRows.filter((r) => r.otMins > 0).sort((a, b) => b.otMins - a.otMins);
  const payRun = useMemo(() => {
    const saved = pay.getRun(hrMonth);
    if (saved) return { ...saved, preview: false };
    const map = {}; hrRows.forEach((r) => { map[r.staffId] = r.payable; });
    return { ...pay.previewRun(hrMonth, (staff || []).map((s) => ({ id: s.id, name: s.name })), map), preview: true };
  }, [hrMonth, hrRows, staff, hrTick]);
  const totalLateMarks = hrRows.reduce((n, r) => n + r.late, 0);
  const totalOtHours = hrRows.reduce((n, r) => n + r.otMins, 0) / 60;
  const totalNet = payRun.lines.reduce((n, l) => n + l.net, 0);
  const presentTotal = hrRows.reduce((n, r) => n + r.present + r.late + r.half, 0);
  const hasMonthData = att.listPunches().some((p) => dateKey(new Date(p.at)).slice(0, 7) === hrMonth && dateKey(new Date(p.at)) !== dateKey(new Date()));
  const hm = (m) => `${Math.floor(m / 60)}h ${m % 60}m`;

  const exportAttendance = () => {
    downloadCsv(`attendance-${hrMonth}.csv`, [
      ['Revathi Herbal Beauty Care - Monthly attendance', hrMonth],
      ['Staff', 'Shift', 'Present', 'Late', 'Half day', 'Absent', 'Leave', 'Weekly off', 'Holiday', 'Late minutes', 'OT hours', 'Payable days'],
      ...hrRows.map((r) => [r.name, r.shift, r.present, r.late, r.half, r.absent, r.leave, r.off, r.holiday, r.lateMins, (r.otMins / 60).toFixed(1), r.payable])
    ]);
    notify('Attendance report exported as CSV.');
  };
  const exportLate = () => {
    downloadCsv(`late-comers-${hrMonth}.csv`, [
      ['Staff', 'Late days', 'Total late minutes', 'Dates (day of month)'],
      ...lateRows.map((r) => [r.name, r.late, r.lateMins, r.lateDays.join(' ')])
    ]);
    notify('Late-comers report exported as CSV.');
  };
  const exportOt = () => {
    downloadCsv(`overtime-${hrMonth}.csv`, [
      ['Staff', 'OT hours'],
      ...otRows.map((r) => [r.name, (r.otMins / 60).toFixed(1)])
    ]);
    notify('Overtime report exported as CSV.');
  };
  const exportPayroll = () => {
    downloadCsv(`payroll-summary-${hrMonth}.csv`, [
      ['Month', 'Status', 'Staff', 'Paid days', 'Basic', 'HRA', 'Incentive', 'Advances', 'Deductions', 'Net pay'],
      ...payRun.lines.map((l) => [hrMonth, payRun.preview ? 'Preview (not saved)' : payRun.status, l.staffName, l.paidDays, l.base, l.hra, l.incentive, l.advances, l.deductions, l.net])
    ]);
    notify('Payroll summary exported as CSV.');
  };
  const addSample = () => { seedMonthPunches(hrMonth, staff); setHrTick((x) => x + 1); notify('Sample punches added for this month (demo).'); };

  return (
    <div className="page">
      <PageHeader title={t('Revenue and reports')} subtitle={t('Sample data for presentation. No accounting system is connected.')}
        actions={
          <>
            <label className="select-inline"><span>{t('Date range')}</span>
              <select value={range} onChange={(e) => setRange(e.target.value)}>{RANGES.map((r) => <option key={r.id} value={r.id}>{t(r.label)}</option>)}</select>
            </label>
            <button className="btn btn-primary" onClick={exportCsv}><Download size={17} />{t('Export report')}</button>
          </>
        } />
      <div className="stat-grid">
        <StatCard icon={IndianRupee} label={t('Total revenue')} value={inr(totalRevenue)} hint={t(RANGES.find((r) => r.id === range).label)} tone="forest" />
        <StatCard icon={Package} label={t('Product sales')} value={inr(productSales)} tone="rose" />
        <StatCard icon={CalendarCheck} label={t('Appointment revenue')} value={inr(serviceRevenue)} tone="sage" />
        <StatCard icon={ShoppingBag} label={t('Total orders')} value={orders.length} hint={t('{n} paid', { n: paidOrders.length })} tone="sand" />
        <StatCard icon={Receipt} label={t('Average order value')} value={inr(aov)} hint={t('Paid orders')} tone="amber" />
        <StatCard icon={CalendarCheck} label={t('Completed services')} value={appointments.filter((a) => a.status === 'Completed').length} hint={t('{amount} this month', { amount: inr(appointmentRevenue(appointments)) })} tone="sage" />
      </div>

      <div className="card" style={{ marginBottom: 22 }}>
        <div className="card-head">
          <h3>{t('POS billing (GST)')}</h3>
          <span className="muted">{t('{n} invoices', { n: posSummary.count })}</span>
        </div>
        <div className="stat-grid four" style={{ marginBottom: 0 }}>
          <StatCard icon={Receipt} label={t('POS total')} value={inr(posSummary.total)} tone="forest" />
          <StatCard icon={IndianRupee} label="CGST collected" value={inr(posSummary.cgst)} tone="sage" />
          <StatCard icon={IndianRupee} label="SGST collected" value={inr(posSummary.sgst)} tone="sage" />
          <StatCard icon={ShoppingBag} label={t('Invoices')} value={posSummary.count} hint={Object.entries(posSummary.byPay).map(([k, v]) => `${k}: ${inr(v)}`).join(' · ') || '—'} tone="sand" />
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head"><h3>{t('Revenue by month')}</h3><span className="muted">{t('INR, sample data')}</span></div>
          <BarChart data={series} xKey="month" stacked series={[{ key: 'products', label: t('Product sales'), color: '#e3a3ac' }, { key: 'appointments', label: t('Appointments'), color: '#963f55' }]} />
        </div>
        <div className="card">
          <div className="card-head"><h3>{t('Product sales chart')}</h3><span className="muted">{t('Revenue by product')}</span></div>
          <HBars data={revenueByProduct} format={inr} />
        </div>
        <div className="card">
          <div className="card-head"><h3>{t('Appointment statistics')}</h3><span className="muted">{t('Bookings by service')}</span></div>
          <Donut data={byService} centerLabel="Bookings" centerValue={byService.reduce((s, d) => s + d.value, 0)} />
        </div>
        <div className="card">
          <div className="card-head"><h3>{t('Order status summary')}</h3><span className="muted">{t('All orders')}</span></div>
          <Donut data={byOrderStatus} centerLabel="Orders" centerValue={orders.length} />
          <div className="chip-row summary-badges">{byOrderStatus.map((s) => <span key={s.label} className="row-gap"><Badge>{s.label}</Badge><strong>{s.value}</strong></span>)}</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-head">
          <h3>{t('HR reports')}</h3>
          <label className="select-inline"><span>{t('Month')}</span>
            <input type="month" value={hrMonth} max={monthNow()} onChange={(e) => e.target.value && setHrMonth(e.target.value)} />
          </label>
        </div>
        <p className="muted">{t('Monthly attendance, late-comers, overtime and payroll summary (demo data). Rules used: grace time from the shift, half day if worked under 4.5 hours, overtime after 30 minutes past shift end. Confirm these rules with the MD.')}</p>
        {!hasMonthData && (
          <div style={{ margin: '10px 0' }}>
            <button type="button" className="btn btn-light" onClick={addSample}>{t('Add sample month data (demo)')}</button>
          </div>
        )}
        <div className="stat-grid four" style={{ margin: '14px 0' }}>
          <StatCard icon={UserCheck} label={t('Present days')} value={presentTotal} hint={hrMonth} tone="sage" />
          <StatCard icon={Clock} label={t('Late marks')} value={totalLateMarks} hint={t('Beyond grace time')} tone="amber" />
          <StatCard icon={Clock} label={t('Overtime')} value={`${totalOtHours.toFixed(1)} h`} hint={t('All staff')} tone="sand" />
          <StatCard icon={Wallet} label={t('Payroll net total')} value={inr(totalNet)} hint={payRun.preview ? t('Preview, not saved') : t(payRun.status)} tone="forest" />
        </div>

        <div className="card-head" style={{ marginTop: 8 }}><h3>{t('Monthly attendance')}</h3>
          <button type="button" className="btn btn-light" onClick={exportAttendance}><Download size={16} />{t('Export attendance CSV')}</button></div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead><tr><th>{t('Staff')}</th><th>{t('Present')}</th><th>{t('Late')}</th><th>{t('Half day')}</th><th>{t('Absent')}</th><th>{t('Leave')}</th><th>{t('Weekly off')}</th><th>{t('Holiday')}</th><th>{t('OT')}</th><th>{t('Payable days')}</th></tr></thead>
            <tbody>
              {hrRows.map((r) => (
                <tr key={r.staffId}><td>{r.name}</td><td>{r.present}</td><td>{r.late}</td><td>{r.half}</td><td>{r.absent}</td><td>{r.leave}</td><td>{r.off}</td><td>{r.holiday}</td><td>{(r.otMins / 60).toFixed(1)} h</td><td><strong>{r.payable}</strong></td></tr>
              ))}
              {!hrRows.length && <tr><td colSpan={10} className="muted">{t('No staff found')}</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="grid-2" style={{ marginTop: 18 }}>
          <div>
            <div className="card-head"><h3>{t('Late-comers')}</h3>
              <button type="button" className="btn btn-light" onClick={exportLate}><Download size={16} />{t('Export')}</button></div>
            <table className="table">
              <thead><tr><th>{t('Staff')}</th><th>{t('Late days')}</th><th>{t('Total late')}</th></tr></thead>
              <tbody>
                {lateRows.map((r) => <tr key={r.staffId}><td>{r.name}</td><td>{r.late}</td><td>{hm(r.lateMins)}</td></tr>)}
                {!lateRows.length && <tr><td colSpan={3} className="muted">{t('No late marks this month')}</td></tr>}
              </tbody>
            </table>
          </div>
          <div>
            <div className="card-head"><h3>{t('Overtime')}</h3>
              <button type="button" className="btn btn-light" onClick={exportOt}><Download size={16} />{t('Export')}</button></div>
            <table className="table">
              <thead><tr><th>{t('Staff')}</th><th>{t('OT hours')}</th></tr></thead>
              <tbody>
                {otRows.map((r) => <tr key={r.staffId}><td>{r.name}</td><td>{(r.otMins / 60).toFixed(1)} h</td></tr>)}
                {!otRows.length && <tr><td colSpan={2} className="muted">{t('No overtime this month')}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card-head" style={{ marginTop: 18 }}>
          <h3>{t('Payroll summary')} <span className="muted" style={{ fontSize: 13 }}>{payRun.preview ? `· ${t('Preview, not saved')}` : `· ${t(payRun.status)}`}</span></h3>
          <button type="button" className="btn btn-light" onClick={exportPayroll}><Download size={16} />{t('Export payroll CSV')}</button></div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead><tr><th>{t('Staff')}</th><th>{t('Paid days')}</th><th>{t('Basic')}</th><th>HRA</th><th>{t('Incentive')}</th><th>{t('Advances')}</th><th>{t('Deductions')}</th><th>{t('Net pay')}</th></tr></thead>
            <tbody>
              {payRun.lines.map((l) => (
                <tr key={l.staffId}><td>{l.staffName}</td><td>{l.paidDays}</td><td>{inr(l.base)}</td><td>{inr(l.hra)}</td><td>{inr(l.incentive)}</td><td>{inr(l.advances)}</td><td>{inr(l.deductions)}</td><td><strong>{inr(l.net)}</strong></td></tr>
              ))}
              {!payRun.lines.length && <tr><td colSpan={8} className="muted">{t('No staff found')}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
</div>
  );
}
