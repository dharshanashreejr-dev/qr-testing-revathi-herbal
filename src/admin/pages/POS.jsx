import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, Trash2, Receipt, CreditCard, Banknote, Printer, MessageSquare, ShoppingBag,
  X, Inbox, CalendarDays, Check, Search, Camera, UserPlus, LayoutGrid
} from 'lucide-react';
import { useStore } from '../store.jsx';
import { api } from '../../api';
import { catalogue } from '../../products/data/products';
import { services as siteServices } from '../../site/data';
import { inr } from '../data/mockData.js';
import PageHeader from '../components/PageHeader.jsx';
import Badge from '../components/Badge.jsx';
import Modal from '../components/Modal.jsx';
import PrintPreview from '../components/PrintPreview.jsx';
import { buildInvoiceDocs } from '../lib/orderPrint.js';
import { useT } from '../i18n.js';

const PAY_METHODS = [
  { id: 'Cash', icon: Banknote, label: 'Cash' },
  { id: 'Card', icon: CreditCard, label: 'Card' },
  { id: 'Razorpay', icon: CreditCard, label: 'Razorpay' },
];
const GST = api.pos.GST_RATE;
const BILLED_KEY = 'rhbc-pos-billed';
const OPEN_APPT = ['Pending Review', 'Scheduled', 'Checked-In', 'In Session', 'Rescheduled'];
const STATES = [
  ['Andaman and Nicobar Islands', '35'], ['Andhra Pradesh', '37'], ['Arunachal Pradesh', '12'], ['Assam', '18'], ['Bihar', '10'],
  ['Chandigarh', '04'], ['Chhattisgarh', '22'], ['Dadra and Nagar Haveli and Daman and Diu', '26'], ['Delhi', '07'], ['Goa', '30'],
  ['Gujarat', '24'], ['Haryana', '06'], ['Himachal Pradesh', '02'], ['Jammu and Kashmir', '01'], ['Jharkhand', '20'],
  ['Karnataka', '29'], ['Kerala', '32'], ['Ladakh', '38'], ['Lakshadweep', '31'], ['Madhya Pradesh', '23'],
  ['Maharashtra', '27'], ['Manipur', '14'], ['Meghalaya', '17'], ['Mizoram', '15'], ['Nagaland', '13'],
  ['Odisha', '21'], ['Puducherry', '34'], ['Punjab', '03'], ['Rajasthan', '08'], ['Sikkim', '11'],
  ['Tamil Nadu', '33'], ['Telangana', '36'], ['Tripura', '16'], ['Uttar Pradesh', '09'], ['Uttarakhand', '05'], ['West Bengal', '19'],
];
const DEFAULT_STATE = '33'; // Tamil Nadu

let rowSeq = 0;
const newRow = () => ({ rid: `row-${Date.now().toString(36)}-${rowSeq++}`, kind: 'custom', id: '', sku: '', code: '', name: '', qty: '1', unit: 'pcs', rate: '' });
const productRow = (p, qty = 1) => ({ rid: `row-${Date.now().toString(36)}-${rowSeq++}`, kind: 'service', id: p.id, sku: p.sku, code: p.sku, name: p.name, qty: String(qty), unit: 'nos', rate: String(p.price) });

