import { useT } from '../i18n.js';
import { useStore } from '../store.jsx';
import { PhonesPanel } from './QrAttendance.jsx';

// Staff phones for QR attendance: approve phones, fingerprint status, alerts, salon WiFi check.
// (No biometric machine in this project, so the old fake device list was removed.)
export default function Devices() {
  const { t } = useT();
  const { staff } = useStore();
  return (
    <div className="page">
      <div className="page-header">
        <div><h2>{t('Staff Phones')}</h2>
          <p className="muted">{t('Approve staff phones for QR attendance, fingerprint status and salon WiFi check')}</p></div>
      </div>
      <PhonesPanel staff={staff || []} />
    </div>
  );
}
