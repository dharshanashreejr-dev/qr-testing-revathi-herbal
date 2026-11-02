import { useT } from '../i18n.js';

export default function Brand({ light = false, size = 'md' }) {
  const { t } = useT();
  return (
    <div className={`brand brand-${size} ${light ? 'brand-light' : ''}`}>
      <img className="rv-logo rv-logo-admin" src="/revathi-logo.svg" alt="" width={44} height={44} />
      <div>
        <strong>{t('Revathi Herbal Beauty Care')}</strong>
        <span>{t('Beauty Salon admin')}</span>
      </div>
    </div>
  );
}
