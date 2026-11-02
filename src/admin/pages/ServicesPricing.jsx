import { useState } from 'react';
import { Eye, EyeOff, RotateCcw, Plus, Pencil, Trash2, Clock, Sparkles } from 'lucide-react';
import { useStore } from '../store.jsx';
import { api } from '../../api';
import PageHeader from '../components/PageHeader.jsx';
import Field from '../components/Field.jsx';
import Badge from '../components/Badge.jsx';
import Modal from '../components/Modal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { useT } from '../i18n.js';
import { DEFAULT_BRIDAL, DEFAULT_SERVICES, promoPrice, saveSiteConfig, useSiteConfig } from '../../shared/siteConfig';
import { inr } from '../data/mockData.js';

// CRS 4.2 Services & Consultations Management. Admin controls for the public website:
//  1. show / hide service prices
//  2. Service Catalog: add, edit, hide and delete services / consultations (name, duration, care instructions, base fee, promo discount)
//  3. the four Bridal Makeup packages (Silver, Gold, Platinum, Trial Pack): details, price, promo discount, care instructions
// Every add / edit / delete is saved straight away and the website follows.
// BACKEND: `services` and `service_packages` tables; price visibility = a row in `settings`. Admin only.
const CATS = ['Body Massage', 'Facial', 'Consultation'];
const slug = (n) => n.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const blankService = () => ({ id: '', name: '', category: 'Facial', duration: '45', price: '', discountType: 'percent', discountValue: '0', care: '', desc: '', active: true, popular: false, signature: false });
const toForm = (x) => ({ ...x, price: String(x.price), duration: String(x.duration), discountValue: String(x.discountValue ?? 0), discountType: x.discountType || 'percent', care: x.care || '', desc: x.desc || '', features: x.features ? x.features.join('\n') : undefined });
const promoText = (type, v, t) => (!v ? t('No promotion') : type === 'percent' ? t('{n}% off', { n: v }) : t('{amount} off', { amount: inr(v) }));

function validate(x, isPkg, services) {
  const e = {};
  if (!x.name.trim()) e.name = isPkg ? 'Enter a package name.' : 'Enter a service name.';
  else if (!isPkg && services.some((s) => s.id !== x.id && s.name.trim().toLowerCase() === x.name.trim().toLowerCase())) e.name = 'A service with this name already exists.';
  if (!/^\d+$/.test(x.price.trim()) || Number(x.price) <= 0) e.price = 'Enter a price in rupees.';
  if (!/^\d+$/.test(x.duration.trim()) || Number(x.duration) <= 0) e.duration = 'Enter minutes.';
  const v = Number(x.discountValue);
  if (x.discountValue === '' || Number.isNaN(v) || v < 0) e.disc = 'Enter zero or a positive discount.';
  else if (x.discountType === 'percent' && v > 100) e.disc = 'Percentage cannot be more than 100.';
  else if (x.discountType === 'flat' && v >= Number(x.price)) e.disc = 'Flat discount must be less than the fee.';
  return e;
}

