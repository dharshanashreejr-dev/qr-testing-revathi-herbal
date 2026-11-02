import { useMemo, useState } from 'react';
import { Search, Shield, Wallet } from 'lucide-react';
import { useStore } from '../store.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { useT } from '../i18n.js';

export default function AuditLog() {
  const { auditLog = [], addAudit, user, notify } = useStore();
  const { t, lang } = useT();
  const [q, setQ] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerNote, setDrawerNote] = useState('');
  const [drawerAmt, setDrawerAmt] = useState('');

  const rows = useMemo(() => {
    if (!q.trim()) return auditLog;
    const s = q.trim().toLowerCase();
    return auditLog.filter((e) => `${e.action} ${e.detail} ${e.actor}`.toLowerCase().includes(s));
  }, [auditLog, q]);

  const settleDrawer = () => {
    const amt = Number(drawerAmt) || 0;
    addAudit?.('Cash drawer reconciliation', `Settled ₹${amt.toLocaleString('en-IN')}. Note: ${drawerNote || '—'}`, user?.name || 'Admin');
    notify(t('Cash drawer settlement recorded.'));
    setDrawerOpen(false);
    setDrawerNote('');
    setDrawerAmt('');
  };

  return (
    <div className="page">
      <PageHeader
        title={t('Audit log')}
        subtitle={t('Immutable ledger of stock, price, appointment, login and privilege events.')}
        actions={
          <button className="btn btn-soft" onClick={() => setDrawerOpen(true)}>
            <Wallet size={16} /> {t('Cash drawer reconciliation')}
          </button>
        }
      />

      <div className="filters">
        <div className="search-box"><Search size={17} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Search action, actor or detail')} /></div>
      </div>

      <div className="card flush">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('When')}</th>
              <th>{t('Actor')}</th>
              <th>{t('Action')}</th>
              <th>{t('Detail')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id}>
                <td style={{ whiteSpace: 'nowrap' }}>{new Date(e.at).toLocaleString('en-IN')}</td>
                <td>{e.actor}</td>
                <td><Shield size={13} style={{ verticalAlign: 'middle' }} /> {t(e.action)}</td>
                <td>{t(e.detail)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={4} className="muted" style={{ textAlign: 'center', padding: 32 }}>{t('No audit entries yet. Stock changes, price edits, cancellations, logins and privilege changes will appear here.')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {drawerOpen && (
        <div className="modal-backdrop" onClick={() => setDrawerOpen(false)}>
          <div className="modal card" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <h3>{t('Cash drawer reconciliation')}</h3>
            <p className="muted">{t('Record end-of-day cash settlement. Entry is written to the immutable audit log.')}</p>
            <label className="field-label">{t('Settled amount (₹)')}</label>
            <input type="number" value={drawerAmt} onChange={(e) => setDrawerAmt(e.target.value)} placeholder="0" style={{ width: '100%', marginBottom: 12 }} />
            <label className="field-label">{t('Note')}</label>
            <textarea rows={2} value={drawerNote} onChange={(e) => setDrawerNote(e.target.value)} style={{ width: '100%', marginBottom: 16 }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setDrawerOpen(false)}>{t('Cancel')}</button>
              <button className="btn btn-primary" onClick={settleDrawer}>{t('Record settlement')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
