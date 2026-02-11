/**
 * OpenAI Commerce Product Feed Mapper
 * Maps Shopify product data to OpenAI's feed specification
 * Spec: https://developers.openai.com/commerce/specs/feed
 */

import type {
  ShopifyProduct,
  ShopifyVariant,
  ShopInfo,
} from "./shopify-products.server";

export interface FeedSettings {
  shop: string;
  enable_search: boolean;
  enable_checkout: boolean;
  seller_name: string | null;
  seller_url: string | null;
  privacy_policy_url: string | null;
  terms_of_service_url: string | null;
  return_policy_url: string | null;
  accepts_returns: boolean;
  return_deadline_days: number;
  accepts_exchanges: boolean;
  store_country: string;
  target_countries: string;
}

export interface OpenAIFeedItem {
  // OpenAI flags
  is_eligible_search: boolean;
  is_eligible_checkout: boolean;
  // Basic product data
  item_id: string;
  title: string;
  description: string;
  url: string;
  // Item info
  condition: string;
  product_category: string;
  brand: string;
  weight?: string;
  item_weight_unit?: string;
  // Media
  image_url: string;
  additional_image_urls?: string;
  // Price & Promotions
  price: string;
  sale_price?: string;
  // Availability & Inventory
  availability: "in_stock" | "out_of_stock" | "preorder";
  // Variants
  group_id: string;
  listing_has_variations: boolean;
  variant_dict?: string;
  item_group_title: string;
  color?: string;
  size?: string;
  offer_id?: string;
  // Merchant info
  seller_name: string;
  seller_url: string;
  seller_privacy_policy?: string;
  seller_tos?: string;
  // Returns
  accepts_returns?: boolean;
  return_deadline_in_days?: number;
  accepts_exchanges?: boolean;
  return_policy?: string;
  // Geo
  target_countries: string;
  store_country: string;
}

/**
 * Extract a numeric Shopify ID from a GID string
 * e.g., "gid://shopify/Product/123456" → "123456"
 */
function extractShopifyId(gid: string): string {
  const parts = gid.split("/");
  return parts[parts.length - 1];
}

/**
 * Determine product availability based on variant data
 */
function getAvailability(
  variant: ShopifyVariant,
): "in_stock" | "out_of_stock" | "preorder" {
  // If inventory policy is "continue" (sell when out of stock), treat as in_stock
  if (variant.inventoryPolicy === "CONTINUE") {
    return "in_stock";
  }

  if (variant.availableForSale) {
    return "in_stock";
  }

  if (
    variant.inventoryQuantity !== null &&
    variant.inventoryQuantity !== undefined &&
    variant.inventoryQuantity <= 0
  ) {
    return "out_of_stock";
  }

  return variant.availableForSale ? "in_stock" : "out_of_stock";
}

/**
 * Build the product URL from shop domain + handle
 */
function buildProductUrl(shopUrl: string, handle: string): string {
  const baseUrl = shopUrl.replace(/\/$/, "");
  return `${baseUrl}/products/${handle}`;
}

/**
 * Map Shopify weight unit to feed format
 */
function mapWeightUnit(unit: string): string {
  const unitMap: Record<string, string> = {
    KILOGRAMS: "kg",
    GRAMS: "g",
    POUNDS: "lb",
    OUNCES: "oz",
  };
  return unitMap[unit] || "lb";
}

/**
 * Build variant_dict object from variant options
 */
function buildVariantDict(
  variant: ShopifyVariant,
): Record<string, string> | undefined {
  if (
    !variant.selectedOptions ||
    variant.selectedOptions.length === 0 ||
    (variant.selectedOptions.length === 1 &&
      variant.selectedOptions[0].value === "Default Title")
  ) {
    return undefined;
  }

  const dict: Record<string, string> = {};
  for (const opt of variant.selectedOptions) {
    dict[opt.name.toLowerCase()] = opt.value;
  }
  return dict;
}

/**
 * Extract color from variant options
 */
function extractOption(
  variant: ShopifyVariant,
  optionName: string,
): string | undefined {
  const option = variant.selectedOptions.find(
    (o) => o.name.toLowerCase() === optionName.toLowerCase(),
  );
  if (option && option.value !== "Default Title") {
    return option.value;
  }
  return undefined;
}

/**
 * Strip HTML tags from description
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Map a single Shopify product + variant to an OpenAI feed item
 */
