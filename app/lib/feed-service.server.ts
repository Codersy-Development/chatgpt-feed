/**
 * Feed Generation Service
 * Orchestrates fetching products, mapping to feed format, and caching
 */

import type { D1Database } from "@cloudflare/workers-types";
import {
  fetchAllProducts,
  fetchShopInfo,
  fetchShopPolicies,
} from "./shopify-products.server";
import {
  mapProductsToFeed,
  feedItemsToJsonl,
  type FeedSettings,
} from "./feed-mapper.server";

/**
 * Get or create feed settings for a shop
 */
export async function getFeedSettings(
  db: D1Database,
  shop: string,
): Promise<FeedSettings> {
  const row = await db
    .prepare("SELECT * FROM feed_settings WHERE shop = ?")
    .bind(shop)
    .first();

  if (row) {
    return {
      shop: row.shop as string,
      enable_search: Boolean(row.enable_search),
      enable_checkout: Boolean(row.enable_checkout),
      seller_name: row.seller_name as string | null,
      seller_url: row.seller_url as string | null,
      privacy_policy_url: row.privacy_policy_url as string | null,
      terms_of_service_url: row.terms_of_service_url as string | null,
      return_policy_url: row.return_policy_url as string | null,
      accepts_returns: Boolean(row.accepts_returns),
      return_deadline_days: (row.return_deadline_days as number) || 30,
      accepts_exchanges: Boolean(row.accepts_exchanges),
      store_country: (row.store_country as string) || "US",
      target_countries: (row.target_countries as string) || "US",
    };
  }

  // Create default settings
  await db
    .prepare(
      `INSERT INTO feed_settings (shop, enable_search, enable_checkout, store_country, target_countries)
       VALUES (?, 1, 0, 'US', 'US')`,
    )
    .bind(shop)
    .run();

  return {
    shop,
    enable_search: true,
    enable_checkout: false,
    seller_name: null,
    seller_url: null,
    privacy_policy_url: null,
    terms_of_service_url: null,
    return_policy_url: null,
    accepts_returns: true,
    return_deadline_days: 30,
    accepts_exchanges: true,
    store_country: "US",
    target_countries: "US",
  };
}

/**
 * Update feed settings for a shop
 */
export async function updateFeedSettings(
  db: D1Database,
  shop: string,
  updates: Partial<FeedSettings>,
): Promise<void> {
  // Ensure row exists
  await getFeedSettings(db, shop);

  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.enable_search !== undefined) {
    fields.push("enable_search = ?");
    values.push(updates.enable_search ? 1 : 0);
  }
  if (updates.enable_checkout !== undefined) {
    fields.push("enable_checkout = ?");
    values.push(updates.enable_checkout ? 1 : 0);
  }
  if (updates.seller_name !== undefined) {
    fields.push("seller_name = ?");
    values.push(updates.seller_name);
  }
  if (updates.seller_url !== undefined) {
    fields.push("seller_url = ?");
    values.push(updates.seller_url);
  }
  if (updates.privacy_policy_url !== undefined) {
    fields.push("privacy_policy_url = ?");
    values.push(updates.privacy_policy_url);
  }
  if (updates.terms_of_service_url !== undefined) {
    fields.push("terms_of_service_url = ?");
    values.push(updates.terms_of_service_url);
  }
  if (updates.return_policy_url !== undefined) {
    fields.push("return_policy_url = ?");
    values.push(updates.return_policy_url);
  }
  if (updates.accepts_returns !== undefined) {
    fields.push("accepts_returns = ?");
    values.push(updates.accepts_returns ? 1 : 0);
  }
  if (updates.return_deadline_days !== undefined) {
    fields.push("return_deadline_days = ?");
    values.push(updates.return_deadline_days);
  }
  if (updates.accepts_exchanges !== undefined) {
    fields.push("accepts_exchanges = ?");
    values.push(updates.accepts_exchanges ? 1 : 0);
  }
  if (updates.store_country !== undefined) {
    fields.push("store_country = ?");
    values.push(updates.store_country);
  }
  if (updates.target_countries !== undefined) {
    fields.push("target_countries = ?");
    values.push(updates.target_countries);
  }

  if (fields.length === 0) return;

  fields.push("updated_at = ?");
  values.push(Date.now());
  values.push(shop);

  await db
    .prepare(`UPDATE feed_settings SET ${fields.join(", ")} WHERE shop = ?`)
    .bind(...values)
    .run();
}

