import { lazy, Suspense, useState } from 'react';
import { Eye, EyeOff, LogIn, AlertCircle, Info, ShieldCheck, UserRound } from 'lucide-react';
import { useStore } from '../store.jsx';
import Brand from '../components/Brand.jsx';
import DepthText from '../reactbits/DepthText.jsx';
import SafeEffect from '../components/SafeEffect.jsx';
import LangSelect from '../components/LangSelect.jsx';
import { useT } from '../i18n.js';

const AeroShards = lazy(() => import('../reactbits/AeroShards.jsx'));

const DEMO = {
  Admin: { email: 'admin@revathiherbal.demo', password: 'Admin@123' },
  Staff: { email: 'staff@revathiherbal.demo', password: 'Staff@123' }
};

export default function Login({ onSuccess }) {
  const { login, notify } = useStore();
  const { t } = useT();
  const [role, setRole] = useState('Admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null); // { text, vars }
  const [shardsFailed, setShardsFailed] = useState(false);
  const webgpu = typeof navigator !== 'undefined' && !!navigator.gpu;

  const validate = () => {
    const e = {};
    if (!email.trim()) e.email = 'Email or username is required.';
    if (!password) e.password = 'Password is required.';
    else if (password.length < 6) e.password = 'Password must be at least 6 characters.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = (ev) => {
    ev.preventDefault();
    setFormError(null);
    if (!validate()) return;
    const res = login(email, password, role);
    if (!res.ok) {
      setFormError({ text: res.error, vars: res.vars });
      return;
    }
    notify('Welcome back, {name}.', 'success', { name: res.user.name });
    onSuccess();
  };

  const fill = (r) => {
    setRole(r);
    setEmail(DEMO[r].email);
    setPassword(DEMO[r].password);
    setErrors({});
    setFormError(null);
  };

  return (
    <div className="login-page">
      <section className="login-hero">
        <div className="hero-bg" aria-hidden="true">
          {webgpu && !shardsFailed && (
            <SafeEffect><Suspense fallback={null}>
              <AeroShards
                backgroundColor="#963f55"
                shardColor="#e3a3ac"
                accentColor="#f5e2e6"
                detail="balanced"
                material="satin"
                density={0.9}
                shardSize={1}
                bloom={0.35}
                grain={0.04}
                interaction="none"
                holdToGather={false}
                rippleIntensity={0}
                speed={0.6}
                onError={() => setShardsFailed(true)}
              />
            </Suspense></SafeEffect>
          )}
        </div>
        <div className="hero-overlay" />
        <div className="hero-content">
          <Brand light />
          <div className="hero-copy">
            <DepthText
              text="Revathi Herbal Beauty Care"
              layers={12}
              depth={0.8}
              faceColor="#fff7f8"
              depthColor="#e3a3ac"
              tilt={0}
              autoOrbit={false}
              pointerTracking={false}
              fontSize="clamp(1.6rem, 3.2vw, 2.8rem)"
              fontWeight={800}
            />
            <p>
              {t('A calm, considered workspace for running your salon, skincare boutique and wellness studio. Orders, appointments, clients and specialists in one place.')}
            </p>
          </div>
          <span className="hero-foot">{t('Prepared by D-Sites Infosolutions - Client UI Demo')}</span>
        </div>
      </section>

      <section className="login-panel">
        <form className="login-card" onSubmit={submit} noValidate>
          <a href="/" className="muted" style={{ display: 'inline-block', marginBottom: 12, fontSize: 13 }}>&larr; {t('Back to website')}</a>
          <div style={{ float: 'right' }}><LangSelect /></div>
          <h2>{t('Welcome back')}</h2>
          <p className="muted">{t('Sign in to the Admin and Staff panel.')}</p>

          <div className="role-switch" role="tablist" aria-label={t('Sign in as')}>
            {['Admin', 'Staff'].map((r) => (
              <button type="button" role="tab" aria-selected={role === r} key={r} className={role === r ? 'active' : ''} onClick={() => { setRole(r); setFormError(null); }}>
                {r === 'Admin' ? <ShieldCheck size={16} /> : <UserRound size={16} />}{t(r)}
              </button>
            ))}
          </div>

          <label className={`field ${errors.email ? 'has-error' : ''}`}>
            <span className="field-label">{t('Email / Username')}</span>
            <input type="text" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={DEMO[role].email} />
            {errors.email && <span className="field-error">{t(errors.email)}</span>}
          </label>

          <div className={`field ${errors.password ? 'has-error' : ''}`}>
            <label className="field-label" htmlFor="login-password">{t('Password')}</label>
            <div className="input-with-btn">
              <input id="login-password" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('Enter your password')} />
              <button type="button" className="icon-btn" onClick={() => setShow(!show)} aria-label={show ? t('Hide password') : t('Show password')}>
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && <span className="field-error">{t(errors.password)}</span>}
          </div>

          {formError && <div className="alert alert-error"><AlertCircle size={18} />{t(formError.text, formError.vars && { role: t(formError.vars.role) })}</div>}

          <button type="submit" className="btn btn-primary btn-block"><LogIn size={18} />{t('Sign in as {role}', { role: t(role) })}</button>

          <div className="demo-box">
            <strong><Info size={15} />{t('Demo credentials')}</strong>
            <div className="demo-row">
              <span>{t('Admin')}: admin@revathiherbal.demo / Admin@123</span>
              <button type="button" className="link-btn" onClick={() => fill('Admin')}>{t('Use')}</button>
            </div>
            <div className="demo-row">
              <span>{t('Staff')}: staff@revathiherbal.demo / Staff@123</span>
              <button type="button" className="link-btn" onClick={() => fill('Staff')}>{t('Use')}</button>
            </div>
            <div className="demo-row"><span>{t('Staff')} 2: staff2@revathiherbal.demo / Staff@123</span></div>
            <div className="demo-row"><span>{t('Staff')} 3: staff3@revathiherbal.demo / Staff@123</span></div>
          </div>
          <p className="disclaimer">
            {t('This is a frontend demonstration only. Credentials are hardcoded in the browser and this is not production authentication or secure access control.')}
          </p>
        </form>
      </section>
    </div>
  );
}
