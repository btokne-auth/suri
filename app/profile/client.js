// app/profile/client.js
// Step 6: profile form. Server is the real check; browser mirrors messages.
// Phone fix: birth date is Month/Day/Year plain fields, combined to YYYY-MM-DD.
'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
const INP = { display: 'block', width: '100%', maxWidth: '100%', padding: 12, minHeight: 44, fontSize: 16, marginTop: 4, border: '1px solid var(--foreground)', borderRadius: 8, background: 'var(--background)', color: 'var(--foreground)' };
const BTN = { padding: '14px 20px', minHeight: 48, fontSize: 17, width: '100%', marginTop: 16 };
const ERR = { color: '#a00', margin: '4px 0 12px' };
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
      else setMsg('Saved. Go back and open your checklist.');
    } catch { setMsg('Could not save. Please try again.'); }
  }
  return (
    <main className="profile-page">
      <h1>Your details</h1>
      <p>Type what is on your documents. Suri compares them to this.</p>
      <form onSubmit={save} noValidate>
        <label>Given name<input value={form.given_name} onChange={(e) => set('given_name', e.target.value)} style={INP} autoComplete="given-name" /></label>
        {errs.given_name && <p style={ERR}>{errs.given_name}</p>}
        <label>Middle name (optional)<input value={form.middle_name} onChange={(e) => set('middle_name', e.target.value)} style={INP} autoComplete="additional-name" /></label>
        {errs.middle_name && <p style={ERR}>{errs.middle_name}</p>}
        <label>Surname<input value={form.surname} onChange={(e) => set('surname', e.target.value)} style={INP} autoComplete="family-name" /></label>
        {errs.surname && <p style={ERR}>{errs.surname}</p>}
        <label>Suffix (Jr, Sr, II, III, IV, optional)<input value={form.suffix} onChange={(e) => set('suffix', e.target.value)} style={INP} /></label>
        {errs.suffix && <p style={ERR}>{errs.suffix}</p>}
        <div style={{ marginTop: 12 }}>
          <span>Birth date</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
            <label htmlFor="birth_month" style={{ flex: '1 1 110px' }}>Month
              <select id="birth_month" value={birthMonth} onChange={(e) => setBirthMonth(e.target.value)} style={INP}>
                <option value="">Month</option>
                {MONTHS.map(([v, label]) => (<option key={v} value={v}>{label}</option>))}
              </select>
            </label>
            <label htmlFor="birth_day" style={{ flex: '1 1 60px' }}>Day
              <input id="birth_day" type="text" inputMode="numeric" maxLength={2} placeholder="Day" value={birthDay} onChange={(e) => setBirthDay(e.target.value)} style={INP} />
            </label>
            <label htmlFor="birth_year" style={{ flex: '1 1 80px' }}>Year
              <input id="birth_year" type="text" inputMode="numeric" maxLength={4} placeholder="Year" value={birthYear} onChange={(e) => setBirthYear(e.target.value)} style={INP} />
            </label>
          </div>
        </div>
        {errs.birth_date && <p style={ERR}>{errs.birth_date}</p>}
        <label>City / municipality<input value={form.city_municipality} onChange={(e) => set('city_municipality', e.target.value)} style={INP} autoComplete="address-level2" /></label>
        {errs.city_municipality && <p style={ERR}>{errs.city_municipality}</p>}
        <button type="submit" style={BTN}>Save and continue</button>
      </form>
      {msg && <p>{msg}</p>}
    </main>
  );
}
