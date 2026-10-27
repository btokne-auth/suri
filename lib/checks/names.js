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
  if (!sa || !sb) return { result: 'mismatch', reason: 'One name is missing, please check.' };
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
  const wordCountA = splitA.core.length;
  const wordCountB = splitB.core.length;
  const minLen = Math.min(wordCountA, wordCountB);
  let firstDiff = -1;
  for (let i = 0; i < minLen; i++) {
    if (splitA.core[i] !== splitB.core[i]) { firstDiff = i; break; }
  }
  if (firstDiff < 0 && wordCountA !== wordCountB) {
    const longer = wordCountA > wordCountB ? splitA.core : splitB.core;
    const extra = longer.slice(minLen).join(' ');
    return { result: 'check', reason: 'One name has extra words "' + extra + '", please confirm.' };
  }
  if (firstDiff < 0) {
    return { result: 'mismatch', reason: 'Names are different, please check.' };
  }
  const showWord = (w) => {
    const t = String(w || '').slice(0, 30);
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
  };
  const lastA = wordCountA > 0 ? splitA.core[wordCountA - 1] : '';
  const lastB = wordCountB > 0 ? splitB.core[wordCountB - 1] : '';
  if (lastA !== lastB) {
    return { result: 'mismatch', reason: 'Surname is different: ' + edgeWord(sa, false) + ' vs ' + edgeWord(sb, false) + '.' };
  }
  return { result: 'mismatch', reason: 'Name word ' + (firstDiff + 1) + ' is different: ' + showWord(splitA.core[firstDiff]) + ' vs ' + showWord(splitB.core[firstDiff]) + '.' };
}
module.exports = { compareFilipinoNames, baseNormalize };
