/**
 * Webhook handler for products/create, products/update, products/delete
 * Triggers feed regeneration when products change
 */

import type { ActionFunctionArgs } from "react-router";
import { authenticate, unauthenticated } from "../shopify.server";
import { generateFeed } from "../lib/feed-service.server";

export const action = async ({ request, context }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`[Webhook] Received ${topic} for ${shop}`);

  const db = context.cloudflare.env.DB;

  // Check if we have feed settings for this shop (i.e., the app is configured)
  const feedSettings = await db
    .prepare("SELECT shop FROM feed_settings WHERE shop = ?")
    .bind(shop)
    .first();

  if (!feedSettings) {
    console.log(
      `[Webhook] No feed settings for ${shop}, skipping regeneration`,
    );
    return new Response();
  }

  // Get an admin API client using the offline session token
  try {
    const { admin } = await unauthenticated.admin(shop);
    const ctx = context.cloudflare.ctx;

    // Use waitUntil to regenerate the feed in the background
    ctx.waitUntil(
      generateFeed(db, shop, admin).then((result) => {
        if (result.success) {
          console.log(
            `[Webhook] Feed regenerated for ${shop}: ${result.productCount} items`,
          );
        } else {
          console.error(
            `[Webhook] Feed regeneration failed for ${shop}: ${result.error}`,
          );
        }
      }),
    );
  } catch (error) {
    console.error(`[Webhook] Failed to get admin client for ${shop}:`, error);
  }

  return new Response();
};
