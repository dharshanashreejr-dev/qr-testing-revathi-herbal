import { useRef } from 'react';
import { Printer } from 'lucide-react';
import Modal from './Modal.jsx';
import { useT } from '../i18n.js';

// Shows the pages that are about to print (slips / bills) and prints them from the Print button.
export default function PrintPreview({ title, subtitle, html, onPrint, onClose }) {
  const { t } = useT();
  const ref = useRef(null);
  const print = () => {
    const w = ref.current?.contentWindow;
    if (!w) return;
    w.focus();
    w.print();
    if (onPrint) onPrint();
  };
  return (
    <Modal wide title={title} subtitle={subtitle} onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>{t('Close')}</button><button className="btn btn-primary" onClick={print}><Printer size={16} />{t('Print')}</button></>}>
      <iframe ref={ref} title={title} srcDoc={html} style={{ width: '100%', height: '60vh', border: '1px solid var(--line)', borderRadius: 10, background: '#eadde0' }} />
      <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>{t('In the print window choose your printer. For the cleanest slip turn off "Headers and footers" and set Margins to None.')}</p>
    </Modal>
  );
}