function mapVariantToFeedItem(
  product: ShopifyProduct,
  variant: ShopifyVariant,
  shopInfo: ShopInfo,
  settings: FeedSettings,
): OpenAIFeedItem | null {
  // Skip draft products
  if (product.status !== "ACTIVE") {
    return null;
  }

  const productId = extractShopifyId(product.id);
  const variantId = extractShopifyId(variant.id);
  const shopUrl =
    settings.seller_url || shopInfo.primaryDomain?.url || shopInfo.url;
  const cleanShopUrl = shopUrl.replace(/\/$/, "");

  // Build product URL
  const productUrl =
    product.onlineStoreUrl || buildProductUrl(cleanShopUrl, product.handle);

  // Get images - use variant image if available, otherwise product images
  const variantImage = variant.image?.url;
  const productImages = product.images.edges.map((e) => e.node.url);
  const mainImage = variantImage || productImages[0] || "";

  if (!mainImage) {
    return null; // Skip products without images
  }

  // Additional images (exclude the main one)
  const additionalImages = productImages.filter((url) => url !== mainImage);

  // Description - prefer plain text, fall back to stripped HTML
  const description =
    product.description || stripHtml(product.descriptionHtml) || product.title;

  // Currency
  const currency = shopInfo.currencyCode || "USD";

  // Determine if this product has real variants
  const hasVariations =
    product.variants.edges.length > 1 ||
    (variant.selectedOptions.length > 0 &&
      variant.selectedOptions[0]?.value !== "Default Title");

  // Build variant dict
  const variantDict = buildVariantDict(variant);

  // Build the feed item
  const item: OpenAIFeedItem = {
    // OpenAI flags
    is_eligible_search: settings.enable_search,
    is_eligible_checkout: settings.enable_checkout,

    // Basic product data
    item_id: variant.sku || `${productId}-${variantId}`,
    title: hasVariations
      ? `${product.title} - ${variant.title}`
      : product.title,
    description,
    url: productUrl,

    // Item info
    condition: "new",
    product_category: product.productType || "Uncategorized",
    brand: product.vendor || settings.seller_name || "",

    // Media
    image_url: mainImage,
    ...(additionalImages.length > 0 && {
      additional_image_urls: additionalImages.join(","),
    }),

    // Price & Promotions
    price: `${variant.price} ${currency}`,
    ...(variant.compareAtPrice &&
      parseFloat(variant.compareAtPrice) > parseFloat(variant.price) && {
        sale_price: `${variant.price} ${currency}`,
        price: `${variant.compareAtPrice} ${currency}`,
      }),

    // Availability
    availability: getAvailability(variant),

    // Variants
    group_id: productId,
    listing_has_variations: hasVariations,
    ...(variantDict && { variant_dict: JSON.stringify(variantDict) }),
    item_group_title: product.title,
    ...(extractOption(variant, "color") && {
      color: extractOption(variant, "color"),
    }),
    ...(extractOption(variant, "size") && {
      size: extractOption(variant, "size"),
    }),
    offer_id: variant.sku || `${productId}-${variantId}`,

    // Weight
    ...(variant.weight &&
      variant.weight > 0 && {
        weight: String(variant.weight),
        item_weight_unit: mapWeightUnit(variant.weightUnit),
      }),

    // Merchant info
    seller_name: settings.seller_name || shopInfo.name || "",
    seller_url: cleanShopUrl,
    ...(settings.privacy_policy_url && {
      seller_privacy_policy: settings.privacy_policy_url,
    }),
    ...(settings.terms_of_service_url && {
      seller_tos: settings.terms_of_service_url,
    }),

    // Returns
    ...(settings.return_policy_url && {
      accepts_returns: settings.accepts_returns,
      return_deadline_in_days: settings.return_deadline_days,
      accepts_exchanges: settings.accepts_exchanges,
      return_policy: settings.return_policy_url,
    }),

    // Geo
    target_countries: settings.target_countries || "US",
    store_country:
      settings.store_country || shopInfo.billingAddress?.countryCodeV2 || "US",
  };

  return item;
}

/**
 * Map all Shopify products to OpenAI feed items
 * Each variant becomes its own row in the feed
 */
export function mapProductsToFeed(
  products: ShopifyProduct[],
  shopInfo: ShopInfo,
  settings: FeedSettings,
): OpenAIFeedItem[] {
  const feedItems: OpenAIFeedItem[] = [];

  for (const product of products) {
    for (const variantEdge of product.variants.edges) {
      const item = mapVariantToFeedItem(
        product,
        variantEdge.node,
        shopInfo,
        settings,
      );
      if (item) {
        feedItems.push(item);
      }
    }
  }

  return feedItems;
}

/**
 * Convert feed items to JSONL format (one JSON object per line)
 */
export function feedItemsToJsonl(items: OpenAIFeedItem[]): string {
  return items.map((item) => JSON.stringify(item)).join("\n");
}