const CSS = `
.pt-head { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:14px; }
.pt-head h3 { margin:0; font-size:16px; }
.pt-sub { margin:2px 0 0; font-size:12.5px; color:var(--muted); }
.pt-cust { display:grid; grid-template-columns: minmax(180px,2fr) minmax(140px,1.2fr) minmax(180px,1.6fr) minmax(150px,1.4fr); gap:14px; }
.pt-cust label, .pt-lbl { display:block; font-size:11px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); margin-bottom:6px; }
.pt-cust input, .pt-cust select, .pt-in { width:100%; height:42px; padding:0 12px; border:1px solid var(--line); border-radius:10px; background:#ffffff; }
.pt-cust input:focus, .pt-cust select:focus, .pt-in:focus { outline:2px solid var(--forest-2); outline-offset:-1px; background:#fff; }
.pt-cust input:disabled { opacity:.5; cursor:not-allowed; }
.pt-rel { position:relative; }
.pt-drop { position:absolute; left:0; right:0; top:calc(100% + 4px); z-index:30; background:#fff; border:1px solid var(--line); border-radius:12px; box-shadow:var(--shadow-lg); max-height:280px; overflow-y:auto; min-width:260px; }
.pt-drop button { display:flex; width:100%; align-items:center; justify-content:space-between; gap:12px; padding:9px 12px; border:0; background:transparent; text-align:left; cursor:pointer; }
.pt-drop button:hover:not(:disabled) { background:var(--sage-soft); }
.pt-drop button:disabled { opacity:.45; cursor:not-allowed; }
.pt-drop small { color:var(--muted); display:block; font-size:11.5px; }
.pt-seg { display:inline-flex; border:1px solid var(--line); border-radius:999px; overflow:hidden; background:#ffffff; }
.pt-seg button { border:0; background:transparent; padding:8px 16px; font-weight:700; font-size:13px; color:var(--forest); cursor:pointer; }
.pt-seg button.on { background:var(--forest); color:#fff; }
.pt-scan { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
.pt-scan .pt-rel { flex:1 1 320px; max-width:520px; }
.pt-scan .pt-rel svg { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--muted); pointer-events:none; }
.pt-scan input { padding-left:38px; }
.pt-ready { margin-left:auto; display:flex; align-items:center; gap:8px; font-size:12.5px; font-weight:700; color:var(--forest-2); }
.pt-ready i { width:8px; height:8px; border-radius:50%; background:var(--rose-deep); display:inline-block; }
.pt-grid { display:grid; grid-template-columns: minmax(240px,1fr) 130px 120px 120px 40px; gap:12px; align-items:center; }
.pt-svc { position:relative; }
.pt-svc svg.pt-ic { position:absolute; left:12px; top:20px; transform:translateY(-50%); color:var(--muted); pointer-events:none; }
.pt-svc .pt-in { padding-left:38px; }
.pt-tag { display:inline-block; margin-top:4px; font-size:11px; font-weight:700; padding:1px 8px; border-radius:999px; background:var(--sage-soft); color:var(--forest-2); }
.pt-tag.c { background:#ffffff; color:#9a5b00; }
.pt-drop .on { background:var(--sage-soft); }
.pt-drop .pt-new { padding:10px 12px; font-size:13px; color:var(--muted); }
.pt-step { display:flex; align-items:center; border:1px solid var(--line); border-radius:10px; background:#ffffff; height:40px; overflow:hidden; }
.pt-step button { width:34px; height:100%; border:0; background:transparent; font-size:18px; font-weight:700; color:var(--forest); cursor:pointer; }
.pt-step button:hover { background:var(--sage-soft); }
.pt-step input { width:100%; min-width:0; border:0; background:transparent; text-align:center; font-weight:700; height:100%; }
.pt-step input:focus { outline:none; }
.pt-quick { display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin:0 0 14px; }
.pt-quick > span { font-size:12px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:.06em; margin-right:2px; }
.pt-chip { border:1px solid var(--line); background:#ffffff; border-radius:999px; padding:6px 12px; font-size:13px; font-weight:600; color:var(--forest); cursor:pointer; }
.pt-chip:hover { background:#fff; border-color:var(--forest-2); }
.pt-chip b { margin-left:6px; color:var(--muted); font-weight:600; }
.pt-hint { font-size:12.5px; color:var(--muted); margin:-6px 0 12px; }
.pt-th { padding:10px 4px; border-bottom:1px solid var(--line); font-size:11px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); }
.pt-th.r, .pt-amt { text-align:right; }
.pt-row { padding:8px 0; border-bottom:1px solid var(--line); }
.pt-row .pt-in { height:40px; }
.pt-amt { font-weight:700; padding-right:6px; }
.pt-keys { display:flex; gap:10px; flex-wrap:wrap; }
.pt-key { display:inline-flex; align-items:center; gap:6px; padding:6px 10px; border:1px solid var(--line); border-radius:8px; background:#ffffff; font-size:12.5px; font-weight:600; color:var(--forest); cursor:pointer; }
.pt-key kbd { font-family:inherit; font-size:11px; font-weight:800; background:var(--forest); color:#fff; border-radius:4px; padding:1px 5px; }
.pt-key:disabled { opacity:.4; cursor:not-allowed; }
.pt-bottom { display:grid; grid-template-columns: 1.4fr 1fr; gap:22px; margin-top:18px; }
.pt-tot > div { display:flex; justify-content:space-between; padding:6px 0; }
.pt-tot .pt-grand { border-top:2px solid var(--forest); margin-top:6px; padding-top:12px; font-size:20px; }
.pt-browse { display:grid; grid-template-columns: repeat(auto-fill, minmax(190px,1fr)); gap:10px; max-height:340px; overflow-y:auto; margin-top:12px; }
.pt-prod { text-align:left; border:1px solid var(--line); background:#ffffff; border-radius:12px; padding:10px 12px; cursor:pointer; }
.pt-prod:hover:not(:disabled) { border-color:var(--forest-2); background:#fff; }
.pt-prod:disabled { opacity:.45; cursor:not-allowed; }
.pt-prod strong { display:block; font-size:13.5px; }
.pt-prod span { display:flex; justify-content:space-between; font-size:12px; color:var(--muted); margin-top:4px; }
.pt-cam { width:100%; aspect-ratio:4/3; background:#111; border-radius:12px; object-fit:cover; }
@media (max-width: 1100px) { .pt-cust { grid-template-columns: 1fr 1fr; } .pt-bottom { grid-template-columns: 1fr; } }
@media (max-width: 900px) { .pt-wrap { overflow-x:auto; padding-bottom:140px; } .pt-grid { min-width:640px; } }
`;

