import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useStore } from '../store.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Badge from '../components/Badge.jsx';
import { useT } from '../i18n.js';
import { deleteReview, useReviews } from '../../shared/reviews';

// Customer reviews submitted on the website (products and services).
export default function Reviews() {
  const { notify } = useStore();
  const { t } = useT();
  const reviews = useReviews();
  const [kind, setKind] = useState('all');
  const rows = reviews.filter((r) => kind === 'all' || r.kind === kind);

  return (
    <div className="page">
      <PageHeader title={t('Reviews')} subtitle={t('What customers say about your products and services.')} />
      <div className="filters">
        <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label={t('Filter by type')}>
          <option value="all">{t('All reviews')}</option><option value="product">{t('Products')}</option><option value="service">{t('Services')}</option>
        </select>
      </div>
      {rows.length === 0 && <div className="card"><p className="muted" style={{ margin: 0, padding: 8 }}>{t('No reviews yet.')}</p></div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {rows.map((r) => (
          <article key={r.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <strong style={{ display: 'block' }}>{r.name}</strong>
                <span className="muted" style={{ fontSize: 12.5 }}>{new Date(r.at).toLocaleDateString('en-IN')}</span>
              </div>
              <button className="icon-btn danger" aria-label={t('Delete review')} title={t('Delete review')} onClick={() => { deleteReview(r.id); notify(t('Review deleted.')); }}><Trash2 size={16} /></button>
            </div>
            <div style={{ fontSize: 17, letterSpacing: 2 }}><span style={{ color: '#b76e79' }}>{'★'.repeat(r.rating)}</span><span style={{ opacity: 0.3 }}>{'★'.repeat(5 - r.rating)}</span></div>
            <p style={{ margin: 0, lineHeight: 1.55, flex: 1 }}>{r.text}</p>
            <div className="muted" style={{ fontSize: 13, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Badge>{r.kind === 'product' ? t('Product') : t('Service')}</Badge>{r.targetName}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
