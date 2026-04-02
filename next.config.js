/** @type {import('next').NextConfig} */
const nextConfig = {
    // Enable React strict mode for better development experience
    reactStrictMode: true,

    // Use SWC for faster minification (default in Next.js 13+)
    swcMinify: true,

    // Compiler options for better optimization
    compiler: {
        // Remove console logs in production
        removeConsole:
            process.env.NODE_ENV === 'production'
                ? {
                      exclude: ['error', 'warn'],
                  }
                : false,
    },

    // Image optimization configuration
    images: {
        remotePatterns: [
            { protocol: 'http', hostname: 'localhost' },
            { protocol: 'https', hostname: 'api.mirai-services.com' },
        ],
        formats: ['image/avif', 'image/webp'],
        minimumCacheTTL: 60,
    },

    // ESLint configuration
    eslint: {
        // Ignore during builds — lint separately
        ignoreDuringBuilds: true,
    },

    // TypeScript configuration
    typescript: {
        // Ignore during builds — type-check separately
        ignoreBuildErrors: true,
    },

    // Experimental features for Next.js 14
    experimental: {
        // Enable optimized package imports
        optimizePackageImports: ['@mantine/core', '@mantine/hooks', 'react-icons'],
    },

    // Output configuration for Docker
    output: 'standalone',

    // Disable powered-by header for security
    poweredByHeader: false,

    // Compression
    compress: true,

    // Proxy API calls through Next.js so they are same-origin.
    // This eliminates cross-site cookie issues on mobile browsers (Safari ITP, etc.)
    async rewrites() {
        // In Docker, use the internal backend URL; otherwise fall back to public URL
        const apiUrl = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
        return [
            {
                source: '/api-proxy/:path*',
                destination: `${apiUrl}/:path*`,
            },
            {
                source: '/api-uploads/:path*',
                destination: `${apiUrl}/uploads/:path*`,
            },
        ];
    },
};

module.exports = nextConfig;
