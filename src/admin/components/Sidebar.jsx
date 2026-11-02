import { Globe, LogOut } from 'lucide-react';
import { NAV } from '../nav.js';
import Brand from './Brand.jsx';
import Avatar from './Avatar.jsx';
import { useT } from '../i18n.js';

export default function Sidebar({ user, page, onNavigate, onLogout, open, onClose }) {
  const { t } = useT();
  const items = NAV.filter((n) => n.roles.includes(user.role));
  return (
    <>
      <div className={`sidebar-scrim ${open ? 'show' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label={t('Main navigation')}>
        <Brand light />
        <nav>
          <span className="nav-caption">{user.role === 'Admin' ? t('Administration') : t('Staff Workspace')}</span>
          {items.map((n) => (
            <button key={n.id} className={`nav-item ${page === n.id ? 'active' : ''}`} onClick={() => onNavigate(n.id)}>
              <n.icon size={19} />
              <span>{t(n.label)}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="user-chip">
            <Avatar name={user.name} size={38} />
            <div>
              <strong>{user.name}</strong>
              <span>{t(user.role)}</span>
            </div>
          </div>
          <a className="nav-item" href="/" style={{ textDecoration: 'none' }}>
            <Globe size={19} /><span>{t('Back to website')}</span>
          </a>
          
          <button className="nav-item logout" onClick={onLogout}>
            <LogOut size={19} /><span>{t('Log out')}</span>
          </button>
        </div>
      </aside>
    </>
  );
}
