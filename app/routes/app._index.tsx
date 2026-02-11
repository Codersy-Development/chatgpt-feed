import { useEffect, useCallback } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  getFeedSettings,
  autoPopulateSettings,
  generateFeed,
  getCachedFeed,
} from "../lib/feed-service.server";

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const db = context.cloudflare.env.DB;

  // Get or create feed settings (auto-populate from Shopify on first load)
  let settings = await getFeedSettings(db, session.shop);

  // If seller_name is not set, auto-populate from Shopify
  if (!settings.seller_name) {
    settings = await autoPopulateSettings(db, session.shop, admin);
  }

  // Get cached feed info
  const cachedFeed = await getCachedFeed(db, session.shop);

  // Build the feed URL
  const appUrl = context.cloudflare.env.SHOPIFY_APP_URL || "";
  const shopSlug = session.shop.replace(".myshopify.com", "");
  const feedUrl = `${appUrl}/feed/${shopSlug}/products.jsonl`;

  return {
    shop: session.shop,
    settings,
    feedUrl,
    feedStatus: cachedFeed
      ? {
          productCount: cachedFeed.productCount,
          generatedAt: cachedFeed.generatedAt,
        }
      : null,
  };
};

export const action = async ({ request, context }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const db = context.cloudflare.env.DB;

  const formData = await request.formData();
  const actionType = formData.get("action");

  if (actionType === "generate") {
    const result = await generateFeed(db, session.shop, admin);
    return { action: "generate", ...result };
  }

  if (actionType === "sync-settings") {
    const settings = await autoPopulateSettings(db, session.shop, admin);
    return { action: "sync-settings", success: true, settings };
  }

  return { action: "unknown", success: false };
};

export default function Index() {
  const { shop, settings, feedUrl, feedStatus } =
    useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const isGenerating =
    fetcher.state !== "idle" && fetcher.formData?.get("action") === "generate";

  useEffect(() => {
    if (fetcher.data?.action === "generate") {
      if ((fetcher.data as any).success) {
        shopify.toast.show("Feed generated successfully!");
      } else {
        shopify.toast.show("Feed generation failed. Check logs.", {
          isError: true,
        });
      }
    }
  }, [fetcher.data, shopify]);

  const formatDate = useCallback((timestamp: number) => {
    return new Date(timestamp).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }, []);

  return (
    <s-page heading="OpenAI Product Feed">
      {/* Feed Status */}
      <s-section heading="Feed Status">
        {feedStatus ? (
          <>
            <s-stack direction="block" gap="base">
              <s-stack direction="inline" gap="tight">
                <s-badge tone="success">Active</s-badge>
                <s-text>
                  {feedStatus.productCount} product variants indexed
                </s-text>
              </s-stack>
              <s-text color="subdued">
                Last generated: {formatDate(feedStatus.generatedAt)}
              </s-text>
            </s-stack>
          </>
        ) : (
          <s-stack direction="inline" gap="tight">
            <s-badge tone="warning">Not Generated</s-badge>
            <s-text>
              Generate your feed to make products discoverable in ChatGPT
            </s-text>
          </s-stack>
        )}

        <s-box padding-block-start="base">
          <fetcher.Form method="POST">
            <input type="hidden" name="action" value="generate" />
            <s-button
              variant="primary"
              type="submit"
              {...(isGenerating ? { loading: true } : {})}
            >
              {feedStatus ? "Regenerate Feed" : "Generate Feed"}
            </s-button>
          </fetcher.Form>
        </s-box>
      </s-section>

      {/* Feed URL */}
      {feedStatus && (
        <s-section heading="Feed URL">
          <s-paragraph>
            Share this URL with OpenAI for feed ingestion:
          </s-paragraph>
          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
            background="subdued"
          >
            <s-text type="strong">{feedUrl}</s-text>
          </s-box>
          <s-paragraph>
            <s-text color="subdued">
              This URL serves your product feed in JSONL format (gzip
              compressed). It is publicly accessible so OpenAI can ingest it.
            </s-text>
          </s-paragraph>
        </s-section>
      )}

      {/* How It Works */}
      <s-section heading="How It Works">
        <s-unordered-list>
          <s-list-item>
            Configure your feed settings under the Settings tab
          </s-list-item>
          <s-list-item>
            Click "Generate Feed" to build your product feed from Shopify data
          </s-list-item>
          <s-list-item>
            Share the feed URL with OpenAI for ingestion
          </s-list-item>
          <s-list-item>
            The feed auto-regenerates when products change via webhooks
          </s-list-item>
        </s-unordered-list>
      </s-section>

      {/* Store Info - Aside */}
      <s-section slot="aside" heading="Store Info">
        <s-stack direction="block" gap="base">
          <s-stack direction="block" gap="tight">
            <s-text color="subdued">Store</s-text>
            <s-text>{shop}</s-text>
          </s-stack>
          {settings.seller_name && (
            <s-stack direction="block" gap="tight">
              <s-text color="subdued">Seller Name</s-text>
              <s-text>{settings.seller_name}</s-text>
            </s-stack>
          )}
          <s-stack direction="block" gap="tight">
            <s-text color="subdued">Search Eligible</s-text>
            <s-badge tone={settings.enable_search ? "success" : "critical"}>
              {settings.enable_search ? "Enabled" : "Disabled"}
            </s-badge>
          </s-stack>
          <s-stack direction="block" gap="tight">
            <s-text color="subdued">Checkout Eligible</s-text>
            <s-badge tone={settings.enable_checkout ? "success" : "critical"}>
              {settings.enable_checkout ? "Enabled" : "Disabled"}
            </s-badge>
          </s-stack>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
