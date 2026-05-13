/** @type {import('next').NextConfig} */
const backendBase =
  process.env.API_BASE_URL
  || process.env.PLOTCONNECT_API_BASE
  || process.env.NEXT_PUBLIC_API_URL
  || "https://tstplotconnect-tvn3.onrender.com";

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
      },
      {
        source: "/contacts",
        destination: "/contact",
        permanent: true
      },
      {
        source: "/contact.html",
        destination: "/contact",
        permanent: true
      },
      {
        source: "/about.html",
        destination: "/about",
        permanent: true
      },
      {
        source: "/mombasa-hostels",
        destination: "/main/kenya/mombasa",
        permanent: true
      },
      {
        source: "/thika-hostels",
        destination: "/main/kenya/kiambu",
        permanent: true
      },
      {
        source: "/nairobi-hostels",
        destination: "/main/kenya/nairobi",
        permanent: true
      },
      {
        source: "/machakos-hostels",
        destination: "/main/kenya/machakos",
        permanent: true
      },
      {
        source: "/kiambu-hostels",
        destination: "/main/kenya/kiambu",
        permanent: true
      },
      {
        source: "/kitui-hostels",
        destination: "/main/kenya/kitui",
        permanent: true
      },
      {
        source: "/embu-hostels",
        destination: "/main/kenya/embu",
        permanent: true
      },
      {
        source: "/makueni-hostels",
        destination: "/main/kenya/makueni",
        permanent: true
      },
      {
        source: "/kajiado-hostels",
        destination: "/main/kenya/kajiado",
        permanent: true
      },
      {
        source: "/uasin-gishu-hostels",
        destination: "/main/kenya/uasin-gishu",
        permanent: true
      }
    ];
  }
};

export default nextConfig;
