import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { USERS, ORDER_STATUSES } from './data/mockData.js';
import { getOrders, subscribeData } from '../site/account';
import { api } from '../api';
import { KEYS, raw } from '../api/storage';
import { catalogue } from '../products/data/products';
import { services as siteServices } from '../site/data';
import { team } from '../api/catalog';

// Admin data layer. Orders, appointments, customers and products are NOT stored here any more:
// they are read live from what customers actually do on the website (orders, bookings, sign-ups, the shop catalogue),
// so anything staff change shows up on the customer's Tracking page straight away (and the other way round).
// BACKEND: every derived list below becomes a REST call (GET /api/orders, /api/appointments, /api/customers, /api/products).

const KEY = 'revathi-herbal-admin-v3';
const SESSION = 'revathi-herbal-session-v2';
const ORDERS_KEY = 'VELVET TOUCH-orders';

const load = (key, fallback) => {
  try {
    const r = localStorage.getItem(key);
    return r ? JSON.parse(r) : fallback;
  } catch {
    return fallback;
  }
};

export const normaliseProduct = (p) => {
  const stock = Math.max(0, Number(p.stock) || 0);
  let status = p.status;
  if (stock === 0) status = 'Out of Stock';
  else if (status === 'Out of Stock') status = 'Active';
  return { ...p, stock, status };
};

const StoreContext = createContext(null);
export const useStore = () => useContext(StoreContext);

const digits = (p) => String(p || '').replace(/\D/g, '').slice(-10);
const ROLE_OF = { 'Body Massage': 'Wellness Specialist', Facial: 'Skin Specialist', Consultation: 'Beauty Specialist', 'Bridal Makeup': 'Beauty Specialist' };
const blankStaff = { email: '', phone: '', availability: 'Available', experience: '', bio: '', workstationBay: '', shiftHours: '09:00-18:00', baseSalary: 18000, joiningDate: '', deviceId: '', shiftId: 'SH-1', bankName: '', accountNo: '', ifsc: '' };
const initialStaff = () => [
  // the real specialist roster used by the booking page + the two panel logins
  ...team.map((m, i) => ({ ...blankStaff, id: `S-${String(i + 1).padStart(3, '0')}`, name: m.name, role: ROLE_OF[m.categories[0]] || 'Beauty Specialist', bio: m.skill, permissions: ['appointments'] })),
  ...USERS.map((u, i) => ({ ...blankStaff, id: `S-${String(team.length + i + 1).padStart(3, '0')}`, name: u.name, email: u.email, role: u.role === 'Admin' ? 'Administrator' : 'Receptionist', permissions: u.role === 'Admin' ? ['all'] : ['appointments', 'customers'] }))
];

const sigNow = () => [raw(ORDERS_KEY), raw(KEYS.bookings), raw(KEYS.users)].join('|');

const ADMIN_STATUSES = ['Scheduled', 'Checked-In', 'In Session', 'Completed', 'Rescheduled', 'No-Show'];
const apptStatus = (b) => {
  if (b.status === 'Pending Review') return 'Pending Review';
  if (b.status === 'Cancelled' || b.status === 'Rejected') return 'Cancelled';
  if (b.adminStatus && ADMIN_STATUSES.includes(b.adminStatus)) return b.adminStatus;
  return b.status === 'Completed' ? 'Completed' : 'Scheduled';
};

const ago = (ts) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(ts).getTime()) / 60000));
  if (m < 1) return 'Just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'Yesterday' : `${d} days ago`;
};

