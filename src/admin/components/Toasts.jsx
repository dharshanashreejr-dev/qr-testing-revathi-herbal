
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { useStore } from '../store.jsx';
import { useT } from '../i18n.js';

export default function Toasts() {
  const { toasts } = useStore();
  const { t: tr } = useT();
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          {t.type === 'error' ? <AlertTriangle size={18} /> : t.type === 'info' ? <Info size={18} /> : <CheckCircle2 size={18} />}
          <span>{tr(t.message, t.vars)}</span>
        </div>
      ))}
    </div>
  );
}
