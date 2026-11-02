import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, Pencil, Archive, ArchiveRestore, LayoutGrid, List, ImagePlus, X } from 'lucide-react';
import { useStore } from '../store.jsx';
import { api } from '../../api';
import { CATEGORIES, catalogue, createProduct } from '../../products/data/products';
import { photoFor } from '../../products/components/ProductArt';
import { inr } from '../data/mockData.js';
import PageHeader from '../components/PageHeader.jsx';
import DataTable from '../components/DataTable.jsx';
import Badge from '../components/Badge.jsx';
import Modal from '../components/Modal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import Field from '../components/Field.jsx';
import { useT } from '../i18n.js';
import { pname } from '../../products/i18n-names';

// CRS 4.1 Product Catalogue: this page now edits the SAME catalogue the customer shop sells (products/data/products.ts).
// Add / edit / archive (no hard delete) / categorise / photo upload / MRP + discount + effective price. Stock changes live in Inventory (with reason tags).
// BACKEND: GET/POST/PATCH /api/products (Admin only), archive = PATCH {archived:true}, photo = multipart upload to object storage.
const CAT_KEYS = { face: 'Face', 'wellness products': 'Wellness', body: 'Body' };
const STATUSES = ['In stock', 'Out of stock', 'Archived'];
const blank = () => ({ name: '', category: CATEGORIES[0].name, subcategory: CATEGORIES[0].subs[0], mrp: '', discountType: 'percent', discountValue: '0', stock: '', availability: 'In stock', description: '', image: '' });
const effOf = (d) => api.pricing.effectivePrice(Number(d.mrp) || 0, d.discountType, Number(d.discountValue) || 0);
const discLabel = (p) => (!p.discountValue ? '-' : p.discountType === 'percent' ? `${p.discountValue}%` : `${inr(p.discountValue)} off`);
// Availability follows stock: 0 units = Out of stock, anything above = In stock (stock itself is changed in Inventory).
const statusOf = (p) => (p.archived ? 'Archived' : p.stock === 0 ? 'Out of stock' : 'In stock');
const realStock = (p) => api.stock.stockOverride(p.id) ?? p.baseStock ?? p.stock; // quantity ignoring the manual Out-of-stock switch
const isUpload = (art) => typeof art === 'string' && art.startsWith('data:');

function Thumb({ p, size = 48 }) {
  return <img src={photoFor(p.art, p.colours?.[0]?.name, p.colours?.[0]?.photo)} alt={p.name} width={size} height={size} loading="lazy" style={{ width: size, height: size, borderRadius: 12, objectFit: 'cover', background: '#eadde0', flex: 'none' }} onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />;
}