const Stat = ({ label, value, strong }) => (
  <div style={{ background: 'rgba(150,63,85,.06)', borderRadius: 10, padding: '8px 10px', minWidth: 0 }}>
    <span className="muted" style={{ display: 'block', fontSize: 11.5, marginBottom: 2 }}>{label}</span>
    <span style={{ fontSize: 14.5, fontWeight: strong ? 700 : 600, overflowWrap: 'anywhere' }}>{value}</span>
  </div>
);
const Block = ({ label, children }) => (
  <div>
    <span className="muted" style={{ display: 'block', fontSize: 11.5, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</span>
    <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>{children}</div>
  </div>
);

// One neat card for a service or a bridal package. Same layout for all, footer always at the bottom.
function ItemCard({ x, isPkg, t, onEdit, onDelete, onToggle }) {
  const eff = promoPrice(x.price, x.discountType, x.discountValue || 0);
  const hasPromo = (x.discountValue || 0) > 0;
  return (
    <div className="card" style={{ boxShadow: 'none', display: 'flex', flexDirection: 'column', gap: 14, height: '100%', opacity: !isPkg && !x.active ? 0.72 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <strong style={{ fontSize: 16, display: 'block', overflowWrap: 'anywhere' }}>{t(x.name)}</strong>
          <span className="muted" style={{ fontSize: 12.5 }}>{isPkg ? t('Bridal Makeup package') : t(x.category)}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', flex: 'none' }}>
          {x.popular && <Badge tone="sand">{t('Most loved')}</Badge>}
          {!isPkg && x.signature && <Badge tone="green">{t('Our signature service')}</Badge>}
          {!isPkg && <Badge tone={x.active ? 'green' : 'red'}>{x.active ? t('Active') : t('Hidden')}</Badge>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Stat label={t('Duration')} value={<span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}><Clock size={13} />{x.duration} {t('min')}</span>} />
        <Stat label={t('Base fee')} value={inr(x.price)} />
        <Stat label={t('Promotion')} value={promoText(x.discountType, x.discountValue, t)} />
        <Stat label={t('Customers pay')} value={<>{inr(eff)}{hasPromo && <s className="muted" style={{ marginLeft: 6, fontWeight: 400, fontSize: 12 }}>{inr(x.price)}</s>}</>} strong />
      </div>

      {isPkg
        ? <Block label={t('Services included')}>{x.features.length ? <ul style={{ margin: 0, paddingLeft: 18 }}>{x.features.map((f) => <li key={f}>{t(f)}</li>)}</ul> : <span className="muted">-</span>}</Block>
        : <Block label={t('Description')}>{x.desc ? t(x.desc) : <span className="muted">-</span>}</Block>}
      <Block label={t('Pre-service care instructions')}>{x.care ? t(x.care) : <span className="muted">{t('None added')}</span>}</Block>

      <div style={{ display: 'flex', gap: 6, marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--line)', alignItems: 'center' }}>
        {!isPkg && <button className="btn btn-ghost small" onClick={onToggle}>{x.active ? <EyeOff size={15} /> : <Eye size={15} />}{x.active ? t('Hide') : t('Show')}</button>}
        <span style={{ flex: 1 }} />
        <button className="icon-btn" onClick={onEdit} aria-label={`${t('Edit')} ${x.name}`} title={t('Edit')}><Pencil size={16} /></button>
        {!isPkg && <button className="icon-btn danger" onClick={onDelete} aria-label={`${t('Delete')} ${x.name}`} title={t('Delete')}><Trash2 size={16} /></button>}
      </div>
    </div>
  );
}

export default function ServicesPricing() {
  const { notify, user } = useStore();
  const { t, lang } = useT();
  const cfg = useSiteConfig();
  const [form, setForm] = useState(null); // { kind: 'service' | 'package', isNew, data, errors }
  const [toDelete, setToDelete] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const actor = user?.name || 'Admin', role = user?.role || 'Admin';
  const log = (summary) => api.audit.log(actor, role, 'product.updated', summary);

  const togglePrices = () => {
    saveSiteConfig({ ...cfg, showServicePrices: !cfg.showServicePrices });
    api.audit.log(actor, role, 'settings.changed', `Service prices ${cfg.showServicePrices ? 'hidden' : 'shown'} on the website`);
    notify(cfg.showServicePrices ? 'Service prices are now hidden on the website.' : 'Service prices are now visible on the website.');
  };

  const openService = (s) => setForm({ kind: 'service', isNew: !s, errors: {}, data: s ? toForm(s) : blankService() });
  const openPackage = (b) => setForm({ kind: 'package', isNew: false, errors: {}, data: toForm(b) });
  const set = (k, v) => setForm((f) => ({ ...f, errors: { ...f.errors, [k]: undefined, ...(k === 'price' || k === 'discountType' || k === 'discountValue' ? { disc: undefined } : {}) }, data: { ...f.data, [k]: v } }));

  const submit = () => {
    const { kind, isNew, data: d } = form;
    const isPkg = kind === 'package';
    const errors = validate(d, isPkg, cfg.services);
    if (Object.keys(errors).length) { setForm({ ...form, errors }); notify('Please fix the highlighted fields.', 'error'); return; }
    const common = { name: d.name.trim(), price: Number(d.price), duration: Number(d.duration), discountType: d.discountType, discountValue: Number(d.discountValue) || 0, care: d.care.trim(), popular: !!d.popular };
    if (isPkg) {
      const pkg = { id: d.id, ...common, features: d.features.split('\n').map((x) => x.trim()).filter(Boolean) };
      const old = cfg.bridalPackages.find((b) => b.id === pkg.id);
      saveSiteConfig({ ...cfg, bridalPackages: cfg.bridalPackages.map((b) => (b.id === pkg.id ? pkg : b)) });
      log(`Package ${pkg.name} updated${old && old.price !== pkg.price ? `: fee ${inr(old.price)} to ${inr(pkg.price)}` : ''}`);
      notify('{name} saved. The website now shows the new details.', 'success', { name: pkg.name });
    } else {
      let id = d.id;
      if (isNew) {
        const base = slug(d.name) || `service-${Date.now().toString(36)}`;
        const taken = new Set([...cfg.services.map((s) => s.id), ...cfg.bridalPackages.map((b) => b.id)]);
        id = base; for (let n = 2; taken.has(id); n += 1) id = `${base}-${n}`;
      }
      const svc = { id, ...common, category: d.category, desc: d.desc.trim() || d.name.trim(), active: !!d.active, signature: !!d.signature };
      const services = isNew ? [...cfg.services, svc] : cfg.services.map((s) => (s.id === id ? svc : s));
      if (!services.some((s) => s.active)) { notify('Keep at least one service active.', 'error'); return; }
      const old = cfg.services.find((s) => s.id === id);
      saveSiteConfig({ ...cfg, services });
      log(isNew ? `Added service ${svc.name} (${inr(svc.price)})` : `Edited service ${svc.name}${old && old.price !== svc.price ? `: fee ${inr(old.price)} to ${inr(svc.price)}` : ''}`);
      notify(isNew ? '{name} added. It is live on the website.' : '{name} saved. The website now shows the new details.', 'success', { name: svc.name });
    }
    setForm(null);
  };

  const toggleActive = (s) => {
    const services = cfg.services.map((x) => (x.id === s.id ? { ...x, active: !x.active } : x));
    if (!services.some((x) => x.active)) { notify('Keep at least one service active.', 'error'); return; }
    saveSiteConfig({ ...cfg, services });
    log(`${s.name} ${s.active ? 'hidden from' : 'shown on'} the website`);
    notify(s.active ? '{name} is now hidden.' : '{name} is now visible.', 'success', { name: s.name });
  };

  const remove = () => {
    const s = toDelete;
    const services = cfg.services.filter((x) => x.id !== s.id);
    if (!services.some((x) => x.active)) { notify('Keep at least one service active.', 'error'); setToDelete(null); return; }
    saveSiteConfig({ ...cfg, services });
    log(`Deleted service ${s.name}`);
    notify('{name} deleted.', 'success', { name: s.name });
    setToDelete(null);
  };

  const reset = () => {
    saveSiteConfig({ ...cfg, services: DEFAULT_SERVICES, bridalPackages: DEFAULT_BRIDAL });
    log('Services and bridal packages reset to defaults');
    notify('Services and packages were reset to the defaults.');
    setConfirmReset(false);
  };

  const d = form?.data, er = form?.errors || {};
  const isPkg = form?.kind === 'package';
  const eff = form ? promoPrice(Number(d.price) || 0, d.discountType, Number(d.discountValue) || 0) : 0;
  const cardGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 16, alignItems: 'stretch' };

  return (
    <div className="page">
      <PageHeader title={t('Services & Pricing')} subtitle="Control what customers see on the website: service price visibility, the service catalogue and the Bridal Makeup packages."
        actions={<button className="btn btn-primary" onClick={() => openService()}><Plus size={17} />{t('Add service')}</button>} />

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head">
          <h3>{t('Service price visibility')}</h3>
          <span className="muted">{cfg.showServicePrices ? 'Prices are visible to customers' : 'Prices are hidden from customers'}</span>
        </div>
        <p className="muted" style={{ marginBottom: 14 }}>When turned off, the landing page, services page and booking form show no service prices. Services are always paid offline at the salon.</p>
        <button className={`btn ${cfg.showServicePrices ? 'btn-soft' : 'btn-primary'}`} onClick={togglePrices} aria-pressed={cfg.showServicePrices}>
          {cfg.showServicePrices ? <EyeOff size={16} /> : <Eye size={16} />}
          {cfg.showServicePrices ? t('Hide prices') : t('Show prices')}
        </button>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head">
          <h3>{t('Services & consultations')}</h3>
          <span className="muted">{cfg.services.length} {t('services')} · {cfg.services.filter((s) => s.active).length} {t('visible on website')}</span>
        </div>
        <p className="muted" style={{ marginBottom: 14 }}>Add a new service, edit its details or delete it. Hide a service to keep it but remove it from the website and booking.</p>
        <div style={cardGrid}>
          {cfg.services.map((s) => (
            <ItemCard key={s.id} x={s} t={t} onEdit={() => openService(s)} onDelete={() => setToDelete(s)} onToggle={() => toggleActive(s)} />
          ))}
          <button type="button" onClick={() => openService()} className="card" style={{ boxShadow: 'none', border: '2px dashed var(--rose)', background: 'transparent', cursor: 'pointer', minHeight: 160, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={22} /><strong>{t('Add service')}</strong>
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>{t('Bridal Makeup packages')}</h3>
          <span className="muted">{t("Edit the name, price, promotion, care instructions and what is included.")}</span>
        </div>
        <div style={cardGrid}>
          {cfg.bridalPackages.map((b) => <ItemCard key={b.id} x={b} isPkg t={t} onEdit={() => openPackage(b)} />)}
        </div>
      </div>

      <div className="card-actions" style={{ marginTop: 18 }}>
        <button className="btn btn-ghost" onClick={() => setConfirmReset(true)}><RotateCcw size={16} />{t('Reset to defaults')}</button>
      </div>

      {form && (
        <Modal wide title={isPkg ? t('Edit package') : form.isNew ? t('Add service') : t('Edit service')} subtitle={t('Changes are saved straight away and the website follows.')} onClose={() => setForm(null)}
          footer={<><button className="btn btn-ghost" onClick={() => setForm(null)}>{t('Cancel')}</button><button className="btn btn-primary" onClick={submit}>{form.isNew ? t('Add service') : t('Save changes')}</button></>}>
          <div className="form-grid">
            <Field label={isPkg ? t('Package name') : t('Service name')} error={er.name && t(er.name)}><input value={d.name} onChange={(e) => set('name', e.target.value)} placeholder={isPkg ? 'Gold' : 'Herbal Glow Facial'} /></Field>
            {!isPkg && (
              <Field label={t('Category')}><select value={d.category} disabled={!form.isNew} onChange={(e) => set('category', e.target.value)}>{CATS.map((c) => <option key={c} value={c}>{t(c)}</option>)}</select></Field>
            )}
            <Field label={t('Base service fee (₹)')} error={er.price && t(er.price)}><input inputMode="numeric" value={d.price} onChange={(e) => set('price', e.target.value)} /></Field>
            <Field label={t('Duration (min)')} error={er.duration && t(er.duration)}><input inputMode="numeric" value={d.duration} onChange={(e) => set('duration', e.target.value)} /></Field>
            <Field label={t('Promo discount type')}><select value={d.discountType} onChange={(e) => set('discountType', e.target.value)}><option value="percent">Percentage (%)</option><option value="flat">Flat amount (₹)</option></select></Field>
            <Field label={d.discountType === 'percent' ? t('Promo discount (%)') : t('Promo discount (₹)')} error={er.disc && t(er.disc)} hint="0 means no promotion"><input inputMode="numeric" value={d.discountValue} onChange={(e) => set('discountValue', e.target.value)} /></Field>
            <div style={{ gridColumn: '1 / -1' }}>
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>{t('Customers pay')}: <strong>{inr(eff)}</strong></p>
            </div>
            {isPkg
              ? <div style={{ gridColumn: '1 / -1' }}><Field label={t('Services included')} hint="One per line"><textarea rows={6} style={{ width: '100%' }} value={d.features} onChange={(e) => set('features', e.target.value)} /></Field></div>
              : <div style={{ gridColumn: '1 / -1' }}><Field label={t('Description')}><textarea rows={2} style={{ width: '100%' }} value={d.desc} onChange={(e) => set('desc', e.target.value)} /></Field></div>}
            <div style={{ gridColumn: '1 / -1' }}>
              <Field label={t('Pre-service care instructions')} hint="Shown to customers on the Services page"><textarea rows={3} style={{ width: '100%' }} value={d.care} onChange={(e) => set('care', e.target.value)} /></Field>
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 22, flexWrap: 'wrap' }}>
              {!isPkg && (
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13.5 }}>
                  <input type="checkbox" checked={!!d.active} onChange={(e) => set('active', e.target.checked)} /> {t('Active on website')}
                </label>
              )}
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13.5 }}>
                <input type="checkbox" checked={!!d.popular} onChange={(e) => set('popular', e.target.checked)} /> {t('Mark as most loved')}
              </label>
              {form.kind !== 'package' && (
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13.5 }}>
                  <input type="checkbox" checked={!!d.signature} onChange={(e) => set('signature', e.target.checked)} /> {t('Mark as our signature service')}
                </label>
              )}
            </div>
          </div>
        </Modal>
      )}

      {toDelete && (
        <ConfirmDialog title={t('Delete service')} message={t('Delete "{name}"? It will be removed from the website, the booking form and POS billing.', { name: toDelete.name })} onConfirm={remove} onCancel={() => setToDelete(null)} />
      )}
      {confirmReset && (
        <ConfirmDialog title={t('Reset to defaults')} confirmLabel="Reset" message={t('Reset all services and bridal packages to the original defaults? Services you added and every change you made will be lost.')} onConfirm={reset} onCancel={() => setConfirmReset(false)} />
      )}
    </div>
  );
}
