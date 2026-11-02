import { ShieldAlert } from 'lucide-react';
import { useT } from '../i18n.js';

export default function AccessDenied({ onBack }) {
  const { t } = useT();
  return (
    <div className="page denied">
      <div className="denied-card">
        <ShieldAlert size={42} />
        <h2>{t('Access denied')}</h2>
        <p className="muted">{t('Your Staff role does not include this page. This is a demo of role-based navigation and is not secure production access control.')}</p>
        <button className="btn btn-primary" onClick={onBack}>{t('Back to dashboard')}</button>
      </div>
    </div>
  );
}
