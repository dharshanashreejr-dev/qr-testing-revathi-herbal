import { SERVICES } from './data/mockData.js';

export const productOf = (products, id) => products.find((p) => p.id === id);

export const orderTotal = (order, products) =>
  order.items.reduce((sum, it) => sum + (productOf(products, it.productId)?.price || 0) * it.qty, 0);

export const itemCount = (order) => order.items.reduce((s, i) => s + i.qty, 0);

// Paid orders that were not cancelled count as product revenue.
export const countsAsRevenue = (o) => o.payment === 'Paid' && o.status !== 'Cancelled';

export const productRevenue = (orders, products) =>
  orders.filter(countsAsRevenue).reduce((s, o) => s + orderTotal(o, products), 0);

export const servicePrice = (name) => SERVICES.find((s) => s.name === name)?.price || 0;

export const appointmentRevenue = (appointments) =>
  appointments.filter((a) => a.status === 'Completed').reduce((s, a) => s + (a.price || servicePrice(a.service)), 0);

// Last 6 months, calculated from the real orders and completed appointments (nothing is hardcoded).
export const revenueSeries = (orders, appointments) => {
  const now = new Date(), out = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const products = orders.filter((o) => countsAsRevenue(o) && String(o.date).startsWith(key)).reduce((s, o) => s + (o.total || 0), 0);
    const appts = appointmentRevenue(appointments.filter((a) => String(a.date).startsWith(key)));
    out.push({ month: d.toLocaleString('en-IN', { month: 'short' }), products, appointments: appts, total: products + appts });
  }
  return out;
};

export const unitsSold = (orders, products) => {
  const map = {};
  orders.filter((o) => o.status !== 'Cancelled').forEach((o) =>
    o.items.forEach((i) => {
      const p = productOf(products, i.productId);
      if (p) map[p.name] = (map[p.name] || 0) + i.qty;
    })
  );
  return Object.entries(map).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
};

export const countBy = (list, key, order) =>
  order.map((label) => ({ label, value: list.filter((x) => x[key] === label).length }));

export const nextId = (prefix, list, start) => {
  const nums = list.map((x) => parseInt(String(x.id).split('-')[1], 10)).filter(Number.isFinite);
  return `${prefix}-${Math.max(start, ...nums) + 1}`;
};

export const downloadCsv = (filename, rows) => {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = rows.map((r) => r.map(esc).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};
