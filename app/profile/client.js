// app/profile/client.js
// Step 6: profile form. Server is the real check; browser mirrors messages.
'use client';
import { useEffect, useState } from 'react';
const INP = { display: 'block', width: '100%', padding: 12, minHeight: 44, fontSize: 16, marginTop: 4 };
const BTN = { padding: '14px 20px', minHeight: 48, fontSize: 17, width: '100%', marginTop: 16 };
const ERR = { color: '#a00', margin: '4px 0 12px' };
export default function ProfileClient() {
  const [sub, setSub] = useState('');
  const [form, setForm] = useState({ given_name: '', middle_name: '', surname: '', suffix: '', birth_date: '', city_municipality: '' });
  const [errs, setErrs] = useState({});
  const [msg, setMsg] = useState('');
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      setSub(q.get('submission') || '');
    } catch { setSub(''); }
  }, []);
  function set(k, v) { setForm((p) => ({ ...p, [k]: v })); }
  async function save(e) {
    e.preventDefault();
    setErrs({});
    setMsg('Saving...');
    try {
      const r = await fetch('/api/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
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
    <main style={{ padding: 16, maxWidth: 560, margin: '0 auto', fontFamily: 'system-ui' }}>
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
        <label>Birth date<input type="date" value={form.birth_date} onChange={(e) => set('birth_date', e.target.value)} style={INP} /></label>
        {errs.birth_date && <p style={ERR}>{errs.birth_date}</p>}
        <label>City / municipality<input value={form.city_municipality} onChange={(e) => set('city_municipality', e.target.value)} style={INP} autoComplete="address-level2" /></label>
        {errs.city_municipality && <p style={ERR}>{errs.city_municipality}</p>}
        <button type="submit" style={BTN}>Save and continue</button>
      </form>
      {msg && <p>{msg}</p>}
    </main>
  );
}
