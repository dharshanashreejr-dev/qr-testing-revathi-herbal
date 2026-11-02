import { useMemo, useState } from 'react';
import { Search, Eye, Mail, Phone, CalendarDays, Crown } from 'lucide-react';
import { useStore } from '../store.jsx';
import { LOYALTY_TIERS, inr, fmtDate } from '../data/mockData.js';
import { orderTotal, productOf, countsAsRevenue, servicePrice } from '../utils.js';
import PageHeader from '../components/PageHeader.jsx';
import DataTable from '../components/DataTable.jsx';
import Badge from '../components/Badge.jsx';
import Modal from '../components/Modal.jsx';
import Avatar from '../components/Avatar.jsx';
import HoloCard from '../reactbits/HoloCard.jsx';
import SafeEffect from '../components/SafeEffect.jsx';
import { useT } from '../i18n.js';

export default function Customers() {
  const { customers, orders, appointments, products, staff } = useStore();
  const { t, lang } = useT();
  const [q, setQ] = useState('');
  const [tier, setTier] = useState('All');
  const [openId, setOpenId] = useState(null);

  const enriched = useMemo(
    () =>
      customers.map((c, i) => {
        const myOrders = orders.filter((o) => o.customerId === c.id);
        const myAppts = appointments.filter((a) => a.customerId === c.id);
        const spend =
          myOrders.filter(countsAsRevenue).reduce((s, o) => s + orderTotal(o, products), 0) +
          myAppts.filter((a) => a.status === 'Completed').reduce((s, a) => s + servicePrice(a.service), 0);
        return { ...c, index: i, myOrders, myAppts, spend };
      }),
    [customers, orders, appointments, products]
  );

  const rows = enriched.filter((c) =>
    (tier === 'All' || c.tier === tier) &&
    (!q.trim() || `${c.name} ${c.email} ${c.phone}`.toLowerCase().includes(q.trim().toLowerCase()))
  );
  const open = enriched.find((c) => c.id === openId);
  const topVip = enriched.filter((c) => c.tier === 'VIP').sort((a, b) => b.spend - a.spend)[0];
  const staffName = (id) => staff.find((s) => s.id === id)?.name || t('Unassigned');

  const columns = [
    { key: 'name', label: t('Customer'), render: (c) => (
      <div className="row-gap"><Avatar name={c.name} index={c.index} /><div><strong>{c.name}</strong><span className="muted block">{c.email}</span></div></div>
    ) },
    { key: 'phone', label: t('Phone') },
    { key: 'registered', label: t('Registered'), render: (c) => fmtDate(c.registered) },
    { key: 'orders', label: t('Orders'), render: (c) => c.myOrders.length },
    { key: 'spend', label: t('Total spending'), render: (c) => <strong>{inr(c.spend)}</strong> },
    { key: 'last', label: t('Last activity'), render: (c) => fmtDate(c.lastActivity) },
    { key: 'tier', label: t('Tier'), render: (c) => <Badge>{c.tier}</Badge> },
    { key: 'view', label: '', width: '60px', render: (c) => <button className="icon-btn" onClick={(e) => { e.stopPropagation(); setOpenId(c.id); }} aria-label={`View ${c.name}`}><Eye size={17} /></button> }
  ];

  return (
    <div className="page">
      <PageHeader title={t('Customers and CRM')} subtitle={`${customers.length} customers across ${LOYALTY_TIERS.length} loyalty tiers`} />

      {topVip && (
        <section className="vip-spotlight">
          <div className="vip-copy">
            <span className="eyebrow"><Crown size={14} />{t('VIP spotlight')}</span>
            <h3>{topVip.name}</h3>
            <p>{t('Member since')} {fmtDate(topVip.registered)}. {t('Total spending')} {inr(topVip.spend)} {t('across')} {topVip.myOrders.length} {t('order(s)')} {t('and')} {topVip.myAppts.length} {t('appointment(s)')}.</p>
            <div className="banner-actions">
              <button className="btn btn-primary" onClick={() => setOpenId(topVip.id)}>{t('Open profile')}</button>
            </div>
            <span className="muted">Tip: move over the card to see the foil react, click it to flip.</span>
          </div>
          <div className="vip-card">
            <SafeEffect fallback={<img src="/holo-front.svg" alt="Revathi Herbal Beauty Care VIP membership card" width="190" />}>
              <HoloCard image="/holo-front.svg" backImage="/holo-back.svg" alt="Revathi Herbal Beauty Care VIP membership card" preset="gold" width={190} radius={12} frame={4} />
            </SafeEffect>
          </div>
        </section>
      )}

      <div className="filters">
        <div className="search-box"><Search size={17} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Search by name, email or phone')} aria-label={t('Search customers')} /></div>
        <select value={tier} onChange={(e) => setTier(e.target.value)} aria-label={t('Filter by loyalty tier')}>
          <option value="All">{t('All loyalty tiers')}</option>{LOYALTY_TIERS.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div className="card flush"><DataTable columns={columns} rows={rows} onRowClick={(c) => setOpenId(c.id)} /></div>

      {open && (
        <Modal title={open.name} subtitle={`Customer ${open.id}`} wide onClose={() => setOpenId(null)}
          footer={<button className="btn btn-primary" onClick={() => setOpenId(null)}>{t('Close')}</button>}>
          <div className="profile-head">
            <Avatar name={open.name} size={68} index={open.index} />
            <div className="profile-meta">
              <Badge>{open.tier}</Badge>
              <span><Mail size={15} />{open.email}</span>
              <span><Phone size={15} />{open.phone}</span>
              <span><CalendarDays size={15} />Registered {fmtDate(open.registered)}</span>
            </div>
            <div className="profile-stats">
              <div><strong>{open.myOrders.length}</strong><span>{t('Orders')}</span></div>
              <div><strong>{inr(open.spend)}</strong><span>{t('Total spending')}</span></div>
              <div><strong>{fmtDate(open.lastActivity)}</strong><span>{t('Last activity')}</span></div>
            </div>
          </div>
          <div className="detail-grid">
            <div>
              <h4 className="mini-title">{t('Appointment history')}</h4>
              <ul className="list">
                {open.myAppts.length === 0 && <li className="muted">{t('No appointments yet.')}</li>}
                {open.myAppts.sort((a, b) => b.date.localeCompare(a.date)).map((a) => (
                  <li key={a.id}><div><strong>{a.service}</strong><span className="muted">{fmtDate(a.date)}, {a.time} with {staffName(a.specialistId)}</span></div><Badge>{a.status}</Badge></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="mini-title">{t('Product purchase history')}</h4>
              <ul className="list">
                {open.myOrders.length === 0 && <li className="muted">{t('No purchases yet.')}</li>}
                {open.myOrders.map((o) => (
                  <li key={o.id}>
                    <div><strong>{o.id}</strong><span className="muted">{o.items.map((i) => `${productOf(products, i.productId)?.name || t('Discontinued product')} x${i.qty}`).join(', ')}</span></div>
                    <div className="right"><strong>{inr(orderTotal(o, products))}</strong><Badge>{o.status}</Badge></div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
