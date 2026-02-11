/**
 * Shopify GraphQL product fetcher
 * Fetches all products with variants, images, and inventory data
 */

// GraphQL query to fetch products with all needed data for the feed
const PRODUCTS_QUERY = `#graphql
  query GetProducts($cursor: String) {
    products(first: 50, after: $cursor, sortKey: UPDATED_AT) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          title
          descriptionHtml
          description
          handle
          vendor
          productType
          tags
          status
          createdAt
          updatedAt
          onlineStoreUrl
          options {
            name
            values
          }
          images(first: 10) {
            edges {
              node {
                url
                altText
              }
            }
          }
          variants(first: 100) {
            edges {
              node {
                id
                title
                sku
                barcode
                price
                compareAtPrice
                availableForSale
                inventoryQuantity
                inventoryPolicy
                weight
                weightUnit
                selectedOptions {
                  name
                  value
                }
                image {
                  url
                  altText
                }
              }
            }
          }
        }
      }
    }
  }
`;

const SHOP_QUERY = `#graphql
  query GetShop {
    shop {
      name
      url
      primaryDomain {
        url
      }
      currencyCode
      billingAddress {
        country
        countryCodeV2
      }
      shipsToCountries
    }
  }
`;

// Shop policies query removed - policies are no longer available in Shopify API 2026-04
// Users can manually enter policy URLs in the settings page

export interface ShopifyProduct {
  id: string;
  title: string;
  descriptionHtml: string;
  description: string;
  handle: string;
  vendor: string;
  productType: string;
  tags: string[];
  status: string;
  createdAt: string;
  updatedAt: string;
  onlineStoreUrl: string | null;
  options: Array<{ name: string; values: string[] }>;
  images: {
    edges: Array<{
      node: { url: string; altText: string | null };
    }>;
  };
  variants: {
    edges: Array<{
      node: ShopifyVariant;
    }>;
  };
}

export interface ShopifyVariant {
  id: string;
  title: string;
  sku: string | null;
  barcode: string | null;
  price: string;
  compareAtPrice: string | null;
  availableForSale: boolean;
  inventoryQuantity: number | null;
  inventoryPolicy: string;
  weight: number | null;
  weightUnit: string;
  selectedOptions: Array<{ name: string; value: string }>;
  image: { url: string; altText: string | null } | null;
}

export interface ShopInfo {
  name: string;
  url: string;
  primaryDomain: { url: string };
  currencyCode: string;
  billingAddress: {
    country: string;
    countryCodeV2: string;
  };
  shipsToCountries: string[];
}

export interface ShopPolicies {
  privacyPolicy: { url: string } | null;
  termsOfService: { url: string } | null;
  refundPolicy: { url: string } | null;
}

/**
 * Fetch all products from Shopify using cursor-based pagination
 */
export async function fetchAllProducts(admin: any): Promise<ShopifyProduct[]> {
  const allProducts: ShopifyProduct[] = [];
  let cursor: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const response: any = await admin.graphql(PRODUCTS_QUERY, {
      variables: { cursor },
    });

    const json: any = await response.json();
    const data: any = json.data;

    if (!data?.products) {
      console.error("Failed to fetch products:", json.errors);
      break;
    }

    const products = data.products.edges.map(
      (edge: { node: ShopifyProduct }) => edge.node,
    );
    allProducts.push(...products);

    hasNextPage = data.products.pageInfo.hasNextPage;
    cursor = data.products.pageInfo.endCursor;
  }

  return allProducts;
}

/**
 * Fetch shop info from Shopify
 */
export async function fetchShopInfo(admin: any): Promise<ShopInfo> {
  const response = await admin.graphql(SHOP_QUERY);
  const json = await response.json();
  return json.data.shop;
}

/**
 * Fetch shop policies from Shopify
 * Note: Policy fields removed from Shopify API 2026-04
 * Returns empty policies - users must enter URLs manually in settings
 */
export async function fetchShopPolicies(_admin: any): Promise<ShopPolicies> {
  // Policies are no longer available via GraphQL in API 2026-04
  // Return empty values - users can manually enter URLs in settings
  return {
    privacyPolicy: null,
    termsOfService: null,
    refundPolicy: null,
  };
}
