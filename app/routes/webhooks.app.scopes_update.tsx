import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, session, topic, shop } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  const current = payload.current as string[];
  if (session) {
    const db = globalThis.shopifyDb;
    if (db) {
      await db
        .prepare("UPDATE sessions SET scope = ? WHERE id = ?")
        .bind(current.toString(), session.id)
        .run();
      console.log(`Updated scopes for session ${session.id}`);
    }
  }
  return new Response();
};
