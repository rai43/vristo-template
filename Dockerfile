# ==============================================
# Multi-stage Dockerfile for Next.js 14 + TypeScript
# Optimized for production deployment
# Node LTS version: 18
# ==============================================

# Stage 1: Dependencies
# Install all dependencies (including devDependencies)
FROM node:18-alpine AS deps

# Install libc6-compat for compatibility with some native dependencies
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install --legacy-peer-deps --no-audit --no-fund

# Copy config files needed for dev mode (path aliases, Next.js config, etc.)
COPY tsconfig.json next.config.js tailwind.config.js postcss.config.js ./
COPY next-env.d.ts i18n.ts ni18n.config.ts.js theme.config.tsx ./

# ==============================================
# Stage 2: Builder
# Build the Next.js application
FROM node:18-alpine AS builder

WORKDIR /app

# Accept build-time API URL (baked into Next.js at build time)
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy all source files
COPY . .

# Set environment to production for build optimizations
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build the application
# Next.js will create a standalone output at .next/standalone
RUN npm run build

# ==============================================
# Stage 3: Runner
# Production runtime environment
FROM node:18-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Install sharp for Next.js image optimization in standalone mode
RUN npm install --os=linux --cpu=x64 --no-save sharp

# Copy public assets
COPY --from=builder /app/public ./public

# Copy standalone output (includes minimal dependencies)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Switch to non-root user
USER nextjs

# Expose the application port
EXPOSE 3000

# Set hostname to listen on all interfaces
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000', (r) => {process.exit(r.statusCode < 500 ? 0 : 1)}).on('error', () => process.exit(1))" || exit 1

# Start the application
CMD ["node", "server.js"]

