import Modal from './Modal.jsx';
import { useT } from '../i18n.js';

export default function ConfirmDialog({ title, message, confirmLabel = 'Delete', onConfirm, onCancel }) {
  const { t } = useT();
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onCancel}>{t('Cancel')}</button>
          <button className="btn btn-danger" onClick={onConfirm}>{t(confirmLabel)}</button>
        </>
      }
    >
      <p>{message}</p>
    </Modal>
  );
}
