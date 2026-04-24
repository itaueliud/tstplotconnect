/** @type {import('next').NextConfig} */
const backendBase =
  process.env.API_BASE_URL
  || process.env.PLOTCONNECT_API_BASE
  || process.env.NEXT_PUBLIC_API_URL
  || "https://tstplotconnect-2.onrender.com";

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendBase.replace(/\/+$/, "")}/api/:path*`
      }
    ];
  },
  async redirects() {
    return [
      {
        source: "/admin.html",
        destination: "/admin",
        permanent: true
      },
      {
        source: "/superadmin.html",
        destination: "/superadmin",
        permanent: true
      }
    ];
  }
};

export default nextConfig;
