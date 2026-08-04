/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  // firebase-admin (vía google-auth-library/gaxios) usa módulos nativos de Node
  // (node:https, node:net, etc.) que webpack no puede empaquetar para el bundle
  // de servidor. Lo dejamos como dependencia externa para que se resuelva con
  // require() normal en tiempo de ejecución, como cualquier paquete de Node.
  experimental: {
    serverComponentsExternalPackages: ["firebase-admin"],
  },
};

module.exports = nextConfig;
