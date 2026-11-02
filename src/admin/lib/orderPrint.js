import qrcode from './qrcode.js';
import { spa } from '../../site/data';
import { gstSplit } from '../../api/pricing';

// Printing helpers for the admin: dispatch slips (From / To + QR), order bills and POS invoices.
//  - The QR on every order holds a short link to that order's details page (Admin > Orders > order).
//    Scanning it (phone camera or the scanner in Admin > Orders) opens the order's full details, ready to print.
//  - Slips print on 100 x 150 mm (standard courier label), bills on A5. One page per order, any number of orders in one go.
// BACKEND: the QR can later carry a signed link to the order instead of the text summary.

// QR scanners read UTF-8 (names / addresses can be Tamil etc.).
qrcode.stringToBytes = (s) => Array.from(new TextEncoder().encode(s));

const FROM = { name: spa.name, address: spa.address, phone: spa.phone };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clip = (s, n) => { const x = String(s ?? '').replace(/\s+/g, ' ').trim(); return x.length > n ? `${x.slice(0, n - 1)}…` : x; };
const rs = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const rs2 = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (iso) => { const d = new Date(iso); return Number.isNaN(+d) ? String(iso || '') : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); };

/** Link to the order's own details page in Admin > Orders. This is what the QR holds. */
export function orderLink(o) {
  const base = typeof window !== 'undefined' ? window.location.href.split('#')[0] : '';
  return `${base}#/orders/${encodeURIComponent(o.id)}`;
}

/** PUT YOUR LIVE WEBSITE ADDRESS HERE (no slash at the end), e.g. 'https://revathiherbal.com'.
 *  Every order QR will open this address, so ANY phone on ANY network can scan it and see the order. */
export const LIVE_URL = 'https://revathi-beauty-product-tau.vercel.app/';

