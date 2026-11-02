import { useMemo, useState } from 'react';
import { useT } from '../i18n.js';
import { useStore } from '../store.jsx';
import Badge from '../components/Badge.jsx';
import * as pay from '../../api/payroll';
const { HRA_ENABLED } = pay;
import { monthKey } from '../../api/attendance';

export default function PayrollHub({ user }) {
  const { t } = useT();
  const { staff, addAudit } = useStore();
  const isAdmin = user.role === 'Admin';
  const [tab, setTab] = useState(isAdmin ? 'Run' : 'My payslips');
  const [month, setMonth] = useState(monthKey());
  const [, tick] = useState(0);
  const refresh = () => tick((n) => n + 1);
  const my = useMemo(() => (staff || []).find((s) => s.name === user.name || s.email === user.email), [staff, user]);
  const run = pay.getRun(month);
  const [adv, setAdv] = useState({ staffId: '', amount: 1000, reason: '', month });
  const [ded, setDed] = useState({ staffId: '', amount: 500, reason: '', month });
  const [salEdit, setSalEdit] = useState(null);

  const presentMap = useMemo(() => {
    const m = {};
    (staff || []).forEach((s) => { m[s.id] = 22; });
    return m;
  }, [staff]);

  const openPayslip = (line) => {
    const html = pay.payslipHtml(line, month);
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  };

  const buildPreview = () => {
    const preview = pay.previewRun(month, (staff || []).map((s) => ({ id: s.id, name: s.name })), presentMap);
    pay.saveRun(preview);
    addAudit?.('Payroll preview', month, user.name);
    refresh();
  };

  if (!isAdmin) {
    const myLines = pay.listRuns().flatMap((r) => r.lines.filter((l) => l.staffId === my?.id).map((l) => ({ ...l, month: r.month, status: r.status })));
    return (
      <div className="page">
        <div className="page-header"><h2>{t('My Payslips')}</h2></div>
        <div className="card">
          <table className="table">
            <thead><tr><th>{t('Month')}</th><th>{t('Net')}</th><th>{t('Status')}</th><th /></tr></thead>
            <tbody>
              {myLines.map((l) => (
                <tr key={l.month + l.staffId}>
                  <td>{l.month}</td>
                  <td>₹{l.net.toLocaleString('en-IN')}</td>
                  <td><Badge>{t(l.status)}</Badge></td>
                  <td><button type="button" className="btn btn-light" onClick={() => openPayslip(l)}>{t('Download PDF')}</button></td>
                </tr>
              ))}
              {!myLines.length && <tr><td colSpan={4} className="muted">{t('No payslips yet')}</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card" style={{ marginTop: 16 }}>
          <h3>{t('My incentive / commission')}</h3>
          <p className="muted">{t('Based on salary incentive % and services completed (mock).')}</p>
          <p><strong>{pay.getSalary(my?.id || '').incentivePct}%</strong> {t('of earnings components')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div><h2>{t('Payroll')}</h2><p className="muted">{t('Salary structure, monthly run, payslips, advances')}</p></div>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {['Run', 'Structure', 'Payslips', 'Advances'].map((x) => (
          <button key={x} type="button" className={`btn ${tab === x ? 'btn-primary' : 'btn-light'}`} onClick={() => setTab(x)}>{t(x)}</button>
        ))}
      </div>

      {tab === 'Run' && (
        <div className="card">
          <div className="card-head">
            <h3>{t('Monthly run')} · {month}</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-light" onClick={buildPreview}>{t('Generate preview')}</button>
              <button type="button" className="btn btn-light" disabled={!run || run.status === 'Locked'} onClick={() => { pay.approveRun(month, user.name); addAudit?.('Payroll approved', month, user.name); refresh(); }}>{t('Approve')}</button>
              <button type="button" className="btn btn-primary" disabled={!run || run.status !== 'Approved'} onClick={() => { pay.lockRun(month); addAudit?.('Payroll locked', month, user.name); refresh(); }}>{t('Lock month')}</button>
            </div>
          </div>
          {run && <p><Badge>{t(run.status)}</Badge></p>}
          <table className="table">
            <thead><tr><th>{t('Staff')}</th><th>{t('Base')}</th>{HRA_ENABLED && <th>{t('HRA')}</th>}<th>{t('Incentive')}</th><th>{t('Adv / Ded')}</th><th>{t('Net')}</th></tr></thead>
            <tbody>
              {(run?.lines || []).map((l) => (
                <tr key={l.staffId}>
                  <td>{l.staffName}</td>
                  <td>₹{l.base.toLocaleString('en-IN')}</td>
                  {HRA_ENABLED && <td>₹{l.hra.toLocaleString('en-IN')}</td>}
                  <td>₹{l.incentive.toLocaleString('en-IN')}</td>
                  <td>-₹{(l.advances + l.deductions).toLocaleString('en-IN')}</td>
                  <td><strong>₹{l.net.toLocaleString('en-IN')}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'Structure' && (
        <div className="card">
          <table className="table">
            <thead><tr><th>{t('Staff')}</th><th>{t('Base')}</th>{HRA_ENABLED && <th>{t('HRA')}</th>}<th>{t('Incentive %')}</th><th>{t('Bank')}</th><th /></tr></thead>
            <tbody>
              {(staff || []).map((s) => {
                const sal = pay.getSalary(s.id);
                return (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>₹{sal.base.toLocaleString('en-IN')}</td>
                    {HRA_ENABLED && <td>₹{sal.hra.toLocaleString('en-IN')}</td>}
                    <td>{sal.incentivePct}%</td>
                    <td className="muted">{sal.bankName || '—'} {sal.accountNo ? `··${String(sal.accountNo).slice(-4)}` : ''}</td>
                    <td><button type="button" className="btn btn-light" onClick={() => setSalEdit({ ...sal, staffId: s.id, name: s.name })}>{t('Edit')}</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {salEdit && (
            <form className="card" style={{ marginTop: 12, maxWidth: 420 }} onSubmit={(e) => {
              e.preventDefault();
              pay.setSalary({ staffId: salEdit.staffId, base: Number(salEdit.base), hra: HRA_ENABLED ? Number(salEdit.hra) : 0, incentivePct: Number(salEdit.incentivePct), bankName: salEdit.bankName, accountNo: salEdit.accountNo, ifsc: salEdit.ifsc });
              setSalEdit(null); refresh();
            }}>
              <h3>{salEdit.name}</h3>
              <label>{t('Base')}<input type="number" value={salEdit.base} onChange={(e) => setSalEdit({ ...salEdit, base: e.target.value })} /></label>
              {HRA_ENABLED && <label>{t('HRA')}<input type="number" value={salEdit.hra} onChange={(e) => setSalEdit({ ...salEdit, hra: e.target.value })} /></label>}
              <label>{t('Incentive %')}<input type="number" value={salEdit.incentivePct} onChange={(e) => setSalEdit({ ...salEdit, incentivePct: e.target.value })} /></label>
              <label>{t('Bank')}<input value={salEdit.bankName || ''} onChange={(e) => setSalEdit({ ...salEdit, bankName: e.target.value })} /></label>
              <label>{t('Account')}<input value={salEdit.accountNo || ''} onChange={(e) => setSalEdit({ ...salEdit, accountNo: e.target.value })} /></label>
              <label>{t('IFSC')}<input value={salEdit.ifsc || ''} onChange={(e) => setSalEdit({ ...salEdit, ifsc: e.target.value })} /></label>
              <button className="btn btn-primary" type="submit">{t('Save')}</button>
            </form>
          )}
        </div>
      )}

      {tab === 'Payslips' && (
        <div className="card">
          <div className="card-head">
            <h3>{t('Payslips')} · {month}</h3>
            <button type="button" className="btn btn-light" disabled={!run} onClick={() => (run?.lines || []).forEach(openPayslip)}>{t('Bulk download')}</button>
          </div>
          <table className="table">
            <thead><tr><th>{t('Staff')}</th><th>{t('Net')}</th><th /></tr></thead>
            <tbody>
              {(run?.lines || []).map((l) => (
                <tr key={l.staffId}>
                  <td>{l.staffName}</td>
                  <td>₹{l.net.toLocaleString('en-IN')}</td>
                  <td><button type="button" className="btn btn-light" onClick={() => openPayslip(l)}>{t('PDF')}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'Advances' && (
        <div className="grid-2">
          <form className="card" onSubmit={(e) => {
            e.preventDefault();
            const s = staff.find((x) => x.id === adv.staffId);
            if (!s) return;
            pay.addAdvance({ staffId: s.id, staffName: s.name, amount: Number(adv.amount), reason: adv.reason, month: adv.month });
            refresh();
          }}>
            <h3>{t('Add advance')}</h3>
            <label>{t('Staff')}<select required value={adv.staffId} onChange={(e) => setAdv({ ...adv, staffId: e.target.value })}>
              <option value="">{t('Select')}</option>
              {(staff || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select></label>
            <label>{t('Amount')}<input type="number" value={adv.amount} onChange={(e) => setAdv({ ...adv, amount: e.target.value })} /></label>
            <label>{t('Month')}<input type="month" value={adv.month} onChange={(e) => setAdv({ ...adv, month: e.target.value })} /></label>
            <label>{t('Reason')}<input required value={adv.reason} onChange={(e) => setAdv({ ...adv, reason: e.target.value })} /></label>
            <button className="btn btn-primary" type="submit">{t('Save')}</button>
          </form>
          <form className="card" onSubmit={(e) => {
            e.preventDefault();
            const s = staff.find((x) => x.id === ded.staffId);
            if (!s) return;
            pay.addDeduction({ staffId: s.id, staffName: s.name, amount: Number(ded.amount), reason: ded.reason, month: ded.month });
            refresh();
          }}>
            <h3>{t('Add deduction')}</h3>
            <label>{t('Staff')}<select required value={ded.staffId} onChange={(e) => setDed({ ...ded, staffId: e.target.value })}>
              <option value="">{t('Select')}</option>
              {(staff || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select></label>
            <label>{t('Amount')}<input type="number" value={ded.amount} onChange={(e) => setDed({ ...ded, amount: e.target.value })} /></label>
            <label>{t('Month')}<input type="month" value={ded.month} onChange={(e) => setDed({ ...ded, month: e.target.value })} /></label>
            <label>{t('Reason')}<input required value={ded.reason} onChange={(e) => setDed({ ...ded, reason: e.target.value })} /></label>
            <button className="btn btn-primary" type="submit">{t('Save')}</button>
          </form>
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <h3>{t('Advances')}</h3>
            <ul className="list">{pay.listAdvances().map((a) => (
              <li key={a.id}><strong>{a.staffName}</strong> ₹{a.amount} · {a.month}<span className="muted">{a.reason}</span></li>
            ))}</ul>
            <h3>{t('Deductions')}</h3>
            <ul className="list">{pay.listDeductions().map((d) => (
              <li key={d.id}><strong>{d.staffName}</strong> ₹{d.amount} · {d.month}<span className="muted">{d.reason}</span></li>
            ))}</ul>
          </div>
        </div>
      )}
    </div>
  );
}
