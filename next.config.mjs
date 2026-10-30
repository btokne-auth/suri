import cspModule from './lib/csp.js';

const buildCsp = cspModule.buildCsp || cspModule.default?.buildCsp;
const getSupabaseOrigin = cspModule.getSupabaseOrigin || cspModule.default?.getSupabaseOrigin;
const getSecurityHeaders = cspModule.getSecurityHeaders || cspModule.default?.getSecurityHeaders;

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  ...(process.env.NODE_ENV === 'development' ? { allowedDevOrigins: ['192.168.1.6'] } : {}),
  async headers() {
    const isProd = process.env.NODE_ENV === 'production';
    let supabaseOrigin = '';
    try {
      const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (envUrl) supabaseOrigin = new URL(envUrl).origin;
      else if (typeof getSupabaseOrigin === 'function') supabaseOrigin = getSupabaseOrigin();
    } catch {}
    if (!supabaseOrigin && typeof getSupabaseOrigin === 'function') {
      try {
        supabaseOrigin = getSupabaseOrigin();
      } catch {}
    }
    let headers;
    if (typeof getSecurityHeaders === 'function') {
      headers = getSecurityHeaders({ isProduction: isProd, supabaseOrigin });
    } else {
      const csp = typeof buildCsp === 'function' ? buildCsp(supabaseOrigin) : '';
      headers = [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Permissions-Policy', value: 'camera=(self)' },
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
      ];
      if (isProd) headers.unshift({ key: 'Content-Security-Policy', value: csp });
    }
    return [{ source: '/(.*)', headers }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