export function StoreProvider({ children }) {
  const saved = useMemo(() => load(KEY, null), []);
  const [staff, setStaff] = useState(saved?.staff || initialStaff());
  const [messages, setMessages] = useState(saved?.messages || []);
  const [auditLog, setAuditLog] = useState(saved?.auditLog || []);
  const [lowStockThreshold, setLowStockThreshold] = useState(saved?.lowStockThreshold ?? 10);
  const [user, setUser] = useState(() => load(SESSION, null));
  const [toasts, setToasts] = useState([]);

  // ---- live data from the customer side ----
  const [sig, setSig] = useState(sigNow);
  useEffect(() => subscribeData(() => setSig((p) => { const n = sigNow(); return n === p ? p : n; })), []);
  const [catTick, setCatTick] = useState(0);
  useEffect(() => { const a = api.catalogue.subscribe(() => setCatTick((n) => n + 1)), b = api.stock.subscribe(() => setCatTick((n) => n + 1)); return () => { a(); b(); }; }, []);

  const products = useMemo(() => catalogue().map((p) => ({
    id: p.id, name: p.name, category: p.category, price: p.price, archived: !!p.archived,
    stock: p.forcedOut ? 0 : (api.stock.stockOverride(p.id) ?? p.baseStock ?? p.stock),
    status: p.archived ? 'Archived' : p.status || 'Active'
  })), [catTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const users = useMemo(() => api.auth.allUsers(), [sig]); // eslint-disable-line react-hooks/exhaustive-deps
  const custId = useCallback((userId, phone) => {
    const u = users.find((x) => x.id === userId) || users.find((x) => digits(x.phone) === digits(phone) && digits(phone));
    return u ? u.id : `ph-${digits(phone) || userId || 'guest'}`;
  }, [users]);

  const orders = useMemo(() => getOrders().map((o) => ({
    id: o.id, customerId: custId(o.userId, o.phone), customer: o.customer || 'Customer', phone: o.phone || '',
    date: String(o.placed).slice(0, 10), placedAt: o.placed,
    items: o.items.map((i) => ({ productId: i.pid, name: i.name, qty: i.qty, price: i.price })),
    total: o.total, payment: /paid/i.test(o.payment || '') ? 'Paid' : 'Pending',
    status: o.cancelled ? 'Cancelled' : ORDER_STATUSES[o.stage], address: o.address
  })), [sig, custId]); // eslint-disable-line react-hooks/exhaustive-deps

  const specialistIdOf = useCallback((name) => (staff.find((s) => s.name === name) || staff.find((s) => s.name.split(' ')[0] === name))?.id || '', [staff]);
  const nameOfId = useCallback((id) => staff.find((s) => s.id === id)?.name || '', [staff]);

  const bookings = useMemo(() => api.booking.getBookings(), [sig]); // eslint-disable-line react-hooks/exhaustive-deps
  const appointments = useMemo(() => bookings.map((b) => ({
    id: b.ref, customerId: custId(b.userId, b.phone), customer: b.name, phone: b.phone, service: b.serviceName,
    date: b.date, time: b.time, specialistId: specialistIdOf(b.specialists[0]), status: apptStatus(b),
    notes: b.notes, price: b.total, mode: b.mode, reviewNote: b.reviewNote, createdAt: b.createdAt
  })), [bookings, custId, specialistIdOf]);

  // Customers = people who signed up + anyone who ordered / booked as a guest. Tier grows with spend.
  const customers = useMemo(() => {
    const map = new Map();
    users.forEach((u) => map.set(u.id, { id: u.id, name: u.name || `Customer ${u.phone.slice(-4)}`, email: u.email || '', phone: `+91 ${u.phone}`, registered: String(u.createdAt).slice(0, 10), spend: 0, last: String(u.createdAt).slice(0, 10) }));
    const touch = (id, name, phone, date, amount) => {
      const c = map.get(id) || { id, name: name || 'Guest', email: '', phone: phone || '', registered: date, spend: 0, last: date };
      c.spend += amount; if (date > c.last) c.last = date; map.set(id, c);
    };
    orders.forEach((o) => touch(o.customerId, o.customer, o.phone, o.date, o.payment === 'Paid' && o.status !== 'Cancelled' ? o.total : 0));
    appointments.forEach((a) => touch(a.customerId, a.customer, a.phone, a.date, a.status === 'Completed' ? a.price || 0 : 0));
    return [...map.values()].map((c) => ({ id: c.id, name: c.name, email: c.email, phone: c.phone, registered: c.registered, lastActivity: c.last,
      tier: c.spend >= 50000 ? 'VIP' : c.spend >= 25000 ? 'Gold' : c.spend >= 10000 ? 'Silver' : c.spend > 0 ? 'Regular' : 'New' }));
  }, [users, orders, appointments]);

  const activity = useMemo(() => [
    ...orders.map((o) => ({ at: o.placedAt, who: o.customer, what: o.status === 'Order delivered' ? 'received order {id}' : 'placed order {id}', vars: { id: o.id } })),
    ...appointments.map((a) => ({ at: a.createdAt, who: a.customer, what: a.status === 'Checked-In' ? 'checked in for {service}' : 'booked {service}', vars: { service: a.service } }))
  ].filter((x) => x.at).sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 6).map((x) => ({ ...x, when: ago(x.at) })), [orders, appointments]);

  // ---- appointment writes go to the real bookings ----
  const serviceOf = (name) => siteServices.find((s) => s.name === name);
  const setAppointments = useCallback((updater) => {
    const cur = appointments;
    const next = typeof updater === 'function' ? updater(cur) : updater;
    next.forEach((a) => {
      const old = cur.find((x) => x.id === a.id);
      if (!old) {
        const svc = serviceOf(a.service), c = customers.find((x) => x.id === a.customerId);
        const b = api.booking.createBooking({
          serviceId: svc?.id || '', serviceName: a.service, category: svc?.category || 'Consultation', duration: svc?.duration || 60, date: a.date, time: a.time,
          specialists: [nameOfId(a.specialistId)].filter(Boolean), guests: 1, name: c?.name || a.customer || 'Walk-in', phone: c?.phone || '', email: c?.email || '', notes: a.notes || '',
          channel: 'SMS', remind: false, total: svc?.price || 0
        });
        api.booking.updateBooking(b.ref, { userId: users.some((u) => u.id === a.customerId) ? a.customerId : undefined, adminStatus: 'Scheduled' });
        return;
      }
      if (JSON.stringify(old) === JSON.stringify(a)) return;
      const patch = { date: a.date, time: a.time, notes: a.notes, specialists: [nameOfId(a.specialistId)].filter(Boolean) };
      if (ADMIN_STATUSES.includes(a.status)) patch.adminStatus = a.status;
      if (a.status === 'Completed') patch.status = 'Completed';
      if (a.status === 'Cancelled' && old.status !== 'Cancelled') { api.booking.cancelBooking(a.id); }
      api.booking.updateBooking(a.id, patch);
    });
  }, [appointments, customers, users, nameOfId]); // eslint-disable-line react-hooks/exhaustive-deps
  const approveAppointment = useCallback((id) => api.booking.approveBooking(id), []);
  const rejectAppointment = useCallback((id, note) => api.booking.rejectBooking(id, note || 'Not available at that time'), []);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify({ staff, messages, auditLog, lowStockThreshold })); } catch { /* storage unavailable */ }
  }, [staff, messages, auditLog, lowStockThreshold]);

  useEffect(() => {
    try {
      if (user) localStorage.setItem(SESSION, JSON.stringify(user));
      else localStorage.removeItem(SESSION);
    } catch { /* ignore */ }
  }, [user]);

  const notify = useCallback((message, type = 'success', vars) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type, vars }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const addAudit = useCallback((action, detail, actor) => {
    const entry = { id: `AUD-${Date.now()}`, at: new Date().toISOString(), actor: actor || 'System', action, detail };
    setAuditLog((list) => [entry, ...list].slice(0, 500));
  }, []);

  const login = useCallback((email, password, role) => {
    const id = email.trim().toLowerCase();
    let found = USERS.find((u) => u.email.toLowerCase() === id);
    if (!found) {
      // staff added by the admin: signs in with the username + password the admin assigned
      const s = staff.find((x) => x.password && ((x.username || '').toLowerCase() === id || (x.email || '').toLowerCase() === id));
      if (s) found = { email: s.username || s.email, password: s.password, role: 'Staff', name: s.name, title: s.role };
    }
    if (!found) return { ok: false, error: 'No account found with that email address.' };
    if (found.password !== password) return { ok: false, error: 'Incorrect password. Please try again.' };
    if (found.role !== role) {
      return { ok: false, error: 'This account belongs to the {role} role. Please select {role}.', vars: { role: found.role } };
    }
    const session = { name: found.name, email: found.email, role: found.role, title: found.title };
    setUser(session);
    addAudit('Login', `${found.name} (${found.role}) signed in`, found.name);
    return { ok: true, user: session };
  }, [addAudit, staff]);

  const sendMessage = useCallback((text, to = 'inventory', from = '') => {
    setMessages((m) => [{ id: Date.now() + Math.random(), text, to, from, at: Date.now(), read: false }, ...m].slice(0, 100));
  }, []);
  const markMessagesRead = useCallback(() => setMessages((m) => m.map((x) => (x.read ? x : { ...x, read: true }))), []);
  const markMessageRead = useCallback((id) => setMessages((m) => m.map((x) => (x.id === id ? { ...x, read: true } : x))), []);

  const logout = useCallback(() => {
    if (user) addAudit('Logout', `${user.name} signed out`, user.name);
    setUser(null);
  }, [user, addAudit]);

  const value = {
    products, orders, appointments, setAppointments, approveAppointment, rejectAppointment,
    customers, staff, setStaff, user, login, logout, notify, toasts, activity,
    messages, sendMessage, markMessagesRead, markMessageRead,
    auditLog, addAudit, lowStockThreshold, setLowStockThreshold
  };
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
