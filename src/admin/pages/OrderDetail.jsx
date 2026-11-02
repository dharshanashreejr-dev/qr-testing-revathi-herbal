import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, MapPin, Phone, Printer, User, ScanLine } from 'lucide-react';
import { useStore } from '../store.jsx';
import { api } from '../../api';
import { getOrders, setOrderStage, cancelOrder, updateShipping, subscribeData } from '../../site/account';
import { inr } from '../data/mockData.js';
import PageHeader from '../components/PageHeader.jsx';
import Badge from '../components/Badge.jsx';
import PrintPreview from '../components/PrintPreview.jsx';
import { useT } from '../i18n.js';
import { ORDER_PRINT_TYPES, buildOrderDocs, orderQrText, isLocalBase, printPages, qrSvg } from '../lib/orderPrint.js';
import { STAGES, FILTERS, statusOf, when, whenTime, addPrinted } from '../lib/orderMeta.js';

// Full details of ONE order on its own page (#/orders/<id>). Opened from the Orders list, or by scanning the order's QR.
// BACKEND: GET /api/orders/:id, PATCH /api/orders/:id/status, PATCH /api/orders/:id/shipping. The QR link then works from any device.
export default function OrderDetail({ id, onNavigate }) {
  const { notify, user } = useStore();
  const { t } = useT();
  const [, tick] = useState(0);
  const re = () => tick((n) => n + 1);
  useEffect(() => subscribeData(re), []);
  const actor = user?.name || 'Admin', role = user?.role || 'Admin';

  const orders = getOrders();
  const o = orders.find((x) => x.id === id);
  const [ship, setShip] = useState(null);
  const [printType, setPrintType] = useState(null); // slip | bill | both
  useEffect(() => {
    if (o) setShip({ courier: o.courier || '', awb: o.awb || '', eta: String(o.eta || '').slice(0, 10) });
  }, [id, !!o]); // eslint-disable-line
  const html = useMemo(() => (printType && o ? buildOrderDocs([o], printType) : ''), [printType, id, JSON.stringify(o)]); // eslint-disable-line

  const back = () => onNavigate('orders');

  if (!o) {
    return (
      <div className="page">
        <PageHeader title={t('Order not found')} subtitle={t('No order with ID {id} was found.', { id })}
          actions={<button className="btn btn-ghost" onClick={back}><ArrowLeft size={16} />{t('Back to orders')}</button>} />
        <div className="card">
          <p className="muted">{t('Orders in this demo are stored in the browser they were placed in. If you scanned this QR on another device, open it on the device where the orders are stored. With the live backend the QR opens the order from any device.')}</p>
        </div>
      </div>
    );
  }

  const change = (target) => {
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
  const optionsFor = () => FILTERS.map((s) => {
    const idx = STAGES.indexOf(s);
    const disabled = o.cancelled ? s !== 'Cancelled' : s === 'Cancelled' ? o.stage >= 3 : idx < o.stage;
    return <option key={s} value={s} disabled={disabled && s !== statusOf(o)}>{t(s)}</option>;
  });
  const saveShip = () => {
    updateShipping(o.id, { courier: ship.courier.trim() || o.courier, awb: ship.awb.trim() || o.awb, eta: ship.eta || o.eta });
    api.audit.log(actor, role, 'order.status', `${o.id} shipping details updated`, { orderId: o.id });
    notify('Shipping details saved.'); re();
  };
  const donePrinting = () => {
    addPrinted([o.id]);
    api.audit.log(actor, role, 'order.status', `Printed ${printType === 'both' ? 'slip + bill' : printType} for 1 order(s)`, { orders: 1 });
  };

  const qty = o.items.reduce((s, i) => s + i.qty, 0);
  const itemsTotal = o.items.reduce((s, i) => s + i.price * i.qty, 0);
  const adj = Math.round((o.total - itemsTotal) * 100) / 100;
  const link = orderQrText(o);
  const printTitle = (ty) => ORDER_PRINT_TYPES.find(([v]) => v === ty)?.[1] || '';

  return (
    <div className="page">
      <PageHeader
        title={t('Order {id}', { id: o.id })}
        subtitle={t('Placed on {date} by {customer}', { date: when(o.placed), customer: o.customer || t('Customer') })}
        actions={<>
          <button className="btn btn-ghost" onClick={back}><ArrowLeft size={16} />{t('Back to orders')}</button>
          <button className="btn btn-ghost" onClick={() => setPrintType('slip')}><Printer size={16} />{t('Print slip')}</button>
          <button className="btn btn-ghost" onClick={() => setPrintType('bill')}><Printer size={16} />{t('Print bill')}</button>
          <button className="btn btn-primary" onClick={() => setPrintType('both')}><Printer size={16} />{t('Slip + Bill')}</button>
        </>}
      />

      <div className="od-summary">
        <div className="od-tile"><span className="muted">{t('Fulfilment')}</span><Badge>{statusOf(o)}</Badge></div>
        <div className="od-tile"><span className="muted">{t('Payment')}</span><strong>{o.payment || '-'}</strong></div>
        <div className="od-tile"><span className="muted">{t('Items')}</span><strong>{qty}</strong></div>
        <div className="od-tile"><span className="muted">{t('Order total')}</span><strong className="od-big">{inr(o.total)}</strong></div>
      </div>

      <div className="od-grid">
        <div className="od-col">
          <section className="card">
            <h4 className="mini-title">{t('Items')}</h4>
            <div className="od-scroll">
              <table className="od-table">
                <thead><tr><th>#</th><th>{t('Item')}</th><th className="r">{t('Qty')}</th><th className="r">{t('Rate')}</th><th className="r">{t('Amount')}</th></tr></thead>
                <tbody>
                  {o.items.map((i, k) => (
                    <tr key={(i.pid || '') + k}>
                      <td>{k + 1}</td>
                      <td><strong>{i.name}</strong>{i.size && <span className="muted block">{i.size}</span>}</td>
                      <td className="r">{i.qty}</td>
                      <td className="r">{inr(i.price)}</td>
                      <td className="r"><strong>{inr(i.price * i.qty)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="od-sum">
              <div><span>{t('Items subtotal')}</span><span>{inr(itemsTotal)}</span></div>
              {Math.abs(adj) >= 1 && <div><span>{adj > 0 ? t('Delivery / other charges') : t('Discount / offer')}</span><span>{adj > 0 ? '' : '-'}{inr(Math.abs(adj))}</span></div>}
              <div className="od-sum-total"><span>{t('Order total')}</span><span>{inr(o.total)}</span></div>
            </div>
          </section>

          <section className="card">
            <h4 className="mini-title">{t('Order timeline')}</h4>
            <ul className="list">
              {(o.log || []).map((l, k) => <li key={k}><div><strong>{t(STAGES[l.stage])}</strong><span className="muted">{l.note}</span></div><span className="muted">{whenTime(l.at)}</span></li>)}
            </ul>
          </section>
        </div>

        <div className="od-col">
          <section className="card">
            <h4 className="mini-title">{t('Customer and delivery')}</h4>
            <dl className="dl">
              <dt><User size={14} /> {t('Customer')}</dt><dd>{o.customer || t('Customer')}</dd>
              <dt><Phone size={14} /> {t('Phone')}</dt><dd>{o.phone || '-'}</dd>
              <dt><MapPin size={14} /> {t('Address')}</dt><dd>{o.address || '-'}</dd>
            </dl>
          </section>

          <section className="card">
            <h4 className="mini-title">{t('Update order')}</h4>
            <label className="field"><span className="field-label">{t('Fulfilment status')}</span>
              <select value={statusOf(o)} disabled={o.cancelled || o.stage === 4} onChange={(e) => change(e.target.value)}>{optionsFor()}</select>
            </label>
            <p className="muted" style={{ fontSize: 13, margin: '0 0 12px' }}>{o.dispatchSms ? t('Dispatch SMS has been sent.') : t('The dispatch SMS is sent when you mark the order Shipped.')}</p>
            {ship && <>
              <label className="field"><span className="field-label">{t('Courier')}</span><input value={ship.courier} onChange={(e) => setShip({ ...ship, courier: e.target.value })} /></label>
              <label className="field"><span className="field-label">{t('Tracking number')}</span><input value={ship.awb} onChange={(e) => setShip({ ...ship, awb: e.target.value })} /></label>
              <label className="field"><span className="field-label">{t('Expected delivery')}</span><input type="date" value={ship.eta} onChange={(e) => setShip({ ...ship, eta: e.target.value })} /></label>
              <button className="btn btn-soft" onClick={saveShip} disabled={o.cancelled}>{t('Save shipping details')}</button>
            </>}
          </section>

          <section className="card">
            <h4 className="mini-title">{t('Order QR')}</h4>
            <div className="od-qr">
              <div className="od-qr-img" dangerouslySetInnerHTML={{ __html: qrSvg(link, 150) }} />
              <p className="muted" style={{ fontSize: 12.5, margin: 0 }}><ScanLine size={13} style={{ verticalAlign: '-2px' }} /> {t('Anyone who scans this QR sees this order on a public details page.')}{isLocalBase() && <span className="block od-link" style={{ color: '#b45309' }}>{t('Admin is open on localhost, so phones cannot open this QR yet. Open the admin using your computer network address (http://192.168.x.x:5173) or the live website address, then reprint.')}</span>}</p>
            </div>
          </section>
        </div>
      </div>

      {printType && (
        <PrintPreview
          title={printType === 'slip' ? t('Dispatch slips') : printType === 'bill' ? t('Bills') : t('Dispatch slips and bills')}
          subtitle={t('{n} order(s), {p} page(s). Check the preview, then press Print.', { n: 1, p: printPages(1, printType) })}
          html={html} onPrint={donePrinting} onClose={() => setPrintType(null)} />
      )}
    </div>
  );
}
