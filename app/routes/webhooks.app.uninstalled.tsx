import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { deleteFeedData } from "../lib/feed-service.server";

export const action = async ({ request, context }: ActionFunctionArgs) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  // If this webhook already ran, the session may have been deleted previously.
  if (session) {
    const db = context.cloudflare.env.DB;
    if (db) {
      // Delete sessions
      await db.prepare("DELETE FROM sessions WHERE shop = ?").bind(shop).run();
      console.log(`Deleted sessions for ${shop}`);

      // Delete feed data (settings + cache)
      await deleteFeedData(db, shop);
      console.log(`Deleted feed data for ${shop}`);
    }
  }

  return new Response();
};
