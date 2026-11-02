import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Eye, Printer, ScanLine, Camera, ImagePlus } from 'lucide-react';
import { useStore } from '../store.jsx';
import { api } from '../../api';
import { getOrders, setOrderStage, cancelOrder, subscribeData } from '../../site/account';
import { inr } from '../data/mockData.js';
import PageHeader from '../components/PageHeader.jsx';
import DataTable from '../components/DataTable.jsx';
import Modal from '../components/Modal.jsx';
import { useT } from '../i18n.js';
import PrintPreview from '../components/PrintPreview.jsx';
import { ORDER_PRINT_TYPES, buildOrderDocs, orderLink, findOrderByQr, printPages, qrSvg } from '../lib/orderPrint.js';
import { makeQrDecoder, decodeQrFile } from '../lib/qrScan.js';
import { STAGES, FILTERS, statusOf, when, loadPrinted, addPrinted } from '../lib/orderMeta.js';

// Order list. Clicking a row (or scanning its QR) opens that order on its own details page: pages/OrderDetail.jsx (#/orders/<id>).
// Marking an order Shipped sends the "Product Dispatched" DLT SMS to the customer's phone (once).
// BACKEND: GET /api/orders, PATCH /api/orders/:id/status. The server sends the SMS and writes the audit entry; stages only move forward.
const MAX_PRINT = 50; // orders per print job