/**
 * Auto-populate feed settings from Shopify shop data
 * Called on first install or when merchant clicks "sync from Shopify"
 */
export async function autoPopulateSettings(
  db: D1Database,
  shop: string,
  admin: any,
): Promise<FeedSettings> {
  const [shopInfo, policies] = await Promise.all([
    fetchShopInfo(admin),
    fetchShopPolicies(admin),
  ]);

  const shopUrl =
    shopInfo.primaryDomain?.url || shopInfo.url || `https://${shop}`;

  const updates: Partial<FeedSettings> = {
    seller_name: shopInfo.name,
    seller_url: shopUrl.replace(/\/$/, ""),
    store_country: shopInfo.billingAddress?.countryCodeV2 || "US",
    target_countries: shopInfo.shipsToCountries?.join(",") || "US",
  };

  if (policies.privacyPolicy?.url) {
    updates.privacy_policy_url = policies.privacyPolicy.url;
  }
  if (policies.termsOfService?.url) {
    updates.terms_of_service_url = policies.termsOfService.url;
  }
  if (policies.refundPolicy?.url) {
    updates.return_policy_url = policies.refundPolicy.url;
  }

  await updateFeedSettings(db, shop, updates);
  return getFeedSettings(db, shop);
}

/**
 * Generate the feed for a shop and cache it
 */
export async function generateFeed(
  db: D1Database,
  shop: string,
  admin: any,
): Promise<{ success: boolean; productCount: number; error?: string }> {
  try {
    console.log(`[Feed] Starting feed generation for ${shop}`);

    // Fetch shop info and settings in parallel
    const [shopInfo, settings] = await Promise.all([
      fetchShopInfo(admin),
      getFeedSettings(db, shop),
    ]);

    // Fetch all products
    const products = await fetchAllProducts(admin);
    console.log(`[Feed] Fetched ${products.length} products for ${shop}`);

    // Map to feed format
    const feedItems = mapProductsToFeed(products, shopInfo, settings);
    console.log(`[Feed] Mapped ${feedItems.length} feed items for ${shop}`);

    // Convert to JSONL
    const jsonl = feedItemsToJsonl(feedItems);
    const now = Date.now();

    // Store in cache
    await db
      .prepare(
        `INSERT OR REPLACE INTO feed_cache (shop, feed_data, product_count, generated_at)
         VALUES (?, ?, ?, ?)`,
      )
      .bind(shop, jsonl, feedItems.length, now)
      .run();

    // Update settings with generation timestamp
    await db
      .prepare(
        `UPDATE feed_settings SET feed_generated_at = ?, product_count = ?, updated_at = ? WHERE shop = ?`,
      )
      .bind(now, feedItems.length, now, shop)
      .run();

    console.log(
      `[Feed] Feed generation complete for ${shop}: ${feedItems.length} items`,
    );

    return { success: true, productCount: feedItems.length };
  } catch (error) {
    console.error(`[Feed] Feed generation failed for ${shop}:`, error);
    return {
      success: false,
      productCount: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get cached feed data for a shop
 */
export async function getCachedFeed(
  db: D1Database,
  shop: string,
): Promise<{
  feedData: string;
  productCount: number;
  generatedAt: number;
} | null> {
  const row = await db
    .prepare(
      "SELECT feed_data, product_count, generated_at FROM feed_cache WHERE shop = ?",
    )
    .bind(shop)
    .first();

  if (!row || !row.feed_data) return null;

  return {
    feedData: row.feed_data as string,
    productCount: row.product_count as number,
    generatedAt: row.generated_at as number,
  };
}

/**
 * Delete all feed data for a shop (on uninstall)
 */
export async function deleteFeedData(
  db: D1Database,
  shop: string,
): Promise<void> {
  await Promise.all([
    db.prepare("DELETE FROM feed_settings WHERE shop = ?").bind(shop).run(),
    db.prepare("DELETE FROM feed_cache WHERE shop = ?").bind(shop).run(),
  ]);
}
