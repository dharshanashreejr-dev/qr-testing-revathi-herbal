import { useState } from 'react';
import { useT } from '../i18n.js';
import { useStore } from '../store.jsx';
import Badge from '../components/Badge.jsx';
import * as att from '../../api/attendance';

export default function Devices() {
  const { t } = useT();
  const { staff } = useStore();
  const devices = att.listDevices();
  const [map, setMap] = useState(att.listDeviceMap());

  const setMapping = (staffId, deviceUserId) => {
    const next = [...map.filter((m) => m.staffId !== staffId), { staffId, deviceUserId, enrolled: !!deviceUserId }];
    setMap(next); att.saveDeviceMap(next);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div><h2>{t('Device Settings')}</h2>
          <p className="muted">{t('Biometric / tablet devices — status, last sync, staff mapping (demo)')}</p></div>
      </div>
      <div className="grid-2">
        <div className="card">
          <h3>{t('Devices')}</h3>
          <table className="table">
            <thead><tr><th>{t('Name')}</th><th>{t('Location')}</th><th>{t('Status')}</th><th>{t('Last sync')}</th><th>{t('Enrolled')}</th></tr></thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.id}>
                  <td><strong>{d.name}</strong><div className="muted">{d.id}</div></td>
                  <td>{d.location}</td>
                  <td><Badge tone={d.status === 'Online' ? 'green' : 'amber'}>{t(d.status)}</Badge></td>
                  <td>{new Date(d.lastSync).toLocaleString()}</td>
                  <td>{d.enrolled}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3>{t('Staff ↔ device ID')}</h3>
          <table className="table">
            <thead><tr><th>{t('Staff')}</th><th>{t('Device user ID')}</th><th>{t('Enrolled')}</th></tr></thead>
            <tbody>
              {(staff || []).map((s) => {
                const m = map.find((x) => x.staffId === s.id);
                return (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td><input value={m?.deviceUserId || ''} placeholder="e.g. 10024" onChange={(e) => setMapping(s.id, e.target.value)} /></td>
                    <td>{m?.enrolled ? t('Yes') : t('No')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
