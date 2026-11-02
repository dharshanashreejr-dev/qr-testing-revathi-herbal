import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, ChevronDown, Menu, RotateCcw, Search, LogOut, ShieldCheck } from 'lucide-react';
import { NAV } from '../nav.js';
import { useStore } from '../store.jsx';
import { LOW_STOCK } from '../data/mockData.js';
import Avatar from './Avatar.jsx';
import LangSelect from './LangSelect.jsx';
import { useT } from '../i18n.js';

export default function Topbar({ user, page, onNavigate, onMenu, onLogout }) {
  const { products, orders, appointments, messages, markMessageRead, markMessagesRead } = useStore();
  const { t, lang } = useT();
  const [q, setQ] = useState('');
  const [menu, setMenu] = useState(null); // 'notif' | 'profile' | null
  const ref = useRef(null);
  const current = NAV.find((n) => n.id === page);
  const allowed = NAV.filter((n) => n.roles.includes(user.role));

  useEffect(() => {
    const onDoc = (e) => ref.current && !ref.current.contains(e.target) && setMenu(null);
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const matches = useMemo(
    () => (q.trim() ? allowed.filter((n) => (n.label + ' ' + t(n.label)).toLowerCase().includes(q.trim().toLowerCase())) : []),
    [q, allowed, lang]
  );

  const notifications = useMemo(() => {
    const list = [];
    if (user.role === 'Admin') {
      messages.filter((m) => !m.read).forEach((m) => list.push({ id: 'm' + m.id, text: m.text, to: m.to || 'inventory', msg: m.id }));
      products.filter((p) => !p.archived && p.stock > 0 && p.stock <= LOW_STOCK).forEach((p) => list.push({ id: p.id, text: t('{name} is low on stock ({n} left)', { name: p.name, n: p.stock }), to: 'inventory' }));
      products.filter((p) => !p.archived && p.stock === 0).forEach((p) => list.push({ id: p.id + 'o', text: t('{name} is out of stock', { name: p.name }), to: 'inventory' }));
      orders.filter((o) => o.status === 'Order placed').forEach((o) => list.push({ id: o.id, text: t('Order {id} is awaiting processing', { id: o.id }), to: 'orders' }));
    }
    appointments.filter((a) => a.status === 'Pending Review').forEach((a) => list.push({ id: a.id, text: t('Appointment {id} needs confirmation', { id: a.id }), to: 'appointments' }));
    return list;
  }, [products, orders, appointments, messages, user.role, lang]);

  return (
    <header className="topbar" ref={ref}>
      <button className="icon-btn menu-btn" onClick={onMenu} aria-label={t('Open navigation')}><Menu size={20} /></button>
      <div className="crumbs">
        <span className="crumb-trail">Revathi Herbal Beauty Care / {t(user.role)} / {t(current?.label || 'Access')}</span>
        <h1>{t(current?.label || 'Access Denied')}</h1>
      </div>

      <div className="topbar-search">
        <Search size={17} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Jump to a page...')} aria-label={t('Jump to a page')} />
        {matches.length > 0 && (
          <ul className="search-pop">
            {matches.map((m) => (
              <li key={m.id}><button onClick={() => { onNavigate(m.id); setQ(''); }}><m.icon size={16} />{t(m.label)}</button></li>
            ))}
          </ul>
        )}
      </div>

      <div className="topbar-actions">
        <div className="pop-anchor">
          <button className="icon-btn" onClick={() => setMenu(menu === 'notif' ? null : 'notif')} aria-label={t('Notifications')}>
            <Bell size={19} />
            {notifications.length > 0 && <span className="dot">{notifications.length}</span>}
          </button>
          {menu === 'notif' && (
            <div className="popover">
              <h4>{t('Notifications')}{user.role === 'Admin' && messages.some((m) => !m.read) && <button className="link-btn" style={{ float: 'right' }} onClick={markMessagesRead}>{t('Mark messages read')}</button>}</h4>
              {notifications.length === 0 && <p className="muted pad">{t('You are all caught up.')}</p>}
              <ul>
                {notifications.map((n) => (
                  <li key={n.id}><button onClick={() => { if (n.msg) markMessageRead(n.msg); onNavigate(n.to); setMenu(null); }}>{n.text}</button></li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <LangSelect />
        <div className="pop-anchor">
          <button className="profile-btn" onClick={() => setMenu(menu === 'profile' ? null : 'profile')} aria-label={t('Profile menu')}>
            <Avatar name={user.name} size={34} />
            <span className="profile-text"><strong>{user.name}</strong><em>{t(user.role)}</em></span>
            <ChevronDown size={16} />
          </button>
          {menu === 'profile' && (
            <div className="popover popover-right">
              <div className="pop-profile">
                <strong>{user.name}</strong>
                <span className="muted">{user.email}</span>
                <span className="role-pill"><ShieldCheck size={14} />{t('{role} (demo role)', { role: t(user.role) })}</span>
              </div>
              <button className="pop-item" onClick={onLogout}><LogOut size={16} />{t('Log out')}</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
