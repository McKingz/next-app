import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Performance optimizations
  reactStrictMode: true,
  
  // Optimize production builds
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  
  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  
  // Optimize bundle
  experimental: {
    optimizePackageImports: ['lucide-react', 'react-icons', '@supabase/supabase-js'],
  },
  
  // Headers for Google Sign-In popups and asset indexing controls
  async headers() {
    return [
      {
        // Allow Google Sign-In popups to communicate with parent window
        source: '/:path*',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'unsafe-none' },
          // Cache static assets aggressively
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // Prevent indexing of app manifest and icons without using deprecated middleware
      { source: '/manifest.webmanifest', headers: [{ key: 'X-Robots-Tag', value: 'none' }] },
      { source: '/manifest.json', headers: [{ key: 'X-Robots-Tag', value: 'none' }] },
      { source: '/sw.js', headers: [{ key: 'X-Robots-Tag', value: 'none' }] },
      { source: '/api/manifest', headers: [{ key: 'X-Robots-Tag', value: 'none' }] },
      // Static assets cache
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

export default nextConfig;
