function getSupabaseOrigin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  if (!url) return '';
  try {
    const u = new URL(url);
    return u.origin;
  } catch {
    return '';
  }
}

function buildCsp(supabaseOrigin) {
  const origin = (typeof supabaseOrigin === 'string' && supabaseOrigin ? supabaseOrigin.trim() : '') || getSupabaseOrigin() || '';
  const connectParts = ["'self'"];
  const imgParts = ["'self'", 'data:', 'blob:'];
  if (origin) {
    connectParts.push(origin);
    imgParts.push(origin);
  }
  connectParts.push('https://*.supabase.co');
  imgParts.push('https://*.supabase.co');

  const directives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    'connect-src ' + connectParts.join(' '),
    'img-src ' + imgParts.join(' '),
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ];
  return directives.join('; ');
}

function getSecurityHeaders(opts) {
  const o = opts || {};
  const isProduction = !!o.isProduction;
  const supabaseOrigin = typeof o.supabaseOrigin === 'string' ? o.supabaseOrigin : '';
  const headers = [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Permissions-Policy', value: 'camera=(self)' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  ];
  if (isProduction) {
    const csp = buildCsp(supabaseOrigin);
    headers.unshift({ key: 'Content-Security-Policy', value: csp });
  }
  return headers;
}

module.exports = {
  buildCsp: buildCsp,
  getSupabaseOrigin: getSupabaseOrigin,
  getSecurityHeaders: getSecurityHeaders,
};