const isLocalUrl = (u) => /^https?:\/\/(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(u);

/** Address the QR points to. Order of use: LIVE_URL, then VITE_PUBLIC_URL (.env), then a saved address,
 *  then the address the admin is open on (works only on the same WiFi when it is localhost / 192.168.x.x). */
export function publicBase() {
  let env = '';
  try { env = (import.meta.env && import.meta.env.VITE_PUBLIC_URL) || ''; } catch { /* no env */ }
  let saved = '';
  try { saved = localStorage.getItem('rhbc:public-url') || ''; } catch { /* no storage */ }
  const here = typeof window !== 'undefined' ? window.location.origin : '';
  const b = (LIVE_URL || env || saved || here).trim();
  return b.replace(/\/+$/, '');
}
export const isLocalBase = () => isLocalUrl(publicBase());

const b64 = (str) => btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (x) => decodeURIComponent(escape(atob(x.replace(/-/g, '+').replace(/_/g, '/'))));

/** Text stored inside the order QR: a link to the PUBLIC page /order.html with the order details packed inside the link,
 *  so anyone who scans it (any phone, any network) sees the order. No login and no server lookup needed.
 *  BACKEND: later this becomes /order/<signed-token> and the page fetches live status. */
export function orderQrText(o) {
  const d = {
    i: o.id, c: clip(o.customer, 30), p: o.phone || '', a: clip(o.address, 90), d: String(o.placed || '').slice(0, 10),
    t: Math.round(o.total || 0), y: clip(o.payment || '', 16), s: o.cancelled ? -1 : (o.stage ?? 0),
    k: clip(o.courier || '', 16), w: clip(o.awb || '', 24),
    l: (o.items || []).map((x) => [clip(x.name, 28), x.qty, Math.round(x.price || 0)])
  };
  return `${publicBase()}/order.html#d=${b64(JSON.stringify(d))}`;
}

/** Work out which order a scanned / pasted QR text refers to. Exact id match only (ORD-1 must never match ORD-10).
 *  Understands the link format and the older "RHBC <id>" text format. Returns the order or null. */
export function findOrderByQr(raw, orders) {
  const x = String(raw || '').trim();
  if (!x) return null;
  const ids = new Set(orders.map((o) => o.id));
  const dm = x.match(/#d=([A-Za-z0-9_-]+)/);
  if (dm) { try { const id = JSON.parse(unb64(dm[1])).i; if (ids.has(id)) return orders.find((o) => o.id === id); } catch { /* fall through */ } }
  const m = x.match(/#\/orders\/([^\s?&]+)/i);
  if (m) {
    let id = m[1];
    try { id = decodeURIComponent(id); } catch { /* keep raw */ }
    if (ids.has(id)) return orders.find((o) => o.id === id);
  }
  const first = x.split(/\r?\n/)[0].replace(/^RHBC\s+/i, '').trim();
  if (ids.has(first)) return orders.find((o) => o.id === first);
  if (ids.has(x)) return orders.find((o) => o.id === x);
  const tok = x.split(/[\s,;|]+/).find((t) => ids.has(t));
  return tok ? orders.find((o) => o.id === tok) : null;
}

const svgCache = new Map();
/** QR code as an inline SVG string. */
export function qrSvg(text, size = 100) {
  const key = `${size}|${text}`;
  if (svgCache.has(key)) return svgCache.get(key);
  let svg;
  try {
    const q = qrcode(0, 'M');
    q.addData(text, 'Byte');
    q.make();
    const n = q.getModuleCount();
    let d = '';
    for (let r = 0; r < n; r += 1) {
      let c = 0;
      while (c < n) {
        if (!q.isDark(r, c)) { c += 1; continue; }
        let e = c;
        while (e < n && q.isDark(r, e)) e += 1;
        d += `M${c + 4} ${r + 4}h${e - c}v1h-${e - c}z`;
        c = e;
      }
    }
    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n + 8} ${n + 8}" width="${size}" height="${size}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
  } catch {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" width="${size}" height="${size}"><rect width="10" height="10" fill="#eee"/></svg>`;
  }
  svgCache.set(key, svg);
  return svg;
}

const CSS = `
@page slip { size: 100mm 150mm; margin: 0 }
@page bill { size: A5; margin: 0 }
*{box-sizing:border-box}
body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#000;background:#e9e9e9}
.pg{background:#ffffff;margin:12px auto;overflow:hidden;page-break-after:always;break-after:page}
.pg:last-child{page-break-after:auto;break-after:auto}
@media print{body{background:#ffffff}.pg{margin:0}}
.sm{font-size:7.5pt;color:#333}
.lb{font-size:6.5pt;font-weight:700;letter-spacing:1px;color:#444;margin-bottom:.8mm}
.row{display:flex;justify-content:space-between;align-items:center;gap:3mm}
.stamp{border:.5mm solid #c00;color:#c00;font-weight:800;padding:1mm 2mm;transform:rotate(-8deg);font-size:10pt}
.slip{page:slip;width:100mm;height:150mm;padding:5mm;display:flex;flex-direction:column;gap:2.5mm;font-size:9pt}
.slip .hd{display:flex;justify-content:space-between;align-items:center;border-bottom:.4mm solid #000;padding-bottom:1.5mm;font-size:9pt}
.slip .hd span{font-weight:700;letter-spacing:.5px;font-size:8pt}
.oid{font-size:15pt;font-weight:800}
.box{border:.3mm solid #000;padding:2mm;border-radius:1mm}
.to .nm{font-size:12pt;font-weight:800}
.to .ad{font-size:9.5pt;line-height:1.3;margin:.8mm 0;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
.to .ph{font-size:10pt;font-weight:700}
.its ul{margin:0;padding-left:4mm;font-size:8pt}
.slip .ft{margin-top:auto;display:flex;gap:3mm;align-items:center;border-top:.4mm dashed #000;padding-top:2mm}
.slip .qr svg{width:32mm;height:32mm;display:block}
.tot{font-size:14pt;font-weight:800}
.bill{page:bill;width:148mm;height:210mm;padding:10mm;font-size:9.5pt;display:flex;flex-direction:column;gap:4mm}
.bill h1{margin:0;font-size:14pt}
.bill .qr svg{width:28mm;height:28mm;display:block}
.bill .title{font-size:16pt;font-weight:800;letter-spacing:1px}
.bill table{width:100%;border-collapse:collapse}
.bill th{background:#f1f1f1;text-align:left;font-size:8pt;padding:2mm;border-bottom:.3mm solid #000}
.bill td{padding:2mm;border-bottom:.2mm solid #ccc;vertical-align:top}
.bill .r{text-align:right}
.bill .sum{margin-left:auto;width:62mm}
.bill .sum div{display:flex;justify-content:space-between;padding:1mm 0}
.bill .sum .gt{border-top:.4mm solid #000;font-weight:800;font-size:11pt;margin-top:1mm;padding-top:2mm}
.bill .foot{margin-top:auto;font-size:8pt;color:#333;border-top:.3mm dashed #000;padding-top:2mm}
`;

const LOGO = `${typeof location !== 'undefined' ? location.origin : ''}/revathi-logo.svg`;
const wrap = (title, body) => `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS}</style></head><body>${body}</body></html>`;

function slipPage(o) {
  const qty = o.items.reduce((s, i) => s + i.qty, 0);
  const items = o.items.slice(0, 5).map((i) => `<li>${esc(clip(i.name, 34))}${i.size ? ` (${esc(i.size)})` : ''} <b>x${i.qty}</b></li>`).join('');
  const more = o.items.length > 5 ? `<li>+ ${o.items.length - 5} more</li>` : '';
  return `<section class="pg slip">
<div class="hd"><div style="display:flex;align-items:center;gap:2mm"><img src="${LOGO}" alt="" style="width:11mm;height:11mm;border-radius:50%"><b>${esc(FROM.name)}</b></div><span>DISPATCH SLIP</span></div>
<div class="row"><div><div class="oid">${esc(o.id)}</div><div class="sm">${esc(fmtDate(o.placed))} &middot; ${esc(o.payment || '')}</div></div>${o.cancelled ? '<div class="stamp">CANCELLED</div>' : ''}</div>
<div class="box"><div class="lb">FROM</div><b>${esc(FROM.name)}</b><div class="sm">${esc(FROM.address)}<br>Ph: ${esc(FROM.phone)}</div></div>
<div class="box to"><div class="lb">TO</div><div class="nm">${esc(o.customer || 'Customer')}</div><div class="ad">${esc(o.address || '')}</div><div class="ph">Ph: ${esc(o.phone || '-')}</div></div>
<div class="sm">Courier: <b>${esc(o.courier)}</b> &nbsp; AWB: <b>${esc(o.awb)}</b></div>
<div class="its"><div class="lb">${qty} ITEM(S)</div><ul>${items}${more}</ul></div>
<div class="ft"><div class="qr">${qrSvg(orderQrText(o))}</div><div><div class="sm">Order total</div><div class="tot">${esc(rs(o.total))}</div><div class="sm">Scan the QR to open the order details</div></div></div>
</section>`;
}

function billPage(o) {
  const sum = o.items.reduce((s, i) => s + i.price * i.qty, 0);
  const adj = Math.round((o.total - sum) * 100) / 100;
  const g = gstSplit(o.total, 18);
  const rows = o.items.map((i, n) => `<tr><td>${n + 1}</td><td>${esc(i.name)}${i.size ? ` (${esc(i.size)})` : ''}</td><td class="r">${i.qty}</td><td class="r">${rs(i.price)}</td><td class="r">${rs(i.price * i.qty)}</td></tr>`).join('');
  const adjRow = Math.abs(adj) >= 1 ? `<tr><td></td><td>${adj > 0 ? 'Delivery / other charges' : 'Discount / offer'}</td><td></td><td></td><td class="r">${adj > 0 ? '' : '-'}${rs(Math.abs(adj))}</td></tr>` : '';
  return `<section class="pg bill">
<div class="row"><div style="display:flex;align-items:center;gap:3mm"><img src="${LOGO}" alt="" style="width:15mm;height:15mm;border-radius:50%"><div><h1>${esc(FROM.name)}</h1><div class="sm">${esc(FROM.address)}<br>Ph: ${esc(FROM.phone)}</div></div></div>
<div style="text-align:right"><div class="title">BILL</div><div class="sm">${esc(o.id)}<br>${esc(fmtDate(o.placed))}</div>${o.cancelled ? '<div class="stamp" style="display:inline-block;margin-top:1mm">CANCELLED</div>' : ''}</div></div>
<div class="row" style="align-items:flex-start"><div><div class="lb">BILL TO</div><b>${esc(o.customer || 'Customer')}</b><div class="sm" style="font-size:9pt">${esc(o.address || '')}<br>Ph: ${esc(o.phone || '-')}</div></div>
<div class="qr">${qrSvg(orderQrText(o))}</div></div>
<div class="sm">Payment: <b>${esc(o.payment || '-')}</b> &nbsp; Courier: <b>${esc(o.courier)}</b> &nbsp; AWB: <b>${esc(o.awb)}</b></div>
<table><thead><tr><th style="width:8mm">#</th><th>Item</th><th class="r" style="width:12mm">Qty</th><th class="r" style="width:22mm">Rate</th><th class="r" style="width:24mm">Amount</th></tr></thead><tbody>${rows}${adjRow}</tbody></table>
<div class="sum"><div><span>Taxable value</span><span>${rs2(g.net)}</span></div><div><span>CGST 9%</span><span>${rs2(g.cgst)}</span></div><div><span>SGST 9%</span><span>${rs2(g.sgst)}</span></div><div class="gt"><span>Total</span><span>${rs(o.total)}</span></div></div>
<div class="foot">Prices include 18% GST. Thank you for shopping with ${esc(FROM.name)}.</div>
</section>`;
}

function invoicePage(inv) {
  const withGst = inv.withGst !== false;
  const rows = inv.lines.map((l, n) => `<tr><td>${n + 1}</td><td>${esc(l.name)}</td><td class="r">${l.qty}</td><td class="r">${rs(l.unitPrice)}</td><td class="r">${rs(l.unitPrice * l.qty)}</td></tr>`).join('');
  const qrText = `RHBC ${inv.id}\n${clip(inv.customerName, 30)} ${inv.customerPhone || ''}\nTotal Rs ${inv.total} ${inv.payment}`.trim();
  return `<section class="pg bill">
<div class="row"><div style="display:flex;align-items:center;gap:3mm"><img src="${LOGO}" alt="" style="width:15mm;height:15mm;border-radius:50%"><div><h1>${esc(FROM.name)}</h1><div class="sm">${esc(FROM.address)}<br>Ph: ${esc(FROM.phone)}</div></div></div>
<div style="text-align:right"><div class="title">${withGst ? 'INVOICE' : 'BILL'}</div><div class="sm">${esc(inv.id)}<br>${esc(fmtDate(inv.at))}</div></div></div>
<div class="row" style="align-items:flex-start"><div><div class="lb">BILL TO</div><b>${esc(inv.customerName || 'Walk-in')}</b><div class="sm" style="font-size:9pt">${inv.customerPhone ? `Ph: ${esc(inv.customerPhone)}` : ''}${inv.gstin ? `<br>GSTIN: ${esc(inv.gstin)}` : ''}</div></div>
<div class="qr">${qrSvg(qrText)}</div></div>
<div class="sm">Payment: <b>${esc(inv.payment)}</b> &nbsp; Billed by: <b>${esc(inv.cashier)}</b></div>
<table><thead><tr><th style="width:8mm">#</th><th>Item</th><th class="r" style="width:12mm">Qty</th><th class="r" style="width:22mm">Rate</th><th class="r" style="width:24mm">Amount</th></tr></thead><tbody>${rows}</tbody></table>
<div class="sum">${withGst ? `<div><span>Taxable value</span><span>${rs2(inv.taxable)}</span></div><div><span>CGST 9%</span><span>${rs2(inv.cgst)}</span></div><div><span>SGST 9%</span><span>${rs2(inv.sgst)}</span></div>` : ''}<div class="gt"><span>Total</span><span>${rs(inv.total)}</span></div></div>
<div class="foot">${withGst ? 'Prices include 18% GST.' : 'Bill without GST.'} Thank you for visiting ${esc(FROM.name)}.</div>
</section>`;
}

export const ORDER_PRINT_TYPES = [['both', 'Slip + Bill'], ['slip', 'Shipping slip (From / To + QR)'], ['bill', 'Bill']];
export const printPages = (count, type) => (type === 'both' ? count * 2 : count);

/** Full HTML document with one slip and / or bill page per order. */
export function buildOrderDocs(orders, type = 'both') {
  const pages = orders.flatMap((o) => (type === 'slip' ? [slipPage(o)] : type === 'bill' ? [billPage(o)] : [slipPage(o), billPage(o)]));
  return wrap('Orders', pages.join(''));
}
export const buildInvoiceDocs = (invoices) => wrap('Invoice', invoices.map(invoicePage).join(''));