export default function Orders({ onNavigate }) {
  const { notify, user } = useStore();
  const { t, lang } = useT();
  const [, tick] = useState(0);
  const re = () => tick((n) => n + 1);
  useEffect(() => subscribeData(re), []); // new orders from customers appear live
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('All');
  const [sel, setSel] = useState([]); // order ids ticked for printing (max 50)
  const [printType, setPrintType] = useState('both'); // both | slip | bill
  const [printJob, setPrintJob] = useState(null); // { ids, type }
  const [scanOpen, setScanOpen] = useState(false);
  const [printed, setPrinted] = useState(loadPrinted); // ids already printed (so the next batch of 50 is easy to pick)
  const actor = user?.name || 'Admin', role = user?.role || 'Admin';

  const orders = getOrders();
  const rows = useMemo(
    () => [...orders].sort((a, b) => String(b.placed).localeCompare(String(a.placed))).filter((o) =>
      (status === 'All' || statusOf(o) === status) &&
      (!q.trim() || `${o.id} ${o.customer || ''} ${o.phone || ''}`.toLowerCase().includes(q.trim().toLowerCase()))
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(orders), q, status]
  );
  const openOrder = (id) => onNavigate('orders', null, id); // separate details page

  const change = (o, target) => {
    if (target === 'Cancelled') {
      const r = cancelOrder(o.id);
      if (!r.ok) { notify(r.reason === 'dispatched' ? 'A dispatched order cannot be cancelled.' : 'This order cannot be cancelled.', 'error'); re(); return; }
      api.audit.log(actor, role, 'order.status', `${o.id} cancelled`, { orderId: o.id });
      notify('{id} marked as {status}.', 'success', { id: o.id, status: 'Cancelled' });
    } else {
      const r = setOrderStage(o.id, STAGES.indexOf(target));
      if (!r.ok) { notify(r.reason === 'backwards' ? 'An order can only move forward.' : 'This order cannot be updated.', 'error'); re(); return; }
      api.audit.log(actor, role, 'order.status', `${o.id} marked as ${target}`, { orderId: o.id });
      notify('{id} marked as {status}.', 'success', { id: o.id, status: target });
      if (r.smsSent) notify('Dispatch SMS sent to the customer.', 'info');
    }
    re();
  };
  const optionsFor = (o) => FILTERS.map((s) => {
    const idx = STAGES.indexOf(s);
    const disabled = o.cancelled ? s !== 'Cancelled' : s === 'Cancelled' ? o.stage >= 3 : idx < o.stage;
    return <option key={s} value={s} disabled={disabled && s !== statusOf(o)}>{t(s)}</option>;
  });

  // ---- QR, slips and bills ----
  const findOrder = (id) => orders.find((o) => o.id === id);
  const jobOrders = printJob ? printJob.ids.map(findOrder).filter(Boolean) : [];
  const jobHtml = useMemo(() => (printJob ? buildOrderDocs(printJob.ids.map(findOrder).filter(Boolean), printJob.type) : ''), [printJob]); // eslint-disable-line
  const toggleSel = (id) => {
    if (sel.includes(id)) { setSel(sel.filter((x) => x !== id)); return; }
    if (sel.length >= MAX_PRINT) { notify('You can print up to 50 orders at a time.', 'error'); return; }
    setSel([...sel, id]);
  };
  const selectNext = () => {
    const fresh = rows.filter((o) => !printed.includes(o.id));
    const pick = (fresh.length ? fresh : rows).slice(0, MAX_PRINT).map((o) => o.id);
    setSel(pick);
    if (!pick.length) notify('No orders to select.', 'error');
  };
  const startPrint = (ids, type = printType) => {
    const list = ids.map(findOrder).filter(Boolean);
    if (!list.length) return;
    setPrintJob({ ids: list.map((o) => o.id), type });
  };
  const donePrinting = () => {
    const ids = jobOrders.map((o) => o.id);
    setPrinted(addPrinted(ids));
    api.audit.log(actor, role, 'order.status', `Printed ${printJob.type === 'both' ? 'slip + bill' : printJob.type} for ${ids.length} order(s)`, { orders: ids.length });
    setSel((c) => c.filter((x) => !ids.includes(x)));
  };
  const onScanned = (o) => {
    setScanOpen(false);
    notify('Order {id} found. Opening its details.', 'success', { id: o.id });
    openOrder(o.id);
  };

  const summary = (o) => o.items.map((i) => `${i.name} x${i.qty}`).join(', ');
  const columns = [
    { key: 'sel', label: '', width: '44px', render: (o) => <input type="checkbox" checked={sel.includes(o.id)} onClick={(e) => e.stopPropagation()} onChange={() => toggleSel(o.id)} aria-label={`Select ${o.id}`} /> },
    { key: 'id', label: t('Order'), render: (o) => <div><strong>{o.id}</strong>{printed.includes(o.id) && <span className="muted block" style={{ fontSize: 12 }}>{t('Printed')}</span>}</div> },
    { key: 'qr', label: t('QR'), width: '104px', render: (o) => (
      <button type="button" className="icon-btn" title={t('Open order details')} aria-label={`QR ${o.id}`} onClick={(e) => { e.stopPropagation(); openOrder(o.id); }}
        style={{ width: 88, height: 88, padding: 2, background: '#fff', border: '1px solid var(--line)' }} dangerouslySetInnerHTML={{ __html: qrSvg(orderLink(o), 82) }} />
    ) },
    { key: 'customer', label: t('Customer'), render: (o) => <div><strong>{o.customer || t('Customer')}</strong>{o.phone && <span className="muted block">{o.phone}</span>}</div> },
    { key: 'date', label: t('Date'), render: (o) => when(o.placed, lang) },
    { key: 'items', label: t('Items'), render: (o) => <span className="clip" title={summary(o)}>{t('{n} item(s): {summary}', { n: o.items.reduce((s, i) => s + i.qty, 0), summary: summary(o) })}</span> },
    { key: 'total', label: t('Total'), render: (o) => <strong>{inr(o.total)}</strong> },
    { key: 'payment', label: t('Payment'), render: (o) => <span className="muted">{t(o.payment) !== o.payment ? t(o.payment) : o.payment}</span> },
    { key: 'status', label: t('Fulfilment'), render: (o) => (
      <select className="status-select" value={statusOf(o)} onClick={(e) => e.stopPropagation()} disabled={o.cancelled || o.stage === 4}
        onChange={(e) => change(o, e.target.value)} aria-label={t('Status for {id}', { id: o.id })}>
        {optionsFor(o)}
      </select>
    ) },
    { key: 'view', label: '', width: '100px', render: (o) => (
      <div className="row-actions" style={{ display: 'flex', gap: 4 }}>
        <button className="icon-btn" onClick={(e) => { e.stopPropagation(); openOrder(o.id); }} aria-label={t('View {id}', { id: o.id })} title={t('View')}><Eye size={17} /></button>
        <button className="icon-btn" onClick={(e) => { e.stopPropagation(); startPrint([o.id]); }} aria-label={`${t('Print')} ${o.id}`} title={t('Print')}><Printer size={17} /></button>
      </div>
    ) }
  ];

  return (
    <div className="page">
      <PageHeader title={t('Order management')} subtitle={t('Orders placed from the customer shop. Stages move forward only: Order placed, confirmed, packed, shipped, delivered. Marking Shipped sends the SMS.')} />
      <div className="filters">
        <div className="search-box"><Search size={17} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Search by order ID or customer')} aria-label={t('Search orders')} /></div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t('Filter by fulfilment status')}>
          <option value="All">{t('All fulfilment statuses')}</option>{FILTERS.map((s) => <option key={s} value={s}>{t(s)}</option>)}
        </select>
      </div>
      <div className="card" style={{ padding: '12px 16px', marginBottom: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <strong>{t('Print slips & bills')}</strong>
        <select value={printType} onChange={(e) => setPrintType(e.target.value)} aria-label={t('What to print')} style={{ width: 'auto' }}>
          {ORDER_PRINT_TYPES.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}
        </select>
        <button className="btn btn-ghost small" onClick={selectNext}>{t('Select next 50')}</button>
        {sel.length > 0 && <button className="btn btn-ghost small" onClick={() => setSel([])}>{t('Clear')}</button>}
        <span className="muted">{sel.length} / {MAX_PRINT} {t('selected')}</span>
        <span style={{ flex: 1 }} />
        <button className="btn btn-ghost" onClick={() => setScanOpen(true)}><ScanLine size={16} />{t('Scan QR')}</button>
        <button className="btn btn-primary" disabled={!sel.length} onClick={() => startPrint(sel)}><Printer size={16} />{t('Print selected')} ({sel.length})</button>
      </div>
      <div className="card flush"><DataTable columns={columns} rows={rows} onRowClick={(o) => openOrder(o.id)} /></div>

      {scanOpen && <ScanModal t={t} orders={orders} notify={notify} onFound={onScanned} onClose={() => setScanOpen(false)} />}
      {printJob && jobOrders.length > 0 && (
        <PrintPreview
          title={printJob.type === 'slip' ? t('Dispatch slips') : printJob.type === 'bill' ? t('Bills') : t('Dispatch slips and bills')}
          subtitle={t('{n} order(s), {p} page(s). Check the preview, then press Print.', { n: jobOrders.length, p: printPages(jobOrders.length, printJob.type) })}
          html={jobHtml} onPrint={donePrinting} onClose={() => setPrintJob(null)} />
      )}
    </div>
  );
}

// Scan an order QR: with a USB / Bluetooth scanner (it types the QR text, click the box first), by pasting the text,
// with the device camera, or by choosing a photo / screenshot of the QR. Camera scanning uses the browser's BarcodeDetector
// where available and falls back to jsQR, so it also works in Firefox / Safari (needs https or localhost for the camera).
function ScanModal({ t, orders, notify, onFound, onClose }) {
  const [text, setText] = useState('');
  const [cam, setCam] = useState(false);
  const [camErr, setCamErr] = useState('');
  const [busy, setBusy] = useState(false);
  const videoRef = useRef(null);
  const fileRef = useRef(null);
  const ordersRef = useRef(orders);
  ordersRef.current = orders;
  const doneRef = useRef(false);

  // true when the text matched an order (and the page is moving on), false otherwise
  const submit = (raw) => {
    if (doneRef.current) return true;
    const o = findOrderByQr(raw, ordersRef.current);
    if (!o) return false;
    doneRef.current = true;
    onFound(o);
    return true;
  };
  const submitManual = (raw) => { if (!raw.trim()) return; if (!submit(raw)) notify('No order matches this QR.', 'error'); };

  const pickFile = async (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const raw = await decodeQrFile(file);
      if (!raw) notify('No QR code was found in that picture. Try a clearer, closer photo.', 'error');
      else submitManual(raw);
    } catch { notify('Could not read that picture.', 'error'); }
    setBusy(false);
  };

  useEffect(() => {
    if (!cam) return undefined;
    let stream; let stop = false; let timer;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('nocamera');
        const decode = await makeQrDecoder();
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (stop) { stream.getTracks().forEach((tr) => tr.stop()); return; }
        const v = videoRef.current;
        if (!v) return;
        v.srcObject = stream;
        await v.play();
        let lastBad = '';
        const loop = async () => {
          if (stop || doneRef.current) return;
          try {
            if (v.readyState >= 2) {
              const raw = await decode(v);
              if (raw && !submit(raw) && raw !== lastBad) { lastBad = raw; notify('This QR is not an order from this shop.', 'error'); }
            }
          } catch { /* keep scanning */ }
          timer = setTimeout(loop, 250);
        };
        loop();
      } catch (err) {
        setCamErr(err.message === 'jsqr' ? 'Could not load the QR reader. Check the internet connection, or use a USB scanner / choose a photo instead.'
          : err.message === 'nocamera' ? 'This browser cannot open the camera here. Use a USB scanner, paste the QR text, or choose a photo.'
          : 'Could not open the camera. Allow camera access (the page must be on https or localhost).');
        setCam(false);
      }
    })();
    return () => { stop = true; clearTimeout(timer); if (stream) stream.getTracks().forEach((tr) => tr.stop()); };
  }, [cam]); // eslint-disable-line

  return (
    <Modal title={t('Scan order QR')} subtitle={t('Scanning a QR opens that order\'s details page.')} onClose={onClose}
      footer={<button className="btn btn-ghost" onClick={onClose}>{t('Close')}</button>}>
      <label className="field"><span className="field-label">{t('Scanner box')}</span>
        <input autoFocus value={text} onChange={(e) => setText(e.target.value)} onPaste={(e) => { const p = e.clipboardData.getData('text'); if (p) { e.preventDefault(); submitManual(p); } }}
          onKeyDown={(e) => { if (e.key === 'Enter') { submitManual(text); setText(''); } }} placeholder={t('Click here, then scan the QR with your scanner')} />
        <span className="field-hint">{t('A USB or Bluetooth scanner types the QR text here by itself. You can also paste it.')}</span>
      </label>
      <div style={{ marginTop: 12 }}>
        {cam
          ? <video ref={videoRef} muted playsInline style={{ width: '100%', borderRadius: 12, background: '#000', maxHeight: 320 }} />
          : (
            <div className="row-gap" style={{ flexWrap: 'wrap' }}>
              <button className="btn btn-soft" onClick={() => { setCamErr(''); setCam(true); }}><Camera size={16} />{t('Scan with camera')}</button>
              <button className="btn btn-ghost" disabled={busy} onClick={() => fileRef.current?.click()}><ImagePlus size={16} />{t('Choose a photo of the QR')}</button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickFile} />
            </div>
          )}
        {cam && <p className="muted" style={{ marginTop: 8 }}>{t('Hold the QR steady inside the camera view.')}</p>}
        {camErr && <p className="muted" style={{ marginTop: 8, color: 'var(--red)' }}>{t(camErr)}</p>}
      </div>
    </Modal>
  );
}
