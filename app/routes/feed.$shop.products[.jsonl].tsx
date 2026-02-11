/**
 * Public feed endpoint: /feed/:shop/products.jsonl
 *
 * Serves the cached JSONL feed for a given shop.
 * Supports gzip compression via Accept-Encoding header.
 * No authentication required — this must be publicly accessible for OpenAI to ingest.
 */

import type { LoaderFunctionArgs } from "react-router";

export const loader = async ({
  params,
  request,
  context,
}: LoaderFunctionArgs) => {
  const shopSlug = params.shop;
  if (!shopSlug) {
    return new Response("Not Found", { status: 404 });
  }

  // Reconstruct the Shopify domain from the slug
  const shop = `${shopSlug}.myshopify.com`;
  const db = context.cloudflare.env.DB;

  try {
    const row = await db
      .prepare(
        "SELECT feed_data, product_count, generated_at FROM feed_cache WHERE shop = ?",
      )
      .bind(shop)
      .first();

    if (!row || !row.feed_data) {
      return new Response("Feed not found. Generate the feed first.", {
        status: 404,
        headers: { "Content-Type": "text/plain" },
      });
    }

    const feedData = row.feed_data as string;
    const generatedAt = new Date(row.generated_at as number).toUTCString();

    // Check if the client accepts gzip
    const acceptEncoding = request.headers.get("Accept-Encoding") || "";
    const supportsGzip = acceptEncoding.includes("gzip");

    if (supportsGzip) {
      // Compress the feed with gzip using the Web API CompressionStream
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(feedData));
          controller.close();
        },
      });

      const compressedStream = stream.pipeThrough(
        new CompressionStream("gzip"),
      );

      return new Response(compressedStream, {
        status: 200,
        headers: {
          "Content-Type": "application/jsonl",
          "Content-Encoding": "gzip",
          "Content-Disposition": "inline; filename=products.jsonl.gz",
          "Last-Modified": generatedAt,
          "Cache-Control": "public, max-age=3600",
          "Access-Control-Allow-Origin": "*",
          "X-Product-Count": String(row.product_count),
        },
      });
    }

    // Return uncompressed
    return new Response(feedData, {
      status: 200,
      headers: {
        "Content-Type": "application/jsonl",
        "Content-Disposition": "inline; filename=products.jsonl",
        "Last-Modified": generatedAt,
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
        "X-Product-Count": String(row.product_count),
      },
    });
  } catch (error) {
    console.error(`[Feed] Error serving feed for ${shop}:`, error);
    return new Response("Internal Server Error", { status: 500 });
  }
};
