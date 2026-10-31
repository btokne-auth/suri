// app/profile/client.js
// Step 6: profile form. Server is the real check; browser mirrors messages.
// Phone fix: birth date is Month/Day/Year plain fields, combined to YYYY-MM-DD.
'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import SuriHeader from '../components/SuriHeader.js';
const MONTHS = [['01', 'January'], ['02', 'February'], ['03', 'March'], ['04', 'April'], ['05', 'May'], ['06', 'June'], ['07', 'July'], ['08', 'August'], ['09', 'September'], ['10', 'October'], ['11', 'November'], ['12', 'December']];
export default function ProfileClient() {
  const [sub] = useState(() => {
    try {
      if (typeof window === 'undefined') return '';
      const q = new URLSearchParams(window.location.search);
      return q.get('submission') || '';
    } catch { return ''; }
  });
  const [form, setForm] = useState({ given_name: '', middle_name: '', surname: '', suffix: '', city_municipality: '' });
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [errs, setErrs] = useState({});
  const [msg, setMsg] = useState('');
  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.from('profiles').select('given_name,middle_name,surname,suffix,birth_date,city_municipality').maybeSingle();
        if (!data) return;
        setForm({ given_name: data.given_name || '', middle_name: data.middle_name || '', surname: data.surname || '', suffix: data.suffix || '', city_municipality: data.city_municipality || '' });
        if (typeof data.birth_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.birth_date)) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setBirthMonth(data.birth_date.slice(5, 7));
          setBirthDay(data.birth_date.slice(8, 10));
          setBirthYear(data.birth_date.slice(0, 4));
        }
      } catch { /* stays empty, server still checks on save */ }
    })();
  }, []);
  function set(k, v) { setForm((p) => ({ ...p, [k]: v })); }
  function buildBirthDate() {
    const d = String(birthDay).replace(/\D/g, '').slice(0, 2);
    const y = String(birthYear).replace(/\D/g, '').slice(0, 4);
    if (!birthMonth || !d || y.length !== 4) return '';
    return y + '-' + birthMonth + '-' + d.padStart(2, '0');
  }
  async function save(e) {
    e.preventDefault();
    setErrs({});
    setMsg('Saving...');
    try {
      const body = { ...form, birth_date: buildBirthDate() };
      const r = await fetch('/api/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) {
        const byField = {};
        for (const i of (j.issues || [])) { if (i.field && !byField[i.field]) byField[i.field] = i.message; }
        setErrs(byField);
        setMsg(j.error || 'Please fix the fields below.');
        return;
      }
      setMsg('Saved.');
      if (sub) window.location.href = '/set/' + encodeURIComponent(sub);
      else setMsg('Saved.');
    } catch { setMsg('Could not save. Please try again.'); }
  }
  function formatBirthDateError(m) {
    const s = String(m || '');
    if (s.includes('YYYY-MM-DD')) return 'Enter your birth date using the Month, Day, and Year fields above.';
    return s;
  }
  const hasErrs = Object.keys(errs).length > 0;
  const errValues = Object.values(errs);
  const shouldShowMsg = (() => {
    if (!msg) return false;
    if (msg === 'Saved.' && !sub) return false;
    if (msg === 'Saving...') return true;
    if (msg === 'Please fix the fields below.' && hasErrs) return false;
    if (errValues.includes(msg)) return false;
    return true;
  })();
  return (
    <div className="checklist-page profile-page">
      <SuriHeader />
      <div className="profile-intro">
        <h1 className="checklist-h1">Your details</h1>
        <p className="checklist-subtitle">Type what is on your documents. Suri compares them to this.</p>
      </div>
      <form onSubmit={save} noValidate className="profile-form">
        <label className="profile-label">
          <span className="mono profile-label-text">Given name</span>
          <input className="profile-input" value={form.given_name} onChange={(e) => set('given_name', e.target.value)} autoComplete="given-name" />
        </label>
        {errs.given_name && <span className="profile-error">{errs.given_name}</span>}
        <label className="profile-label">
          <span className="mono profile-label-text">Middle name (optional)</span>
          <input className="profile-input" value={form.middle_name} onChange={(e) => set('middle_name', e.target.value)} autoComplete="additional-name" />
        </label>
        {errs.middle_name && <span className="profile-error">{errs.middle_name}</span>}
        <label className="profile-label">
          <span className="mono profile-label-text">Surname</span>
          <input className="profile-input" value={form.surname} onChange={(e) => set('surname', e.target.value)} autoComplete="family-name" />
        </label>
        {errs.surname && <span className="profile-error">{errs.surname}</span>}
        <label className="profile-label">
          <span className="mono profile-label-text">Suffix (Jr, Sr, II, III, IV, optional)</span>
          <input className="profile-input" value={form.suffix} onChange={(e) => set('suffix', e.target.value)} />
        </label>
        {errs.suffix && <span className="profile-error">{errs.suffix}</span>}
        <div style={{ marginTop: 4 }}>
          <span className="mono profile-label-text">Birth date</span>
          <div className="profile-birth-row">
            <label htmlFor="birth_month" className="profile-label" style={{ flex: '1 1 110px' }}>
              <span className="mono profile-label-text">Month</span>
              <select id="birth_month" className="profile-input" value={birthMonth} onChange={(e) => setBirthMonth(e.target.value)}>
                <option value="">Month</option>
                {MONTHS.map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="birth_day" className="profile-label" style={{ flex: '1 1 60px' }}>
              <span className="mono profile-label-text">Day</span>
              <input id="birth_day" className="profile-input" type="text" inputMode="numeric" maxLength={2} placeholder="Day" value={birthDay} onChange={(e) => setBirthDay(e.target.value)} />
            </label>
            <label htmlFor="birth_year" className="profile-label" style={{ flex: '1 1 80px' }}>
              <span className="mono profile-label-text">Year</span>
              <input id="birth_year" className="profile-input" type="text" inputMode="numeric" maxLength={4} placeholder="Year" value={birthYear} onChange={(e) => setBirthYear(e.target.value)} />
            </label>
          </div>
        </div>
        {errs.birth_date && <span className="profile-error">{formatBirthDateError(errs.birth_date)}</span>}
        <label className="profile-label">
          <span className="mono profile-label-text">City / municipality</span>
          <input className="profile-input" value={form.city_municipality} onChange={(e) => set('city_municipality', e.target.value)} autoComplete="address-level2" />
        </label>
        {errs.city_municipality && <span className="profile-error">{errs.city_municipality}</span>}
        <button type="submit" className="checklist-btn-primary" style={{ width: '100%' }}>
          Save and continue
        </button>
      </form>
      {shouldShowMsg && <p className="checklist-msg">{msg}</p>}
      {!sub && msg === 'Saved.' && (
        <>
          <p className="checklist-msg">Saved.</p>
          <p style={{ marginTop: 12 }}>
            <a href="/start" className="landing-section-link">
              Start a check →
            </a>
          </p>
        </>
      )}
      <p className="checklist-foot" style={{ marginTop: 16 }}>
        Sample documents only. Never upload a real ID.
      </p>
    </div>
  );
}
