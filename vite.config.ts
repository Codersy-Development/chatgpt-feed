import { reactRouter } from "@react-router/dev/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig, type UserConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// Related: https://github.com/remix-run/remix/issues/2835#issuecomment-1144102176
// Replace the HOST env var with SHOPIFY_APP_URL so that it doesn't break the Vite server.
// The CLI will eventually stop passing in HOST,
// so we can remove this workaround after the next major release.
if (
  process.env.HOST &&
  (!process.env.SHOPIFY_APP_URL ||
    process.env.SHOPIFY_APP_URL === process.env.HOST)
) {
  process.env.SHOPIFY_APP_URL = process.env.HOST;
  delete process.env.HOST;
}

const host = new URL(process.env.SHOPIFY_APP_URL || "http://localhost")
  .hostname;

let hmrConfig;
if (host === "localhost") {
  hmrConfig = {
    protocol: "ws",
    host: "localhost",
    port: 64999,
    clientPort: 64999,
  };
} else {
  hmrConfig = {
    protocol: "wss",
    host: host,
    port: parseInt(process.env.FRONTEND_PORT!) || 8002,
    clientPort: 443,
  };
}

export default defineConfig({
  server: {
    allowedHosts: [host],
    cors: {
      preflightContinue: true,
    },
    port: Number(process.env.PORT || 3000),
    hmr: hmrConfig,
    fs: {
      // See https://vitejs.dev/config/server-options.html#server-fs-allow for more information
      allow: ["app", "node_modules"],
    },
  },
  plugins: [
    cloudflare({
      viteEnvironment: { name: "ssr" },
      persistState: { path: ".wrangler/state" },
      config: (config) => {
        // Inject Shopify CLI environment variables into wrangler vars
        // so they're available via context.cloudflare.env in the workerd runtime
        config.vars ??= {};
        config.vars.SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY ?? "";
        config.vars.SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET ?? "";
        config.vars.SHOPIFY_APP_URL = process.env.SHOPIFY_APP_URL ?? "";
        config.vars.SCOPES = process.env.SCOPES ?? "";
        config.vars.SHOP_CUSTOM_DOMAIN = process.env.SHOP_CUSTOM_DOMAIN ?? "";
      },
    }),
    reactRouter(),
    tsconfigPaths(),
  ],
  build: {
    assetsInlineLimit: 0,
  },
  optimizeDeps: {
    include: ["@shopify/app-bridge-react"],
  },
}) satisfies UserConfig;
