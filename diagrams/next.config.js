/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  output: "standalone",
  reactStrictMode: false,
  async rewrites() {
    return {
      // PostHog analytics rewrites (matched before filesystem)
      beforeFiles: [
        {
          source: "/ingest/static/:path*",
          destination: "https://us-assets.i.posthog.com/static/:path*",
        },
        {
          source: "/ingest/:path*",
          destination: "https://us.i.posthog.com/:path*",
        },
        {
          source: "/ingest/decide",
          destination: "https://us.i.posthog.com/decide",
        },
      ],
      // Proxy /api/* to GitUnderstand backend
      afterFiles: [
        {
          source: "/api/:path*",
          destination: `${process.env.GITUNDERSTAND_API_URL ?? "http://localhost:8080"}/api/:path*`,
        },
      ],
      // Fallback: any route not handled by Next.js → existing GitUnderstand FastAPI
      fallback: [
        {
          source: "/:path*",
          destination: `${process.env.GITUNDERSTAND_API_URL ?? "http://localhost:8080"}/:path*`,
        },
      ],
    };
  },
  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
};

export default config;