export default function Products({ intent, onIntentHandled }) {
  const { notify, user } = useStore();
  const { t, lang } = useT();
  const CAT_LABEL = { face: t('Face'), 'wellness products': t('Wellness'), body: t('Body') };
  const pName = (name) => pname(name, lang === 'ta' ? 'ta' : 'en');
  const [, tick] = useState(0);
  const re = () => tick((n) => n + 1);
  useEffect(() => { const a = api.catalogue.subscribe(re), b = api.stock.subscribe(re); return () => { a(); b(); }; }, []);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');
  const [status, setStatus] = useState('All');
  const [view, setView] = useState('table');
  const [form, setForm] = useState(null); // { mode, data }
  const [errors, setErrors] = useState({});
  const [toArchive, setToArchive] = useState(null);
  const fileRef = useRef(null);
  const actor = user?.name || 'Admin', role = user?.role || 'Admin';

  useEffect(() => {
    if (intent === 'add') { setErrors({}); setForm({ mode: 'add', data: blank() }); onIntentHandled(); }
  }, [intent, onIntentHandled]);

  const all = catalogue();
  const rows = all.filter((p) =>
    (cat === 'All' || p.category === cat) &&
    (status === 'All' || statusOf(p) === status) &&
    (!q.trim() || `${p.name} ${p.id} ${p.sku} ${p.subcategory}`.toLowerCase().includes(q.trim().toLowerCase()))
  );

  const openAdd = () => { setErrors({}); setForm({ mode: 'add', data: blank() }); };
  const openEdit = (p) => {
    setErrors({});
    setForm({ mode: 'edit', data: { id: p.id, sku: p.sku, name: p.name, category: p.category, subcategory: p.subcategory, mrp: String(p.mrp), discountType: p.discountType || 'percent', discountValue: String(p.discountValue ?? 0), stock: String(realStock(p)), availability: p.forcedOut ? 'Out of stock' : 'In stock', description: p.description, image: isUpload(p.art) ? p.art : '', price: p.price } });
  };
  const set = (k, v) => setForm((f) => ({ ...f, data: { ...f.data, [k]: v } }));
  const setCategory = (c) => setForm((f) => ({ ...f, data: { ...f.data, category: c, subcategory: CATEGORIES.find((x) => x.name === c).subs[0] } }));

  const pickPhoto = async (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    try { set('image', await api.catalogue.compressImage(file)); }
    catch (err) { notify(err.message === 'size' ? 'Image is too large. Choose a file under 8 MB.' : 'Upload a PNG, JPG or WebP image.', 'error'); }
  };

  const validate = (d) => {
    const e = {};
    if (!d.name.trim()) e.name = 'Product name is required.';
    else if (d.name.trim().length < 3) e.name = 'Name must be at least 3 characters.';
    if (d.mrp === '' || Number.isNaN(Number(d.mrp))) e.mrp = 'Enter a valid MRP.';
    else if (Number(d.mrp) <= 0) e.mrp = 'MRP must be greater than zero.';
    const dv = Number(d.discountValue);
    if (d.discountValue === '' || Number.isNaN(dv) || dv < 0) e.discountValue = 'Enter zero or a positive discount.';
    else if (d.discountType === 'percent' && dv > 100) e.discountValue = 'Percentage cannot be more than 100.';
    else if (d.discountType === 'flat' && !e.mrp && dv >= Number(d.mrp)) e.discountValue = 'Flat discount must be less than the MRP.';
    if (form.mode === 'add' && (d.stock === '' || !/^\d+$/.test(String(d.stock).trim()))) e.stock = 'Enter a whole number, zero or more.';
    const units = form.mode === 'add' ? Number(d.stock) : Number(d.stock);
    if (d.availability === 'In stock' && !e.stock && units === 0) e.availability = 'Stock quantity is 0. Add stock in Inventory first, or choose Out of stock.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = () => {
    const d = form.data;
    if (!validate(d)) { notify('Please fix the highlighted fields.', 'error'); return; }
    const price = effOf(d);
    const base = { name: d.name.trim(), description: d.description.trim() || 'Herbal care product.', mrp: Number(d.mrp), discountType: d.discountType, discountValue: Number(d.discountValue) || 0, price, status: 'Active' };
    if (form.mode === 'add') {
      const p = createProduct({ ...base, category: d.category, subcategory: d.subcategory, stock: Number(d.stock), image: d.image || undefined });
      if (d.availability === 'Out of stock') api.catalogue.setPatch(p.id, { availability: 'out' });
      api.audit.log(actor, role, 'product.updated', `Added product ${p.name} (${p.id}) at ${inr(price)}`, { id: p.id, price });
      notify(`${p.name} was added to the catalogue.`);
    } else {
      const before = all.find((x) => x.id === d.id);
      const wasOut = !!before.forcedOut, nowOut = d.availability === 'Out of stock';
      api.catalogue.setPatch(d.id, { ...base, image: d.image || undefined, availability: nowOut ? 'out' : 'in' });
      if (wasOut && !nowOut && Number(d.stock) > 0) api.stock.fulfil(d.id, `${window.location.origin}/products/`); // SMS people waiting on "Notify Me"
      if (wasOut !== nowOut) api.audit.log(actor, role, 'product.updated', `${base.name} (${d.id}) marked ${nowOut ? 'Out of stock' : 'In stock'}`, { id: d.id });
      const changes = [];
      if (before.price !== price) changes.push(`price ${inr(before.price)} to ${inr(price)}`);
      if (before.mrp !== base.mrp) changes.push(`MRP ${inr(before.mrp)} to ${inr(base.mrp)}`);
      if (before.name !== base.name) changes.push(`renamed from ${before.name}`);
      api.audit.log(actor, role, 'product.updated', `Edited ${base.name} (${d.id})${changes.length ? ': ' + changes.join(', ') : ''}`, { id: d.id, price });
      notify(`${base.name} was updated.`);
    }
    setForm(null); re();
  };

  const toggleArchive = () => {
    const p = toArchive, next = !p.archived;
    api.catalogue.setPatch(p.id, { archived: next });
    api.audit.log(actor, role, 'product.updated', `${next ? 'Archived' : 'Restored'} product ${p.name} (${p.id})`, { id: p.id });
    notify(next ? `${p.name} was archived and hidden from the shop.` : `${p.name} was restored to the shop.`);
    setToArchive(null); re();
  };

  const stockCell = (p) => (p.stock === 0 ? <span className="stock-zero">{t('Out of stock')}</span> : <span className={p.stock <= api.stock.getThreshold() ? 'stock-low' : ''}>{p.stock} {t('units')}</span>);
  const actions = (p) => (
    <div className="row-actions" onClick={(e) => e.stopPropagation()}>
      <button className="icon-btn" onClick={() => openEdit(p)} aria-label={`Edit ${p.name}`}><Pencil size={16} /></button>
      <button className="icon-btn" onClick={() => setToArchive(p)} aria-label={`${p.archived ? 'Restore' : 'Archive'} ${p.name}`}>{p.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}</button>
    </div>
  );

  const columns = [
    { key: 'name', label: t('Product'), render: (p) => (
      <div className="row-gap"><Thumb p={p} /><div><strong>{pName(p.name)}</strong><span className="muted block">{p.sku} - {t(p.subcategory) !== p.subcategory ? t(p.subcategory) : p.subcategory}</span></div></div>
    ) },
    { key: 'category', label: t('Category'), render: (p) => CAT_LABEL[p.category] || p.category },
    { key: 'mrp', label: t('MRP'), render: (p) => inr(p.mrp) },
    { key: 'discount', label: t('Discount'), render: discLabel },
    { key: 'price', label: t('Selling price'), render: (p) => <strong>{inr(p.price)}</strong> },
    { key: 'stock', label: t('Stock'), render: stockCell },
    { key: 'status', label: t('Status'), render: (p) => <Badge>{t(statusOf(p))}</Badge> },
    { key: 'actions', label: '', width: '96px', render: actions }
  ];

  const archivedCount = useMemo(() => all.filter((p) => p.archived).length, [all]);

  return (
    <div className="page">
      <PageHeader
        title={t('Product catalogue')}
        subtitle={`${all.length} products across ${CATEGORIES.length} categories${archivedCount ? ` · ${archivedCount} archived` : ''}. ${t('This is the same catalogue the customer shop sells.')}`}
        actions={<button className="btn btn-primary" onClick={openAdd}><Plus size={17} />{t('Add product')}</button>}
      />

      <div className="filters">
        <div className="search-box"><Search size={17} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Search by name or product ID')} aria-label={t('Search products')} /></div>
        <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label={t('Filter by category')}>
          <option value="All">{t('All categories')}</option>{CATEGORIES.map((c) => <option key={c.name} value={c.name}>{CAT_LABEL[c.name]}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t('Filter by status')}>
          <option value="All">{t('All statuses')}</option>{STATUSES.map((s) => <option key={s} value={s}>{t(s)}</option>)}
        </select>
        <div className="view-toggle">
          <button className={view === 'table' ? 'active' : ''} onClick={() => setView('table')} aria-label="Table view"><List size={17} /></button>
          <button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} aria-label="Card view"><LayoutGrid size={17} /></button>
        </div>
      </div>

      {view === 'table' ? (
        <div className="card flush"><DataTable columns={columns} rows={rows} /></div>
      ) : (
        <div className="product-grid">
          {rows.length === 0 && <p className="muted">No products match your filters.</p>}
          {rows.map((p) => (
            <article key={p.id} className="product-card" style={p.archived ? { opacity: 0.6 } : undefined}>
              <div className="product-card-art"><Thumb p={p} size={88} /></div>
              <div className="product-card-body">
                <div className="between"><Badge>{t(statusOf(p))}</Badge><span className="muted">{p.sku}</span></div>
                <h4>{pName(p.name)}</h4>
                <span className="muted">{CAT_LABEL[p.category]} · {p.subcategory}</span>
                <div className="between"><span><strong>{inr(p.price)}</strong>{p.mrp > p.price && <s className="muted" style={{ marginLeft: 6 }}>{inr(p.mrp)}</s>}</span>{stockCell(p)}</div>
                {actions(p)}
              </div>
            </article>
          ))}
        </div>
      )}

      {form && (
        <Modal
          title={form.mode === 'add' ? t('Add product') : t('Edit product')}
          subtitle={form.mode === 'edit' ? `${form.data.id} · ${form.data.sku}` : 'A new ID is generated automatically'}
          onClose={() => setForm(null)}
          footer={<><button className="btn btn-ghost" onClick={() => setForm(null)}>{t('Cancel')}</button><button className="btn btn-primary" onClick={save}>{form.mode === 'add' ? t('Add product') : t('Save changes')}</button></>}
        >
          <div className="form-grid">
            <Field label={t('Product name')} error={errors.name}><input value={form.data.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Rose Petal Radiance Serum" /></Field>
            <Field label={t('Category')} hint={form.mode === 'edit' ? 'Category cannot be changed after the product is created' : undefined}>
              <select value={form.data.category} disabled={form.mode === 'edit'} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map((c) => <option key={c.name} value={c.name}>{CAT_LABEL[c.name]}</option>)}</select>
            </Field>
            <Field label={t('Subcategory')}>
              <select value={form.data.subcategory} disabled={form.mode === 'edit'} onChange={(e) => set('subcategory', e.target.value)}>{CATEGORIES.find((c) => c.name === form.data.category).subs.map((s) => <option key={s}>{s}</option>)}</select>
            </Field>
            <Field label={t('MRP / Base price (INR)')} error={errors.mrp}><input inputMode="decimal" value={form.data.mrp} onChange={(e) => set('mrp', e.target.value)} placeholder="2450" /></Field>
            <Field label={t('Discount type')}><select value={form.data.discountType} onChange={(e) => set('discountType', e.target.value)}><option value="percent">Percentage (%)</option><option value="flat">Flat amount (INR)</option></select></Field>
            <Field label={form.data.discountType === 'percent' ? t('Discount (%)') : t('Discount (INR)')} error={errors.discountValue}><input inputMode="decimal" value={form.data.discountValue} onChange={(e) => set('discountValue', e.target.value)} placeholder="0" /></Field>
            <Field label={t('Effective selling price')} hint="Calculated automatically"><input readOnly value={inr(effOf(form.data))} /></Field>
            {form.mode === 'add'
              ? <Field label={t('Opening stock')} error={errors.stock} hint="Later changes are made in Inventory with a reason"><input inputMode="numeric" value={form.data.stock} onChange={(e) => set('stock', e.target.value)} placeholder="25" /></Field>
              : <Field label={t('Stock quantity')} hint="Change stock from the Inventory page so a reason is recorded"><input readOnly value={form.data.stock} /></Field>}
            <Field label={t('Availability')} error={errors.availability} hint="Out of stock hides it from buying on the shop. The stock quantity is kept."><select value={form.data.availability || 'In stock'} onChange={(e) => set('availability', e.target.value)}><option value="In stock">{t('In stock')}</option><option value="Out of stock">{t('Out of stock')}</option></select></Field>
            <Field label={t('Description')}><textarea rows={3} value={form.data.description} onChange={(e) => set('description', e.target.value)} placeholder="Short product description" /></Field>
            <Field label={t('Product photo')} hint="PNG, JPG or WebP. It is resized automatically.">
              <div className="row-gap" style={{ alignItems: 'center' }}>
                {form.data.image && <img src={form.data.image} alt="" width={64} height={64} style={{ borderRadius: 12, objectFit: 'cover' }} />}
                <button type="button" className="btn btn-ghost small" onClick={() => fileRef.current?.click()}><ImagePlus size={16} />{form.data.image ? t('Replace photo') : t('Upload photo')}</button>
                {form.data.image && <button type="button" className="btn btn-ghost small" onClick={() => set('image', '')}><X size={16} />{t('Remove')}</button>}
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={pickPhoto} />
              </div>
            </Field>
          </div>
        </Modal>
      )}
      {toArchive && (
        <ConfirmDialog
          title={toArchive.archived ? t('Restore product') : t('Archive product')}
          message={toArchive.archived ? `Restore "${toArchive.name}" (${toArchive.sku})? It will show on the customer shop again.` : `Archive "${toArchive.name}" (${toArchive.sku})? It is hidden from the shop and POS, but its order history stays and you can restore it any time.`}
          onConfirm={toggleArchive} onCancel={() => setToArchive(null)}
        />
      )}
    </div>
  );
}
