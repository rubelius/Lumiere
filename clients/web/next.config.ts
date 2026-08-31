import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Sem isto o next/image rejeita as URLs do TMDB com 400, e foi por isso que
    // a base de código caiu em <img> cru — abrindo mão de resize, formato
    // moderno e lazy loading. É o único host remoto que a API devolve.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'image.tmdb.org',
        pathname: '/t/p/**',
      },
    ],
  },
};

export default nextConfig;
