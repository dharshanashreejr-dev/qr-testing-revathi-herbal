import { useMemo, useState } from 'react';
import {
  LayoutDashboard, ShoppingBag, CalendarDays, Users, IndianRupee, AlertTriangle, UserCheck, Plus, CalendarPlus, PackageSearch, ArrowRight
} from 'lucide-react';
import { useStore } from '../store.jsx';
import {
  inr, fmtDate, TODAY, LOW_STOCK, ORDER_STATUSES, APPOINTMENT_STATUSES
} from '../data/mockData.js';
import {
  orderTotal, revenueSeries, unitsSold, countBy, productRevenue, appointmentRevenue
} from '../utils.js';
import StatCard from '../components/StatCard.jsx';
import Badge from '../components/Badge.jsx';
import Avatar from '../components/Avatar.jsx';
import { AreaChart, Donut, HBars } from '../components/Charts.jsx';
import { useT } from '../i18n.js';
import * as att from '../../api/attendance';
import { pname } from '../../products/i18n-names';

const PERIODS = [
  { id: '3', label: 'Last 3 months', n: 3 },
  { id: '6', label: 'Last 6 months', n: 6 },
  { id: '7', label: 'Apr to Oct', n: 7 }
];

export default function Dashboard({ user, onNavigate }) {
  const { products, orders, appointments, customers, staff, activity, lowStockThreshold = 10 } = useStore();
  const { t, lang } = useT();
  const pName = (n) => pname(n, lang === 'ta' ? 'ta' : 'en');
  const personName = (n) => {
    if (lang !== 'ta' || !n) return n;
    const map = { Ananya: 'அனன்யா', Meera: 'மீரா', Isha: 'இஷா', Nisha: 'நிஷா', Anika: 'அனிகா', Priya: 'பிரியா', Latha: 'லதா', Karthik: 'கார்த்திக்', Divya: 'திவ்யா', ann: 'அன்', anu: 'அனு' };
    const parts = n.split(' ');
    return [map[parts[0]] || parts[0], ...parts.slice(1)].join(' ');
  };
  const whenLabel = (w) => {
    const m = /^(\d+) days ago$/.exec(w || '');
    if (m) return t('{n} days ago', { n: m[1] });
    const h = /^(\d+) hr ago$/.exec(w || '');
    if (h) return t('{n} hr ago', { n: h[1] });
    const mi = /^(\d+) min ago$/.exec(w || '');
    if (mi) return t('{n} min ago', { n: mi[1] });
    return t(w);
  };
  const [period, setPeriod] = useState('6');
  const isAdmin = user.role === 'Admin';

  const series = useMemo(() => {
    const all = revenueSeries(orders, appointments, products);
    const n = PERIODS.find((p) => p.id === period).n;
    return all.slice(-n);
  }, [orders, appointments, products, period]);

  const totalRevenue = productRevenue(orders, products) + appointmentRevenue(appointments);
  const lowStock = products.filter((p) => !p.archived && p.status !== 'Draft' && p.stock <= (lowStockThreshold ?? LOW_STOCK));
  const available = staff.filter((s) => s.availability === 'Available').length;
  try { att.seedDemoPunches((staff||[]).map(s=>({id:s.id,name:s.name}))); } catch {}
  const presentToday = att.liveBoard(staff||[]).filter((b)=>b.status==='Present'||b.status==='Late').length;
  const todays = appointments.filter((a) => a.date === TODAY).sort((a, b) => a.time.localeCompare(b.time));
  const recentOrders = [...orders].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const actText = (a) => t(a.what, Object.fromEntries(Object.entries(a.vars || {}).map(([k, v]) => [k, t(v)])));
  const staffName = (id) => staff.find((s) => s.id === id)?.name || t('Unassigned');

  return (
    <div className="page">
      <section className="banner">
        <div className="banner-copy">
          <span className="eyebrow">{fmtDate(TODAY, lang)}</span>
          <h2>{t('Good morning, {name}', { name: personName(user.name.split(' ')[0]) })}</h2>
          <p>
            {isAdmin
              ? t('{n} appointments are scheduled today and {m} orders are waiting to be processed.', { n: todays.length, m: orders.filter((o) => o.status === 'Order placed' || o.status === 'Order confirmed').length })
              : t('{n} appointments are scheduled today.', { n: todays.length })}
          </p>
          <div className="banner-actions">
            {isAdmin && <button className="btn btn-primary" onClick={() => onNavigate('products', 'add')}><Plus size={17} />{t('Add product')}</button>}
            <button className="btn btn-light" onClick={() => onNavigate('appointments', 'add')}><CalendarPlus size={17} />{t('New appointment')}</button>
            {isAdmin && <button className="btn btn-light" onClick={() => onNavigate('inventory')}><PackageSearch size={17} />{t('Check inventory')}</button>}
          </div>
        </div>
        <div className="banner-art" aria-hidden="true">
          <div className="mini-dash">
            <div className="mini-side">
              <LayoutDashboard size={22} />
              <i /><i /><i />
            </div>
            <div className="mini-main">
              <div className="mini-card">
                <span>{lang === 'ta' ? 'இன்றைய முன்பதிவுகள்' : "Today's bookings"}</span>
                <strong>{todays.length}</strong>
              </div>
              <div className="mini-tiles">
                <div className="t1"><span>{t('Customers')}</span><b>{customers.length}</b></div>
                <div className="t2"><span>{t('Present today')}</span><b>{presentToday}</b></div>
                <div className="t3"><span>{t('Appointments')}</span><b>{appointments.length}</b></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="toolbar">
        <h3 className="section-title">{t('Overview')}</h3>
        <label className="select-inline">
          <span>{t('Period')}</span>
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            {PERIODS.map((p) => <option key={p.id} value={p.id}>{t(p.label)}</option>)}
          </select>
        </label>
      </div>

      <div className="stat-grid">
        {isAdmin && <StatCard icon={ShoppingBag} label={t('Total product orders')} value={orders.length} hint={t('{n} delivered', { n: orders.filter((o) => o.status === 'Order delivered').length })} tone="rose" />}
        <StatCard icon={CalendarDays} label={t('Total appointments')} value={appointments.length} hint={t('{n} today', { n: todays.length })} tone="sage" />
        <StatCard icon={Users} label={t('Total customers')} value={customers.length} hint={t('Across all tiers')} tone="sand" />
        {isAdmin && <StatCard icon={IndianRupee} label={t('Total revenue')} value={inr(totalRevenue)} hint={t('Paid orders and services')} tone="forest" />}
        {isAdmin && <StatCard icon={AlertTriangle} label={t('Low-stock products')} value={lowStock.length} hint={t('{n} units or fewer', { n: lowStockThreshold ?? LOW_STOCK })} tone="amber" />}
        <StatCard icon={UserCheck} label={t('Present today')} value={presentToday} hint={t('In or late right now')} tone="sage" />
        <StatCard icon={UserCheck} label={t('Available specialists')} value={available} hint={t('of {n} team members', { n: staff.length })} tone="sage" />
      </div>

      <div className="grid-2">
        {isAdmin && (
          <div className="card">
            <div className="card-head"><h3>{t('Revenue overview')}</h3><span className="muted">{t('Products plus services, sample data')}</span></div>
            <AreaChart data={series} valueKey="total" xKey="month" />
          </div>
        )}
        {isAdmin && (
          <div className="card">
            <div className="card-head"><h3>{t('Product sales overview')}</h3><span className="muted">{t('Units sold')}</span></div>
            <HBars data={unitsSold(orders, products).slice(0, 6)} format={(n) => t('{n} units', { n })} />
          </div>
        )}
        <div className="card">
          <div className="card-head"><h3>{t('Appointment statistics')}</h3><span className="muted">{t('By status')}</span></div>
          <Donut data={countBy(appointments, 'status', APPOINTMENT_STATUSES)} centerLabel={t("Bookings")} centerValue={appointments.length} />
        </div>
        {isAdmin && (
          <div className="card">
            <div className="card-head"><h3>{t('Order status distribution')}</h3><span className="muted">{t('All orders')}</span></div>
            <Donut data={countBy(orders, 'status', ORDER_STATUSES)} centerLabel={t("Orders")} centerValue={orders.length} />
          </div>
        )}
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <h3>{t("Today's appointments")}</h3>
            <button className="link-btn" onClick={() => onNavigate('appointments')}>{t('View all')}<ArrowRight size={14} /></button>
          </div>
          <ul className="timeline">
            {todays.length === 0 && <li className="muted">{t('No appointments today.')}</li>}
            {todays.map((a) => (
              <li key={a.id}>
                <span className="time">{a.time}</span>
                <div><strong>{a.customer}</strong><span className="muted">{t('{service} with {name}', { service: t(a.service), name: staffName(a.specialistId) })}</span></div>
                <Badge>{t(a.status)}</Badge>
              </li>
            ))}
          </ul>
        </div>

        {isAdmin ? (
          <div className="card">
            <div className="card-head">
              <h3>{t('Recent orders')}</h3>
              <button className="link-btn" onClick={() => onNavigate('orders')}>{t('View all')}<ArrowRight size={14} /></button>
            </div>
            <ul className="list">
              {recentOrders.map((o) => (
                <li key={o.id}>
                  <div><strong>{o.id}</strong><span className="muted">{o.customer}</span></div>
                  <div className="right"><strong>{inr(orderTotal(o, products))}</strong><Badge>{t(o.status)}</Badge></div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="card">
            <div className="card-head"><h3>{t('Recent customer activity')}</h3></div>
            <ul className="list">
              {activity.length === 0 && <li className="muted">{t('No activity yet.')}</li>}
              {activity.map((a, i) => (
                <li key={i}><div><strong>{personName(a.who)}</strong><span className="muted">{actText(a)}</span></div><span className="muted">{whenLabel(a.when)}</span></li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="grid-2">
          <div className="card">
            <div className="card-head">
              <h3>{t('Low-stock alerts')}</h3>
              <button className="link-btn" onClick={() => onNavigate('inventory')}>{t('Manage')}<ArrowRight size={14} /></button>
            </div>
            <ul className="list">
              {lowStock.length === 0 && <li className="muted">{t('All products are well stocked.')}</li>}
              {lowStock.map((p) => (
                <li key={p.id}>
                  <div><strong>{pName(p.name)}</strong><span className="muted">{p.id}</span></div>
                  <Badge tone={p.stock === 0 ? 'red' : 'amber'}>{p.stock === 0 ? t('Out of stock') : t('{n} left', { n: p.stock })}</Badge>
                </li>
              ))}
            </ul>
          </div>
          <div className="card">
            <div className="card-head"><h3>{t('Recent customer activity')}</h3></div>
            <ul className="list">
              {activity.length === 0 && <li className="muted">{t('No activity yet.')}</li>}
              {activity.map((a, i) => (
                <li key={i}>
                  <div className="row-gap"><Avatar name={a.who} size={34} index={i} /><div><strong>{personName(a.who)}</strong><span className="muted">{actText(a)}</span></div></div>
                  <span className="muted">{whenLabel(a.when)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
