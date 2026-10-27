/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Dev-only: let the phone reach `npm run dev -- --hostname 0.0.0.0`.
  // Next blocks dev JS for other hostnames unless listed here.
  // If the laptop IP changes, update this line to the new IP.
  allowedDevOrigins: ["192.168.1.6"],
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
