// lib/checks/names.js
// Step 6A: Filipino name rule (filipino_name).
// Code makes every comparison, never the model.
// { result: 'match' | 'check' | 'mismatch', reason }.
// match: same after case/space/period/comma-order ("Dela Cruz, Maria"
// = "Maria Dela Cruz"; "de la Cruz" = "dela Cruz").
// check: probably same (Ma.=Maria, Sto.=Santo, Sta.=Santa,
// missing Jr./Sr./II/III/IV, accent-only pairs need confirmation).
// mismatch: word-by-word difference, plain reason.

const SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv']);

function stripAccents(s) {
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function reorderComma(raw) {
  const s = String(raw || '');
  if (s.indexOf(',') < 0) return s;
  const parts = s.split(',').map((p) => p.trim()).filter((p) => p !== '');
  if (parts.length < 2) return parts.join(' ');
  return (parts.slice(1).join(' ') + ' ' + parts[0]).trim();
}

function normalizeKeepAccents(raw) {
  return String(reorderComma(raw) || '').toLowerCase().replace(/[\u2018\u2019]/g, "'")
    .replace(/\./g, '').replace(/,/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/\bde\s+la\b/g, 'dela');
}

function baseNormalize(raw) {
  return stripAccents(normalizeKeepAccents(raw));
}

function tokensKeep(raw) {
  const b = normalizeKeepAccents(raw);
  return b ? b.split(' ').filter(Boolean) : [];
}

function tokensOf(raw) {
  const b = baseNormalize(raw);
  return b ? b.split(' ').filter(Boolean) : [];
}

function splitSuffix(toks) {
  const copy = toks.slice();
  let suffix = null;
  if (copy.length > 1 && SUFFIXES.has(copy[copy.length - 1])) suffix = copy.pop();
  return { core: copy, suffix };
}

function expandTokens(toks) {
  return toks.map((t) => {
    if (t === 'ma') return 'maria';
    if (t === 'sto') return 'santo';
    if (t === 'sta') return 'santa';
    return t;
  });
}

function sameAfterSpacing(a, b) {
  return String(a || '').replace(/\s+/g, '') === String(b || '').replace(/\s+/g, '');
}

function edgeWord(raw, first) {
  const parts = String(reorderComma(raw) || '').replace(/,/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  const w = first ? parts[0] : parts[parts.length - 1];
  return w.replace(/\./g, '').slice(0, 30) || '';
}

function suffixLabel(s) {
  if (s === 'jr') return 'Jr.';
  if (s === 'sr') return 'Sr.';
  return String(s || '').toUpperCase();
}
function compareFilipinoNames(a, b) {
  const sa = String(a == null ? '' : a).trim();
  const sb = String(b == null ? '' : b).trim();
  if (!sa || !sb) return { result: 'mismatch', reason: 'One name is missing, pleasecheck.' };
  const keepA = normalizeKeepAccents(sa);
  const keepB = normalizeKeepAccents(sb);
  if (!keepA || !keepB) return { result: 'mismatch', reason: 'One name is missing, please check.' };
  const baseA = baseNormalize(sa);
  const baseB = baseNormalize(sb);
  if (baseA === baseB || sameAfterSpacing(baseA, baseB)) {
    if (keepA === keepB || sameAfterSpacing(keepA, keepB)) {
      return { result: 'match', reason: 'Names match.' };
    }
    return { result: 'check', reason: 'Names differ only in accents, please confirm.' };
  }
  const toksA = tokensOf(sa);
  const toksB = tokensOf(sb);
  const splitA = splitSuffix(toksA);
  const splitB = splitSuffix(toksB);
  const coreA = splitA.core.join(' ');
  const coreB = splitB.core.join(' ');
  if (coreA === coreB || sameAfterSpacing(coreA, coreB)) {
    if (!splitA.suffix && splitB.suffix) {
      return { result: 'check', reason: 'One has ' + suffixLabel(splitB.suffix) + ', the other does not, please confirm.' };
    }
    if (splitA.suffix && !splitB.suffix) {
      return { result: 'check', reason: 'One has ' + suffixLabel(splitA.suffix) + ', the other does not, please confirm.' };
    }
    if (splitA.suffix !== splitB.suffix) {
      return { result: 'mismatch', reason: 'Suffix is different: ' + suffixLabel(splitA.suffix) + ' vs ' + suffixLabel(splitB.suffix) + '.' };
    }
  }
  const expA = expandTokens(toksA).join(' ');
  const expB = expandTokens(toksB).join(' ');
  if (expA === expB || sameAfterSpacing(expA, expB)) {
    const joined = ' ' + toksA.join(' ') + ' | ' + toksB.join(' ') + ' ';
    const hasMa = joined.indexOf(' ma ') >= 0 || joined.indexOf(' maria ') >= 0;
    const noSto = joined.indexOf(' sto ') < 0 && joined.indexOf(' santo ') < 0;
    const noSta = joined.indexOf(' sta ') < 0 && joined.indexOf(' santa ') < 0;
    if (hasMa && noSto && noSta) return { result: 'check', reason: 'Ma. is short for Maria, please confirm.' };
    if (joined.indexOf(' sto ') >= 0 || joined.indexOf(' santo ') >= 0) return { result: 'check', reason: 'Sto. is short for Santo, please confirm.' };
    if (joined.indexOf(' sta ') >= 0 || joined.indexOf(' santa ') >= 0) return { result: 'check', reason: 'Sta. is short for Santa, please confirm.' };
    return { result: 'check', reason: 'Short form looks like the same name, please confirm.' };
  }
  // Step 10 fix: compare word by word AFTER expanding short forms
  // (Ma. -> Maria, Sto. -> Santo, Sta. -> Santa), so one short form never
  // hides another difference. Small spelling differences (one letter) and a
  // missing middle word become "check" (Suri asks); clearly different words
  // stay "mismatch". The reason always names the real difference.
  const rawA = splitA.core;
  const rawB = splitB.core;
  const xA = expandTokens(rawA);
  const xB = expandTokens(rawB);
  const notes = [];
  if (rawA.join(' ') !== xA.join(' ') || rawB.join(' ') !== xB.join(' ')) {
    notes.push(shortFormNote(rawA.concat(rawB)));
  }
  if (xA.length !== xB.length) {
    const aLong = xA.length > xB.length;
    const whole = extraWords(aLong ? xA : xB, aLong ? xB : xA);
    if (whole) {
      const longRawAll = aLong ? rawA : rawB;
      notes.push(...whole.typos);
      const words = whole.indexes.map(function (k) { return showWord(longRawAll[k]); }).join(' ');
      notes.push('one name has extra words "' + words + '"');
      const t = notes.join('; ');
      return { result: 'check', reason: t.charAt(0).toUpperCase() + t.slice(1) + ', please confirm.' };
    }
  }
  const surA = xA.length ? xA[xA.length - 1] : '';
  const surB = xB.length ? xB[xB.length - 1] : '';
  if (surA !== surB) {
    if (isSmallSpellingDiff(surA, surB)) {
      notes.push('surname spelled differently: ' + edgeWord(sa, false) + ' vs ' + edgeWord(sb, false));
    } else {
      return { result: 'mismatch', reason: 'Surname is different: ' + edgeWord(sa, false) + ' vs ' + edgeWord(sb, false) + '.' };
    }
  }
  const restA = xA.slice(0, -1);
  const restB = xB.slice(0, -1);
  const rawRestA = rawA.slice(0, -1);
  const rawRestB = rawB.slice(0, -1);
  if (restA.length === restB.length) {
    for (let i = 0; i < restA.length; i++) {
      if (restA[i] === restB[i]) continue;
      if (isSmallSpellingDiff(restA[i], restB[i])) {
        notes.push('"' + showWord(rawRestA[i]) + '" vs "' + showWord(rawRestB[i]) + '" looks like a spelling difference');
      } else {
        return { result: 'mismatch', reason: 'Name word ' + (i + 1) + ' is different: ' + showWord(rawRestA[i]) + ' vs ' + showWord(rawRestB[i]) + '.' };
      }
    }
  } else {
    const aLonger = restA.length > restB.length;
    const longX = aLonger ? restA : restB;
    const shortX = aLonger ? restB : restA;
    const longRaw = aLonger ? rawRestA : rawRestB;
    const extra = extraWords(longX, shortX);
    if (!extra) {
      const rawShort = aLonger ? rawRestB : rawRestA;
      for (let i = 0; i < shortX.length; i++) {
        if (longX[i] !== shortX[i]) {
          const wA = aLonger ? longRaw[i] : rawShort[i];
          const wB = aLonger ? rawShort[i] : longRaw[i];
          return { result: 'mismatch', reason: 'Name word ' + (i + 1) + ' is different: ' + showWord(wA) + ' vs ' + showWord(wB) + '.' };
        }
      }
      return { result: 'mismatch', reason: 'Names are different, please check.' };
    }
    notes.push(...extra.typos);
    const extraText = extra.indexes.map(function (k) { return showWord(longRaw[k]); }).join(' ');
    notes.push('one name has extra words "' + extraText + '"');
  }
  if (notes.length === 0) {
    return { result: 'mismatch', reason: 'Names are different, please check.' };
  }
  const text = notes.join('; ');
  return { result: 'check', reason: text.charAt(0).toUpperCase() + text.slice(1) + ', please confirm.' };
}

function showWord(w) {
  const t = String(w || '').slice(0, 30);
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
}

function shortFormNote(toks) {
  if (toks.indexOf('ma') >= 0) return 'Ma. is short for Maria';
  if (toks.indexOf('sto') >= 0) return 'Sto. is short for Santo';
  if (toks.indexOf('sta') >= 0) return 'Sta. is short for Santa';
  return 'short form looks like the same name';
}

// A typical typo on words of 4+ letters: one letter missing or doubled
// (Theresa/Theressa, Reyes/Reys) or two neighbours swapped (Reyes/Ryees).
// A changed letter is NOT forgiven: Maria/Marta and Maria/Mario are
// different names. Short words must match exactly.
function isSmallSpellingDiff(a, b) {
  a = String(a || ''); b = String(b || '');
  if (a === b) return false;
  if (a.length < 4 || b.length < 4) return false;
  if (a.length === b.length) {
    let i = 0;
    while (i < a.length && a[i] === b[i]) i++;
    return i < a.length - 1 && a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2);
  }
  if (Math.abs(a.length - b.length) !== 1) return false;
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  for (let i = 0; i < longer.length; i++) {
    if (longer.slice(0, i) + longer.slice(i + 1) === shorter) return true;
  }
  return false;
}

// The shorter list must appear in order inside the longer one (exact or small
// spelling difference). Returns the leftover indexes in the longer list, or
// null when the names don't line up.
function extraWords(longer, shorter) {
  const indexes = [];
  const typos = [];
  let j = 0;
  for (let i = 0; i < longer.length; i++) {
    if (j < shorter.length && (longer[i] === shorter[j] || isSmallSpellingDiff(longer[i], shorter[j]))) {
      if (longer[i] !== shorter[j]) typos.push('"' + showWord(longer[i]) + '" vs "' + showWord(shorter[j]) + '" looks like a spelling difference');
      j++;
    } else {
      indexes.push(i);
    }
  }
  if (j < shorter.length || indexes.length === 0) return null;
  return { indexes: indexes, typos: typos };
}

module.exports = { compareFilipinoNames, baseNormalize, isSmallSpellingDiff };
