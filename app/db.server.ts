import type { D1Database } from "@cloudflare/workers-types";

/**
 * Get the D1 database instance.
 * Uses globalThis.shopifyDb which is set by setupShopify() in workers/app.ts
 */
export const getDb = (): D1Database => {
  const db = globalThis.shopifyDb;
  if (!db) {
    throw new Error(
      "D1 database not initialized. Make sure setupShopify(env) is called before accessing the database.",
    );
  }
  return db;
};

// Helper functions for common database operations
export const executeQuery = async (
  db: D1Database,
  query: string,
  params: unknown[] = [],
) => {
  const statement = db.prepare(query);
  if (params.length > 0) {
    return await statement.bind(...params).run();
  }
  return await statement.run();
};

export const getAllRows = async (
  db: D1Database,
  query: string,
  params: unknown[] = [],
) => {
  const statement = db.prepare(query);
  if (params.length > 0) {
    return await statement.bind(...params).all();
  }
  return await statement.all();
};

export const getFirstRow = async (
  db: D1Database,
  query: string,
  params: unknown[] = [],
) => {
  const statement = db.prepare(query);
  if (params.length > 0) {
    return await statement.bind(...params).first();
  }
  return await statement.first();
};

export default getDb;
