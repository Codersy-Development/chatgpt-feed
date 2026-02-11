import { useEffect } from "react";
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
  updateFeedSettings,
  autoPopulateSettings,
} from "../lib/feed-service.server";

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const db = context.cloudflare.env.DB;

  const settings = await getFeedSettings(db, session.shop);

  return { shop: session.shop, settings };
};

export const action = async ({ request, context }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const db = context.cloudflare.env.DB;

  const formData = await request.formData();
  const actionType = formData.get("action");

  if (actionType === "save") {
    await updateFeedSettings(db, session.shop, {
      enable_search: formData.get("enable_search") === "true",
      enable_checkout: formData.get("enable_checkout") === "true",
      seller_name: (formData.get("seller_name") as string) || null,
      seller_url: (formData.get("seller_url") as string) || null,
      privacy_policy_url:
        (formData.get("privacy_policy_url") as string) || null,
      terms_of_service_url:
        (formData.get("terms_of_service_url") as string) || null,
      return_policy_url: (formData.get("return_policy_url") as string) || null,
      accepts_returns: formData.get("accepts_returns") === "true",
      return_deadline_days: parseInt(
        (formData.get("return_deadline_days") as string) || "30",
        10,
      ),
      accepts_exchanges: formData.get("accepts_exchanges") === "true",
      store_country: (formData.get("store_country") as string) || "US",
      target_countries: (formData.get("target_countries") as string) || "US",
    });

    return { action: "save", success: true };
  }

  if (actionType === "sync-shopify") {
    await autoPopulateSettings(db, session.shop, admin);
    return { action: "sync-shopify", success: true };
  }

  return { action: "unknown", success: false };
};

export default function Settings() {
  const { settings } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const isSaving =
    fetcher.state !== "idle" && fetcher.formData?.get("action") === "save";
  const isSyncing =
    fetcher.state !== "idle" &&
    fetcher.formData?.get("action") === "sync-shopify";

  useEffect(() => {
    if (fetcher.data?.action === "save" && (fetcher.data as any).success) {
      shopify.toast.show(
        "Settings saved! Regenerate your feed to apply changes.",
      );
    }
    if (
      fetcher.data?.action === "sync-shopify" &&
      (fetcher.data as any).success
    ) {
      shopify.toast.show("Settings synced from Shopify!");
    }
  }, [fetcher.data, shopify]);

  return (
    <s-page heading="Feed Settings">
      <s-link slot={"breadcrumbActions" as Lowercase<string>} href="/app">
        Home
      </s-link>

      <fetcher.Form method="POST">
        <input type="hidden" name="action" value="save" />

        {/* ChatGPT Discovery & Checkout */}
        <s-section heading="ChatGPT Discovery & Checkout">
          <s-paragraph>
            <s-text color="subdued">
              Control how your products appear in ChatGPT
            </s-text>
          </s-paragraph>

          <s-stack direction="block" gap="base">
            <s-checkbox
              name="enable_search"
              value="true"
              label="Enable product search in ChatGPT"
              {...(settings.enable_search ? { checked: true } : {})}
            />

            <s-checkbox
              name="enable_checkout"
              value="true"
              label="Allow purchases directly inside ChatGPT (requires privacy policy & ToS URLs)"
              {...(settings.enable_checkout ? { checked: true } : {})}
            />
          </s-stack>
        </s-section>

        {/* Merchant Info */}
        <s-section heading="Merchant Information">
          <s-paragraph>
            <s-text color="subdued">
              Auto-populated from Shopify. Override if needed.
            </s-text>
          </s-paragraph>

          <s-stack direction="block" gap="base">
            <s-text-field
              label="Seller Name"
              name="seller_name"
              value={settings.seller_name || ""}
            />

            <s-url-field
              label="Seller URL"
              name="seller_url"
              value={settings.seller_url || ""}
            />

            <s-url-field
              label="Privacy Policy URL"
              name="privacy_policy_url"
              value={settings.privacy_policy_url || ""}
            />

            <s-url-field
              label="Terms of Service URL"
              name="terms_of_service_url"
              value={settings.terms_of_service_url || ""}
            />
          </s-stack>
        </s-section>

        {/* Returns */}
        <s-section heading="Return Policy">
          <s-stack direction="block" gap="base">
            <s-url-field
              label="Return Policy URL"
              name="return_policy_url"
              value={settings.return_policy_url || ""}
            />

            <s-checkbox
              name="accepts_returns"
              value="true"
              label="We accept returns"
              {...(settings.accepts_returns ? { checked: true } : {})}
            />

            <s-number-field
              label="Return Deadline (days)"
              name="return_deadline_days"
              value={String(settings.return_deadline_days)}
            />

            <s-checkbox
              name="accepts_exchanges"
              value="true"
              label="We accept exchanges"
              {...(settings.accepts_exchanges ? { checked: true } : {})}
            />
          </s-stack>
        </s-section>

        {/* Geo */}
        <s-section heading="Geographic Settings">
          <s-stack direction="block" gap="base">
            <s-text-field
              label="Store Country"
              name="store_country"
              value={settings.store_country}
            />

            <s-text-field
              label="Target Countries (comma-separated)"
              name="target_countries"
              value={settings.target_countries}
            />
          </s-stack>
        </s-section>

        {/* Save Button */}
        <s-box padding-block-start="large">
          <s-button
            variant="primary"
            type="submit"
            {...(isSaving ? { loading: true } : {})}
          >
            Save Settings
          </s-button>
        </s-box>
      </fetcher.Form>

      {/* Sync from Shopify */}
      <s-section slot="aside" heading="Sync from Shopify">
        <s-paragraph>
          <s-text color="subdued">
            Re-pull store name, URL, and policy links from your Shopify store
            settings.
          </s-text>
        </s-paragraph>
        <s-box padding-block-start="base">
          <fetcher.Form method="POST">
            <input type="hidden" name="action" value="sync-shopify" />
            <s-button type="submit" {...(isSyncing ? { loading: true } : {})}>
              Sync from Shopify
            </s-button>
          </fetcher.Form>
        </s-box>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};

export function ErrorBoundary() {
  return <div>Something went wrong loading settings. Please try again.</div>;
}
