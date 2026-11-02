import { useEffect, useMemo, useState } from 'react';
import { Search, Boxes, Layers, AlertTriangle, PackageX, Minus, Plus, PackagePlus, BellRing } from 'lucide-react';
import { useStore } from '../store.jsx';
import { api } from '../../api';
import { PRODUCTS, catalogue } from '../../products/data/products';
import PageHeader from '../components/PageHeader.jsx';
import StatCard from '../components/StatCard.jsx';
import Badge from '../components/Badge.jsx';
import Modal from '../components/Modal.jsx';
import Field from '../components/Field.jsx';
import { useT } from '../i18n.js';
import { pname } from '../../products/i18n-names';

const REASONS = api.stock.REASONS;

// Phase 4a: this screen now manages the SAME catalogue the customer shop sells (src/products), and the stock numbers are
// shared through api.stock. BACKEND: list / adjustStock become GET /api/inventory and PATCH /api/inventory/:id (Admin + Staff only).
const CAT_LABEL = { face: 'Face', 'wellness products': 'Wellness', body: 'Body' };

export default function Inventory() {
  const { notify, user, sendMessage, addAudit, lowStockThreshold, setLowStockThreshold } = useStore();
  const { t, lang } = useT();
  const pName = (name) => pname(name, lang === 'ta' ? 'ta' : 'en');
  const [, tick] = useState(0);
  const re = () => tick((n) => n + 1);
  useEffect(() => { const a = api.stock.subscribe(re), b = api.catalogue.subscribe(re); return () => { a(); b(); }; }, []);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');
  const [state, setState] = useState('All');
  const [edit, setEdit] = useState(null); // { product, qty, reason, note, error }
  const [set, setSet] = useState(() => { const s = api.stock.getSettings(); return { threshold: String(s.lowStockThreshold), phone: s.alertPhone, error: '' }; });

  const th = api.stock.getThreshold();
  const products = catalogue().filter((p) => !p.archived).map((p) => {
    const stock = api.stock.stockOverride(p.id) ?? p.baseStock ?? p.stock;
    return { ...p, stock, cap: Math.max(api.stock.capacityOverride(p.id) ?? 0, p.baseStock ?? p.stock, stock, 1), waiting: api.stock.waitingCount(p.id) };
  });
  const stateOf = (p) => (p.stock === 0 || p.forcedOut ? 'Out of Stock' : p.stock <= th ? 'Low Stock' : 'In Stock');

  const stats = useMemo(() => ({
    skus: products.length,
    units: products.reduce((s, p) => s + p.stock, 0),
    low: products.filter((p) => p.stock > 0 && p.stock <= th).length,
    out: products.filter((p) => p.stock === 0).length
  }), [products, th]);

  const rows = products.filter((p) =>
    (cat === 'All' || p.category === cat) &&
    (state === 'All' || stateOf(p) === state) &&
    (!q.trim() || `${p.name} ${p.sku} ${p.subcategory}`.toLowerCase().includes(q.trim().toLowerCase()))
  );

  const setStock = (p, next, message, why) => {
    const reason = why?.reason || 'New Stock Received';
    const note = (why?.note || '').trim();
    // When STAFF adjust stock, a message (with the reason tag) is sent to the admin panel.
    if (user?.role === 'Staff' && p.stock !== next) {
      sendMessage(`${user.name} (Staff) changed stock of ${p.name} from ${p.stock} to ${next}. Reason: ${reason}${note ? ` (${note})` : ''}.`, 'inventory', user.name);
    }
    const r = api.stock.adjustStock({ id: p.id, sku: p.sku, name: p.name }, p.baseStock ?? p.stock, next, '', { reason, note, by: user?.name, role: user?.role });
    if (p.stock !== next) api.audit.log(user?.name || 'Admin', user?.role || 'Admin', 'stock.adjusted', `${p.name} stock ${p.stock} to ${next} - ${reason}${note ? ` (${note})` : ''}`, { sku: p.sku, prev: p.stock, next, reason });
    notify(message.text, 'success', message.vars);
    if (r.notified) notify('Back-in-stock SMS sent to {n} customer(s).', 'info', { n: r.notified });
    if (r.lowAlert) notify('Low-stock SMS alert sent for {name}.', 'info', { name: p.name });
    re();
  };

  // +/- opens the adjustment form so a reason tag is always recorded.
  const openAdjust = (p, delta = 0) => setEdit({ product: p, qty: String(Math.max(0, p.stock + delta)), reason: delta > 0 ? 'New Stock Received' : delta < 0 ? 'Damaged' : '', note: '', error: '' });
  const bump = openAdjust;
  const restock = (p) => { const to = Math.max(p.cap, p.stock); setStock(p, to, { text: '{name} restocked to {n} units.', vars: { name: p.name, n: to } }, { reason: 'New Stock Received' }); };
  const needRestock = products.filter((p) => p.stock <= th).sort((a, b) => a.stock - b.stock);

  const saveEdit = () => {
    const v = edit.qty.trim();
    if (v === '' || !/^\d+$/.test(v)) { setEdit({ ...edit, error: 'Enter a whole number, zero or more.' }); return; }
    if (Number(v) === edit.product.stock) { setEdit({ ...edit, error: 'The quantity is the same as the current stock.' }); return; }
    if (!edit.reason) { setEdit({ ...edit, error: 'Select a reason for this change.' }); return; }
    setStock(edit.product, Number(v), { text: '{name} stock updated to {n}.', vars: { name: edit.product.name, n: Number(v) } }, { reason: edit.reason, note: edit.note });
    setEdit(null);
  };

  const saveSettings = () => {
    const n = Number(set.threshold);
    if (!/^\d+$/.test(set.threshold.trim()) || n < 1 || n > 100) { setSet({ ...set, error: 'Enter a threshold between 1 and 100.' }); return; }
    if (set.phone.trim() && !/^[6-9]\d{9}$/.test(set.phone.trim())) { setSet({ ...set, error: 'Enter valid 10-digit mobiles, comma-separated.' }); return; }
    api.stock.saveSettings({ lowStockThreshold: n, alertPhone: set.phone.trim() });
    setSet({ ...set, error: '' });
    notify('Settings saved.');
    re();
  };

  return (
    <div className="page">
      <PageHeader title={t('Inventory')} subtitle={`${t('Low stock is {n} units or fewer. Updates apply instantly across the panel and reach the customer shop on refresh.', { n: th })}${user?.role === 'Staff' ? ' ' + t('Every change you make is sent to the admin.') : ''}`} />
      <div className="stat-grid four">
        <StatCard icon={Boxes} label={t('Total SKUs')} value={stats.skus} tone="sage" />
        <StatCard icon={Layers} label={t('Total stock units')} value={stats.units.toLocaleString('en-IN')} tone="forest" />
        <StatCard icon={AlertTriangle} label={t('Low-stock products')} value={stats.low} tone="amber" />
        <StatCard icon={PackageX} label={t('Out-of-stock products')} value={stats.out} tone="rose" />
      </div>

      {user?.role === 'Admin' && (
        <div className="card">
          <div className="card-head"><h3>{t('Low-stock threshold')}</h3></div>
          <div className="filters">
            <Field label={t('Low-stock threshold')} error={set.error}>
              <input inputMode="numeric" value={set.threshold} onChange={(e) => setSet({ ...set, threshold: e.target.value, error: '' })} />
            </Field>
            <Field label={t('Alert phones for low-stock SMS (comma-separated)')}>
              <input inputMode="numeric" maxLength={10} value={set.phone} onChange={(e) => setSet({ ...set, phone: e.target.value.replace(/\D/g, ''), error: '' })} />
            </Field>
            <button className="btn btn-primary" onClick={saveSettings}>{t('Save settings')}</button>
          </div>
        </div>
      )}

      {needRestock.length > 0 && (
        <div className="card restock">
          <div className="card-head"><h3>{t('Restocking visibility')}</h3><span className="muted">{needRestock.length} product(s) need attention</span></div>
          <ul className="list">
            {needRestock.slice(0, 8).map((p) => (
              <li key={p.id}>
                <div className="row-gap"><AlertTriangle size={17} className={p.stock === 0 ? 'ic-red' : 'ic-amber'} /><div><strong>{pName(p.name)}</strong><span className="muted">{p.stock === 0 ? 'Out of stock, restock now' : `Only ${p.stock} left`}{p.waiting > 0 ? ` · ${t('{n} waiting for Notify Me', { n: p.waiting })}` : ''}</span></div></div>
                <button className="btn btn-soft" onClick={() => restock(p)}><PackagePlus size={16} />{t('Restock to {n}', { n: Math.max(p.cap, p.stock) })}</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="filters">
        <div className="search-box"><Search size={17} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Search inventory')} aria-label={t('Search inventory')} /></div>
        <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label={t('Filter by category')}><option value="All">{t('All categories')}</option>{Object.keys(PRODUCTS).map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}</select>
        <select value={state} onChange={(e) => setState(e.target.value)} aria-label={t('Filter by stock status')}><option value="All">{t('All stock levels')}</option><option value="In Stock">{t('In Stock')}</option><option value="Low Stock">{t('Low Stock')}</option><option value="Out of Stock">{t('Out of Stock')}</option></select>
      </div>

      <div className="inv-grid">
        {rows.length === 0 && <p className="muted">{t('No products match your filters.')}</p>}
        {rows.map((p) => {
          const st = stateOf(p);
          const pct = Math.min(100, Math.round((p.stock / p.cap) * 100));
          return (
            <article key={p.id} className={`inv-card ${st === 'Out of Stock' ? 'is-out' : st === 'Low Stock' ? 'is-low' : ''}`}>
              <div className="row-gap"><div className="grow"><strong>{pName(p.name)}</strong><span className="muted block">{p.sku} - {p.subcategory}</span></div><Badge>{t(st)}</Badge></div>
              <div className="between"><span className="muted">{t('Stock level')}</span><strong>{p.stock} / {p.cap}</strong></div>
              <div className="progress"><div className={`progress-fill ${st === 'Out of Stock' ? 'red' : st === 'Low Stock' ? 'amber' : 'green'}`} style={{ width: `${pct}%` }} /></div>
              {p.waiting > 0 && <p className="warn amber"><BellRing size={14} /> {t('{n} waiting for Notify Me', { n: p.waiting })}</p>}
              {st === 'Out of Stock' && <p className="warn red">{t('Out of Stock. Customers cannot order this product.')}</p>}
              {st === 'Low Stock' && <p className="warn amber">{t('Low stock warning. Consider restocking soon.')}</p>}
              <div className="stock-controls">
                <button className="icon-btn" onClick={() => bump(p, -1)} aria-label={`Decrease ${p.name}`}><Minus size={16} /></button>
                <button className="icon-btn" onClick={() => bump(p, 1)} aria-label={`Increase ${p.name}`}><Plus size={16} /></button>
                <button className="btn btn-ghost small" onClick={() => openAdjust(p, 0)}>{t('Update quantity')}</button>
              </div>
            </article>
          );
        })}
      </div>

      {api.stock.moves().length > 0 && (
        <div className="card">
          <div className="card-head"><h3>{t('Stock adjustment history')}</h3></div>
          <ul className="list">
            {api.stock.moves(undefined, 8).map((m) => (
              <li key={m.id}>
                <div><strong>{m.name}</strong><span className="muted block">{m.prev} to {m.next} · {t(m.reason)}{m.note ? ` · ${m.note}` : ''}</span></div>
                <span className="muted">{m.by} · {new Date(m.at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {edit && (
        <Modal title={t('Update stock quantity')} subtitle={edit.product.name} onClose={() => setEdit(null)}
          footer={<><button className="btn btn-ghost" onClick={() => setEdit(null)}>{t('Cancel')}</button><button className="btn btn-primary" onClick={saveEdit}>{t('Save quantity')}</button></>}>
          <div className="form-grid">
            <Field label={t('New stock quantity')} hint={`Current stock: ${edit.product.stock}. Setting zero marks the product as Out of Stock`}>
              <input autoFocus inputMode="numeric" value={edit.qty} onChange={(e) => setEdit({ ...edit, qty: e.target.value, error: '' })} />
            </Field>
            <Field label={t('Reason')}>
              <select value={edit.reason} onChange={(e) => setEdit({ ...edit, reason: e.target.value, error: '' })}>
                <option value="">{t('Select a reason')}</option>
                {REASONS.map((r) => <option key={r} value={r}>{t(r)}</option>)}
              </select>
            </Field>
            <Field label={t('Note (optional)')} error={edit.error}>
              <input value={edit.note} maxLength={80} onChange={(e) => setEdit({ ...edit, note: e.target.value })} placeholder="e.g. 2 bottles cracked in transit" />
            </Field>
          </div>
        </Modal>
      )}
    </div>
  );
}
