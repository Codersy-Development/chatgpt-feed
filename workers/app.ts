import { createRequestHandler } from "react-router";
import { setupShopify } from "../app/shopify.server";

declare module "react-router" {
  export interface AppLoadContext {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
  }
}

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  async fetch(request, env, ctx) {
    try {
      // Initialize Shopify app with Cloudflare env (DB, secrets, etc.)
      setupShopify(env);

      return await requestHandler(request, {
        cloudflare: { env, ctx },
      });
    } catch (error) {
      console.log(error);
      return new Response("An unexpected error occurred", { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;