function CameraScan({ onCode, t }) {
  const videoRef = useRef(null);
  const cb = useRef(onCode);
  cb.current = onCode;
  const [err, setErr] = useState('');
  useEffect(() => {
    let stream = null;
    let stopped = false;
    let timer = 0;
    (async () => {
      try {
        if (!('BarcodeDetector' in window)) {
          setErr(t('Camera scanning is not supported in this browser. Use a USB scanner or type the code.'));
          return;
        }
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (stopped) { stream.getTracks().forEach((x) => x.stop()); return; }
        const v = videoRef.current;
        v.srcObject = stream;
        await v.play();
        const det = new window.BarcodeDetector();
        const loop = async () => {
          if (stopped) return;
          try {
            const found = await det.detect(v);
            if (found.length && !stopped) { stopped = true; cb.current(found[0].rawValue); return; }
          } catch { /* keep scanning */ }
          timer = window.setTimeout(loop, 350);
        };
        loop();
      } catch {
        setErr(t('Could not open the camera. Allow camera permission and try again.'));
      }
    })();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      if (stream) stream.getTracks().forEach((x) => x.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return err ? <p className="muted">{err}</p> : <video ref={videoRef} className="pt-cam" muted playsInline />;
}

export default function POS() {
  const { user, notify, customers, orders, appointments, messages, markMessageRead } = useStore();
  const { t } = useT();
  const [ver, tick] = useState(0);
  const re = () => tick((n) => n + 1);
  useEffect(() => api.stock.subscribe(re), []);
  useEffect(() => api.catalogue.subscribe(re), []);

  const [rows, setRows] = useState(() => [newRow()]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [stateCode, setStateCode] = useState(DEFAULT_STATE);
  const [gstin, setGstin] = useState('');
  const [withGst, setWithGst] = useState(true);
  const [pay, setPay] = useState('Cash');
  const [notes, setNotes] = useState('');
  const [scan, setScan] = useState('');
  const [pick, setPick] = useState(null); // { rid, field: 'name' }
  const [hi, setHi] = useState(0); // highlighted suggestion (keyboard)
  const [custOpen, setCustOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [browseQ, setBrowseQ] = useState('');
  const [browseCat, setBrowseCat] = useState('all');
  const [lastInvoice, setLastInvoice] = useState(null);
  const [printInv, setPrintInv] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [tab, setTab] = useState('all');
  const [camOpen, setCamOpen] = useState(false);
  const [quick, setQuick] = useState(null); // { name, phone } when the quick-add dialog is open
  const [sources, setSources] = useState([]);
  const [billed, setBilled] = useState(() => { try { return JSON.parse(localStorage.getItem(BILLED_KEY) || '[]'); } catch { return []; } });
  const scanRef = useRef(null);

  // POS bills SERVICES only (shop products are sold online). Services have no stock, so they are always available.
  const products = useMemo(
    () => siteServices.map((sv) => ({ id: sv.id, sku: sv.id, name: sv.name, price: sv.price, category: sv.category, subcategory: '', duration: sv.duration, popular: !!sv.popular || !!sv.signature, stock: 999 })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ver]
  );
  const categories = useMemo(() => ['all', ...Array.from(new Set(products.map((p) => p.category)))], [products]);

  // Online orders, appointments and staff messages that are waiting for the counter.
  const inbox = useMemo(() => {
    const out = [
      ...orders
        .filter((o) => o.status !== 'Cancelled' && !billed.includes(o.id))
        .map((o) => ({ key: o.id, type: 'orders', at: o.placedAt || o.date, title: o.customer, sub: o.items.map((i) => `${i.name} × ${i.qty}`).join(', '), meta: `${o.id} · ${o.status}`, total: o.total, phone: o.phone, order: o })),
      ...appointments
        .filter((a) => OPEN_APPT.includes(a.status) && !billed.includes(a.id))
        .map((a) => ({ key: a.id, type: 'appointments', at: a.createdAt || a.date, title: a.customer, sub: a.service, meta: `${a.id} · ${a.date} ${a.time}`, total: a.price || 0, phone: a.phone, appt: a })),
      ...messages.map((m) => ({ key: `msg-${m.id}`, type: 'messages', at: m.at, title: m.from || 'System', sub: m.text, meta: new Date(m.at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }), unread: !m.read, msgId: m.id })),
    ];
    const ms = (v) => (typeof v === 'number' ? v : Date.parse(v) || 0);
    return out.sort((x, y) => ms(y.at) - ms(x.at));
  }, [orders, appointments, messages, billed]);
  const count = (k) => inbox.filter((r) => k === 'all' || r.type === k).length;
  const shown = inbox.filter((r) => tab === 'all' || r.type === tab);
  const waiting = inbox.filter((r) => r.type !== 'messages').length;

  // Bill lines come from the filled-in table rows.
  const lines = useMemo(
    () =>
      rows
        .filter((r) => r.name.trim() && Number(r.rate) > 0 && Number(r.qty) > 0)
        .map((r) => ({
          kind: r.kind,
          id: r.kind === 'custom' ? r.id || `custom-${r.rid}` : r.id,
          sku: r.kind === 'custom' ? r.code.trim() || 'CUSTOM' : r.sku,
          name: r.name.trim(),
          qty: Number(r.qty),
          unitPrice: Number(r.rate),
          gstRate: GST,
        })),
    [rows]
  );
  const gross = api.pos.cartGst(lines);
  const gst = withGst ? gross : { taxable: gross.total, cgst: 0, sgst: 0, total: gross.total };
  const stateName = (STATES.find((s) => s[1] === stateCode) || [''])[0];

  const patchRow = (rid, patch) => setRows((rs) => rs.map((r) => (r.rid === rid ? { ...r, ...patch } : r)));
  const focusCode = (rid) => window.setTimeout(() => { const el = document.querySelector(`[data-code="${rid}"]`); if (el) el.focus(); }, 30);
  const addRow = () => {
    const r = newRow();
    setRows((rs) => [...rs, r]);
    focusCode(r.rid);
  };
  const removeRow = (rid) => setRows((rs) => { const next = rs.filter((r) => r.rid !== rid); return next.length ? next : [newRow()]; });

  const applyProduct = (rid, p) => {
    if (p.stock <= 0) { notify('{name} is out of stock', 'error', { name: p.name }); return; }
    const dup = rows.find((r) => r.id === p.id && r.kind === 'service' && r.rid !== rid);
    if (dup) {
      patchRow(dup.rid, { qty: String(Math.min(p.stock, (Number(dup.qty) || 0) + 1)) });
      removeRow(rid);
    } else {
      patchRow(rid, { kind: 'service', id: p.id, sku: p.sku, code: p.sku, name: p.name, rate: String(p.price), qty: '1' });
    }
    setPick(null);
  };

  // Adds a product from the scanner, camera or the "browse all products" panel.
  const addProduct = (p) => {
    if (p.stock <= 0) { notify('{name} is out of stock', 'error', { name: p.name }); return; }
    const existing = rows.find((r) => r.kind === 'service' && r.id === p.id);
    if (existing) {
      const q = (Number(existing.qty) || 0) + 1;
      if (q > p.stock) { notify('Only {n} in stock', 'error', { n: p.stock }); return; }
      patchRow(existing.rid, { qty: String(q) });
      return;
    }
    setRows((rs) => {
      const blank = rs.find((r) => !r.name.trim() && !r.code.trim());
      return blank ? rs.map((r) => (r.rid === blank.rid ? { ...productRow(p), rid: blank.rid } : r)) : [...rs, productRow(p)];
    });
  };

  const findByCode = (v) => {
    const q = v.trim().toLowerCase();
    if (!q) return null;
    return products.find((p) => p.sku.toLowerCase() === q || String(p.id).toLowerCase() === q) || products.find((p) => p.name.toLowerCase() === q) || null;
  };

  const onScanEnter = (v) => {
    const p = findByCode(v);
    if (!p) { notify('No product found for code {code}', 'error', { code: v.trim() }); return; }
    addProduct(p);
    setScan('');
  };

  const setQty = (r, v) => {
    const digits = v.replace(/\D/g, '').slice(0, 3);
    if (r.kind === 'product') {
      const p = products.find((x) => x.id === r.id);
      if (p && Number(digits) > p.stock) { notify('Only {n} in stock', 'error', { n: p.stock }); patchRow(r.rid, { qty: String(p.stock) }); return; }
    }
    patchRow(r.rid, { qty: digits });
  };

  const suggestions = (query) => {
    const q = query.trim().toLowerCase();
    const list = q ? products.filter((p) => `${p.name} ${p.sku} ${p.category} ${p.subcategory || ''}`.toLowerCase().includes(q)) : products;
    return list;
  };

  // Loads an inbox order / appointment into the table. Online orders already reduced stock when placed, so they are plain lines.
  const addFromInbox = (r) => {
    if (sources.includes(r.key)) { notify('Already added to the bill.', 'info'); return; }
    const add = r.order
      ? r.order.items.map((i) => ({ ...newRow(), kind: 'custom', id: `${r.key}-${i.productId || i.name}`, code: r.key, name: i.name, qty: String(i.qty), rate: String(i.price) }))
      : [{ ...newRow(), kind: 'service', id: `${r.key}-${r.appt.service}`, sku: r.key, code: r.key, name: r.appt.service, qty: '1', rate: String(r.appt.price || 0) }];
    setRows((rs) => [...rs.filter((x) => x.name.trim()), ...add]);
    if (!customerName) setCustomerName(r.title || '');
    if (!customerPhone) setCustomerPhone(String(r.phone || '').replace(/\D/g, '').slice(-10));
    setSources((x) => [...x, r.key]);
    notify('Added to the bill.');
  };

  const pickCustomer = (c) => {
    setCustomerName(c.name);
    setCustomerPhone((c.phone || '').replace(/\D/g, '').slice(-10));
    setCustOpen(false);
  };
  const custMatches = useMemo(() => {
    const q = customerName.trim().toLowerCase();
    if (!q) return [];
    return customers.filter((c) => `${c.name} ${c.phone || ''}`.toLowerCase().includes(q)).slice(0, 6);
  }, [customers, customerName]);

  const clearAll = () => {
    setRows([newRow()]);
    setCustomerName('');
    setCustomerPhone('');
    setGstin('');
    setNotes('');
    setScan('');
    setSources([]);
    setStateCode(DEFAULT_STATE);
  };

  const checkout = () => {
    if (!lines.length) { notify('Add at least one item', 'error'); return; }
    if (customerPhone && !/^[6-9]\d{9}$/.test(customerPhone)) { notify('Enter a valid 10-digit mobile number', 'error'); return; }
    if (withGst && gstin.trim() && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin.trim().toUpperCase())) {
      notify('Enter a valid 15-character GSTIN or leave it empty.', 'error');
      return;
    }
    try {
      const stateNote = withGst && stateName ? `State: ${stateName} (${stateCode})` : '';
      const result = api.pos.createInvoice({
        customerName: customerName || 'Walk-in',
        customerPhone,
        lines,
        payment: pay,
        cashier: user?.name || 'Staff',
        cashierRole: user?.role || 'Staff',
        notes: [notes.trim(), stateNote].filter(Boolean).join(' | '),
        withGst,
        gstin,
        deductStock: true,
        baseStockOf: (id) => {
          const p = catalogue().find((x) => x.id === id);
          return p?.baseStock ?? p?.stock ?? 0;
        },
      });
      if (result.stockErrors.length) notify('Stock warning: {list}', 'info', { list: result.stockErrors.join(', ') });
      if (sources.length) {
        const next = [...billed, ...sources];
        setBilled(next);
        try { localStorage.setItem(BILLED_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
      }
      setLastInvoice(result.invoice);
      notify('Invoice {id} created · {total}', 'success', { id: result.invoice.id, total: inr(result.invoice.total) });
      clearAll();
      re();
    } catch (e) {
      notify(e.message || 'Could not create invoice', 'error');
    }
  };

  // Keyboard shortcuts: F2 add row, F3 focus scanner, F12 process invoice.
  const keyRef = useRef(null);
  keyRef.current = (e) => {
    if (lastInvoice || printInv || showHistory || inboxOpen || camOpen || quick) return;
    if (e.key === 'F2') { e.preventDefault(); addRow(); }
    else if (e.key === 'F3') { e.preventDefault(); if (scanRef.current) scanRef.current.focus(); }
    else if (e.key === 'F12') { e.preventDefault(); checkout(); }
  };
  useEffect(() => {
    const h = (e) => keyRef.current && keyRef.current(e);
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
  useEffect(() => {
    const h = (e) => {
      if (!e.target.closest || !e.target.closest('[data-pt-pick]')) setPick(null);
      if (!e.target.closest || !e.target.closest('[data-pt-cust]')) setCustOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const invoices = api.pos.listInvoices(30);
  const browseList = products.filter((p) => (browseCat === 'all' || p.category === browseCat) && (!browseQ.trim() || `${p.name} ${p.sku}`.toLowerCase().includes(browseQ.trim().toLowerCase())));

  const saveQuick = () => {
    const name = quick.name.trim();
    if (name.length < 2) { notify('Enter the customer name.', 'error'); return; }
    if (quick.phone && !/^[6-9]\d{9}$/.test(quick.phone)) { notify('Enter a valid 10-digit mobile number', 'error'); return; }
    setCustomerName(name);
    setCustomerPhone(quick.phone);
    setQuick(null);
  };

  return (
    <div className="page">
      <style>{CSS}</style>
      <PageHeader
        title={t('Billing')}
        subtitle={t('Service billing with or without GST. Demo only — no real payments.')}
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => setInboxOpen(true)}>
              <Inbox size={17} /> {t('Online orders & appointments')} ({waiting})
            </button>
            <button className="btn btn-ghost" onClick={() => setShowHistory(true)}>
              <Receipt size={17} /> {t('Recent invoices')}
            </button>
          </>
        }
      />

      {/* Customer & invoice details */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="pt-head">
          <div>
            <h3>{t('Customer & Invoice Details')}</h3>
            <p className="pt-sub">{t('Search an existing customer or enter walk-in details')}</p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="pt-seg" role="group" aria-label={t('Bill type')}>
              <button type="button" className={withGst ? 'on' : ''} aria-pressed={withGst} onClick={() => setWithGst(true)}>{t('With GST')}</button>
              <button type="button" className={!withGst ? 'on' : ''} aria-pressed={!withGst} onClick={() => setWithGst(false)}>{t('Without GST')}</button>
            </div>
            <button type="button" className="btn btn-soft small" onClick={() => { setCustomerName('Walk-in'); setCustomerPhone(''); }}>{t('Walk-in Customer')}</button>
            <button type="button" className="btn btn-ghost small" onClick={() => setQuick({ name: '', phone: '' })}><UserPlus size={15} /> {t('Quick Add Customer')}</button>
          </div>
        </div>
        <div className="pt-cust">
          <div className="pt-rel" data-pt-cust>
            <label htmlFor="pt-name">{t('Customer name')} *</label>
            <input id="pt-name" value={customerName} autoComplete="off" onChange={(e) => { setCustomerName(e.target.value); setCustOpen(true); }} onFocus={() => setCustOpen(true)} placeholder={t('Search or type name')} />
            {custOpen && custMatches.length > 0 && (
              <div className="pt-drop" style={{ top: 'calc(100% + 4px)' }}>
                {custMatches.map((c) => (
                  <button key={c.id} type="button" onClick={() => pickCustomer(c)}>
                    <span><strong>{c.name}</strong><small>{c.phone || t('No phone')}</small></span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label htmlFor="pt-phone">{t('Phone number')}</label>
            <input id="pt-phone" value={customerPhone} inputMode="numeric" onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder={t('10-digit mobile')} />
          </div>
          <div>
            <label htmlFor="pt-state">{t('State / UT code (for tax)')}</label>
            <select id="pt-state" value={stateCode} onChange={(e) => setStateCode(e.target.value)} disabled={!withGst}>
              {STATES.map(([n, c]) => <option key={c} value={c}>{n} ({c})</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="pt-gstin">{t('GSTIN (optional)')}</label>
            <input id="pt-gstin" value={gstin} disabled={!withGst} onChange={(e) => setGstin(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15))} placeholder={t('15-digit GSTIN')} />
          </div>
        </div>
      </div>

      {/* Product line items */}
      <div className="card">
        <div className="pt-head">
          <h3>{t('Service Line Items')}</h3>
          <div className="pt-keys">
            <button type="button" className="pt-key" onClick={addRow}><kbd>F2</kbd> {t('Add Row')}</button>
            <button type="button" className="pt-key" onClick={checkout} disabled={!lines.length}><kbd>F12</kbd> {t('Process Invoice')}</button>
            {rows.some((r) => r.name || r.code) && <button type="button" className="pt-key" onClick={clearAll}><Trash2 size={13} /> {t('Clear')}</button>}
          </div>
        </div>

        <div className="pt-quick">
          <span>{t('Quick add')}</span>
          {products.filter((p) => p.popular).slice(0, 8).map((p) => (
            <button key={p.id} type="button" className="pt-chip" onClick={() => addProduct(p)}>{p.name}<b>{inr(p.price)}</b></button>
          ))}
        </div>
        <p className="pt-hint">{t('Click the Service box and start typing to search. Pick a service and the price fills in. Type anything else to bill a custom item and enter its rate.')}</p>

        <div className="pt-wrap">
          <div className="pt-grid">
            <div className="pt-th">{t('Service')}</div>
            <div className="pt-th r">{t('Qty')}</div>
            <div className="pt-th r">{t('Rate (₹)')}</div>
            <div className="pt-th r">{t('Amount (₹)')}</div>
            <div className="pt-th" />
          </div>
          {rows.map((r) => {
            const amount = (Number(r.rate) || 0) * (Number(r.qty) || 0);
            const open = pick && pick.rid === r.rid;
            const list = open ? suggestions(r.name).slice(0, 30) : [];
            const typed = r.name.trim();
            const setQtyNum = (n) => patchRow(r.rid, { qty: String(Math.max(1, Math.min(999, n))) });
            return (
              <div key={r.rid} className="pt-grid pt-row">
                <div className="pt-svc" data-pt-pick>
                  <Search size={16} className="pt-ic" />
                  <input
                    className="pt-in"
                    data-code={r.rid}
                    value={r.name}
                    placeholder={t('Search a service or type a custom item…')}
                    autoComplete="off"
                    onFocus={() => { setPick({ rid: r.rid, field: 'name' }); setHi(0); }}
                    onChange={(e) => { patchRow(r.rid, { name: e.target.value, code: '', kind: 'custom', id: '', sku: '' }); setPick({ rid: r.rid, field: 'name' }); setHi(0); }}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowDown') { e.preventDefault(); setPick({ rid: r.rid, field: 'name' }); setHi((h) => Math.min(h + 1, Math.max(list.length - 1, 0))); }
                      else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
                      else if (e.key === 'Enter') {
                        e.preventDefault();
                        if (open && list[hi]) applyProduct(r.rid, list[hi]);
                        else if (typed) { setPick(null); const el = document.querySelector(`[data-rate="${r.rid}"]`); if (el) el.focus(); }
                      }
                      else if (e.key === 'Escape') setPick(null);
                    }}
                  />
                  {typed && r.kind === 'service' && <span className="pt-tag">{t('Service')}</span>}
                  {typed && r.kind !== 'service' && <span className="pt-tag c">{t('Custom item — enter the rate')}</span>}
                  {open && (
                    <div className="pt-drop">
                      {list.map((p, i) => (
                        <button key={p.id} type="button" className={i === hi ? 'on' : ''} onMouseEnter={() => setHi(i)} onClick={() => applyProduct(r.rid, p)}>
                          <span><strong>{p.name}</strong><small>{p.category}{p.duration ? ` · ${p.duration} min` : ''}</small></span>
                          <strong>{inr(p.price)}</strong>
                        </button>
                      ))}
                      {!list.length && <div className="pt-new">{typed ? t('No matching service. Press Enter to bill "{name}" as a custom item.', { name: typed }) : t('No services found.')}</div>}
                    </div>
                  )}
                </div>
                <div className="pt-step">
                  <button type="button" aria-label={t('Decrease')} onClick={() => setQtyNum((Number(r.qty) || 1) - 1)}>−</button>
                  <input value={r.qty} inputMode="numeric" aria-label={t('Quantity')} onChange={(e) => setQty(r, e.target.value)} />
                  <button type="button" aria-label={t('Increase')} onClick={() => setQtyNum((Number(r.qty) || 0) + 1)}>+</button>
                </div>
                <input className="pt-in" data-rate={r.rid} style={{ textAlign: 'right' }} value={r.rate} inputMode="decimal" placeholder="0.00" aria-label={t('Rate')} onChange={(e) => patchRow(r.rid, { rate: e.target.value.replace(/[^\d.]/g, '') })} />
                <div className="pt-amt">{inr(amount)}</div>
                <button type="button" className="icon-btn" onClick={() => removeRow(r.rid)} aria-label={t('Remove')}><X size={15} /></button>
              </div>
            );
          })}
        </div>
        <button type="button" className="btn btn-soft small" style={{ marginTop: 12 }} onClick={addRow}><Plus size={15} /> {t('Add another service')}</button>

        <div className="pt-bottom">
          <div>
            <span className="pt-lbl">{t('Payment')}</span>
            <div className="pos-pay-methods">
              {PAY_METHODS.map((m) => {
                const Icon = m.icon;
                return (
                  <button key={m.id} type="button" className={pay === m.id ? 'active' : ''} onClick={() => setPay(m.id)}>
                    <Icon size={18} />
                    {t(m.label)}
                  </button>
                );
              })}
            </div>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('Notes (optional)')} rows={2} style={{ width: '100%', marginTop: 12, resize: 'vertical' }} />
          </div>
          <div>
            <div className="pt-tot">
              {withGst && (
                <>
                  <div><span className="muted">{t('Taxable value')}</span><strong>{inr(gst.taxable)}</strong></div>
                  <div><span className="muted">CGST ({GST / 2}%)</span><strong>{inr(gst.cgst)}</strong></div>
                  <div><span className="muted">SGST ({GST / 2}%)</span><strong>{inr(gst.sgst)}</strong></div>
                </>
              )}
              <div className="pt-grand"><span>{t('Grand total')}</span><strong>{inr(gst.total)}</strong></div>
            </div>
            <button className="btn btn-primary btn-block" style={{ marginTop: 12, height: 48 }} onClick={checkout} disabled={!lines.length}>
              <Receipt size={18} /> {t('Process Invoice')} {gst.total > 0 ? inr(gst.total) : ''}
            </button>
            <p className="muted" style={{ marginTop: 8, fontSize: 12.5 }}>
              {withGst ? t('Prices include 18% GST. CGST + SGST shown on the bill.') : t('Bill without GST: same prices, no tax breakup is shown on the bill.')}
            </p>
          </div>
        </div>
      </div>

      {/* Online orders & appointments */}
      {inboxOpen && (
        <Modal title={t('Online orders & appointments')} subtitle={t('Add them to the bill with one click')} wide onClose={() => setInboxOpen(false)} footer={<button className="btn btn-primary" onClick={() => setInboxOpen(false)}>{t('Done')}</button>}>
          <div className="pos-tabs" style={{ flexWrap: 'wrap', marginBottom: 12 }}>
            {[['all', Inbox, 'All'], ['orders', ShoppingBag, 'Orders'], ['appointments', CalendarDays, 'Appointments'], ['messages', MessageSquare, 'Messages']].map(([id, Icon, label]) => (
              <button key={id} type="button" className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
                <Icon size={16} /> {t(label)} ({count(id)})
              </button>
            ))}
          </div>
          <ul className="list" style={{ maxHeight: 420, overflowY: 'auto' }}>
            {shown.map((r) => (
              <li key={r.key} style={{ alignItems: 'flex-start', gap: 12 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <strong>{r.title}</strong>{' '}{r.unread && <Badge tone="blue">{t('New')}</Badge>}
                  <span className="muted block" style={{ whiteSpace: 'normal' }}>{r.sub}</span>
                  <span className="muted block" style={{ fontSize: 12 }}>{r.meta}</span>
                </div>
                {r.type === 'messages' ? (
                  r.unread && <button type="button" className="btn btn-ghost small" onClick={() => markMessageRead(r.msgId)}><Check size={15} /> {t('Mark read')}</button>
                ) : (
                  <div style={{ textAlign: 'right' }}>
                    <strong>{inr(r.total)}</strong>
                    <button type="button" className="btn btn-soft small" style={{ display: 'flex', marginTop: 6 }} disabled={sources.includes(r.key)} onClick={() => addFromInbox(r)}>
                      <Plus size={15} /> {sources.includes(r.key) ? t('Added') : t('Add to bill')}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {!shown.length && <p className="muted" style={{ padding: 12 }}>{t('Your inbox is empty. New orders, appointments and messages will appear here.')}</p>}
        </Modal>
      )}

      {/* Quick add customer */}
      {quick && (
        <Modal title={t('Quick Add Customer')} subtitle={t('Used on this bill only')} onClose={() => setQuick(null)} footer={<><button className="btn btn-ghost" onClick={() => setQuick(null)}>{t('Cancel')}</button><button className="btn btn-primary" onClick={saveQuick}>{t('Use on bill')}</button></>}>
          <label className="pt-lbl" htmlFor="pt-q-name">{t('Customer name')} *</label>
          <input id="pt-q-name" className="pt-in" value={quick.name} onChange={(e) => setQuick({ ...quick, name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && saveQuick()} />
          <label className="pt-lbl" htmlFor="pt-q-phone" style={{ marginTop: 12 }}>{t('Phone number')}</label>
          <input id="pt-q-phone" className="pt-in" value={quick.phone} inputMode="numeric" onChange={(e) => setQuick({ ...quick, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} onKeyDown={(e) => e.key === 'Enter' && saveQuick()} />
        </Modal>
      )}

      {/* Camera scan */}
      {camOpen && (
        <Modal title={t('Scan with Camera')} subtitle={t('Point the camera at the product barcode')} onClose={() => setCamOpen(false)} footer={<button className="btn btn-ghost" onClick={() => setCamOpen(false)}>{t('Close')}</button>}>
          <CameraScan t={t} onCode={(code) => { setCamOpen(false); onScanEnter(code); }} />
        </Modal>
      )}

      {/* Success modal */}
      {lastInvoice && (
        <Modal
          title={t('Invoice {id}', { id: lastInvoice.id })}
          subtitle={t('Payment recorded · {method}', { method: lastInvoice.payment })}
          onClose={() => setLastInvoice(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setLastInvoice(null)}>{t('Close')}</button>
              <button className="btn btn-soft" onClick={() => setPrintInv(lastInvoice)}><Printer size={16} /> {t('Print')}</button>
              {lastInvoice.customerPhone && (
                <button className="btn btn-primary" onClick={() => setLastInvoice(null)}><MessageSquare size={16} /> {t('SMS sent')}</button>
              )}
            </>
          }
        >
          <div className="detail-grid">
            <div>
              <h4 className="mini-title">{t('Customer')}</h4>
              <p>
                <strong>{lastInvoice.customerName}</strong>
                {lastInvoice.customerPhone && <span className="muted block">{lastInvoice.customerPhone}</span>}
              </p>
              <h4 className="mini-title" style={{ marginTop: 14 }}>{t('Items')}</h4>
              <ul className="list">
                {lastInvoice.lines.map((l) => (
                  <li key={`${l.kind}-${l.id}`}>
                    <div>
                      <strong>{l.name}</strong>
                      <span className="muted">{l.qty} × {inr(l.unitPrice)}</span>
                    </div>
                    <strong>{inr(l.unitPrice * l.qty)}</strong>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="mini-title">{t('GST breakup')}</h4>
              <ul className="list">
                {lastInvoice.withGst !== false ? (
                  <>
                    <li><span>{t('Taxable value')}</span><strong>{inr(lastInvoice.taxable)}</strong></li>
                    <li><span>CGST 9%</span><strong>{inr(lastInvoice.cgst)}</strong></li>
                    <li><span>SGST 9%</span><strong>{inr(lastInvoice.sgst)}</strong></li>
                  </>
                ) : (
                  <li><span className="muted">{t('Bill without GST')}</span></li>
                )}
                {lastInvoice.gstin && (<li><span>GSTIN</span><strong>{lastInvoice.gstin}</strong></li>)}
                <li><span><strong>{t('Total')}</strong></span><strong>{inr(lastInvoice.total)}</strong></li>
              </ul>
              <h4 className="mini-title" style={{ marginTop: 14 }}>{t('Bill link')}</h4>
              <p className="muted" style={{ wordBreak: 'break-all' }}>{lastInvoice.shortLink}</p>
              <p className="muted" style={{ marginTop: 8, fontSize: 12.5 }}>{t('Cashier')}: {lastInvoice.cashier} ({lastInvoice.cashierRole})</p>
            </div>
          </div>
        </Modal>
      )}

      {printInv && (
        <PrintPreview title={t('Print bill')} subtitle={printInv.id} html={buildInvoiceDocs([printInv])} onClose={() => setPrintInv(null)} />
      )}

      {/* History */}
      {showHistory && (
        <Modal
          title={t('Recent POS invoices')}
          subtitle={t('Sample + live demo invoices')}
          wide
          onClose={() => setShowHistory(false)}
          footer={<button className="btn btn-primary" onClick={() => setShowHistory(false)}>{t('Done')}</button>}
        >
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('Invoice')}</th>
                  <th>{t('Customer')}</th>
                  <th>{t('Payment')}</th>
                  <th>{t('CGST')}</th>
                  <th>{t('SGST')}</th>
                  <th>{t('Total')}</th>
                  <th>{t('Cashier')}</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      <strong>{inv.id}</strong>
                      <span className="muted block">{new Date(inv.at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    </td>
                    <td>
                      {inv.customerName}
                      {inv.customerPhone && <span className="muted block">{inv.customerPhone}</span>}
                    </td>
                    <td><Badge>{inv.payment}</Badge></td>
                    <td>{inv.withGst === false ? '-' : inr(inv.cgst)}</td>
                    <td>{inv.withGst === false ? '-' : inr(inv.sgst)}</td>
                    <td><strong>{inr(inv.total)}</strong></td>
                    <td>{inv.cashier}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </div>
  );
}
