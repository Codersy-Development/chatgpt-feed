# Shopify App Starter - Cloudflare Workers + D1

A free-to-host Shopify App starter template built with Cloudflare Workers, D1 Database, and React Router.

## Why This Template?

**Zero operating costs for new developers!** This template leverages Cloudflare's generous free tier:

- ✅ **Free hosting** on Cloudflare Workers (100,000 requests/day)
- ✅ **D1 Database included** (5GB storage, 5M rows read/day, 100K rows written/day)
- ✅ **Straightforward setup** - get started in minutes
- ✅ **Built for Shopify** - ready for app development
- ✅ **Production-ready** - scales with your business

Perfect for developers building their first Shopify app without worrying about hosting costs!

### Cloudflare Free Tier Limits

**Workers:**

- 100,000 requests per day
- 10ms CPU time per request
- Enough for development and small production apps

**D1 Database:**

- 5 GB storage
- 5,000,000 rows read per day
- 100,000 rows written per day
- Generous limits for most Shopify apps

## Features

- 🚀 Server-side rendering with React Router
- 💾 Cloudflare D1 (SQLite) database integration
- ⚡️ Hot Module Replacement (HMR)
- 🔒 TypeScript by default
- 🎉 TailwindCSS for styling
- 🌐 Edge deployment with Cloudflare Workers

## Prerequisites

- Node.js 18+ installed
- A Cloudflare account (free tier available)
- Basic familiarity with Shopify app development

## Getting Started

### 1. Installation

Install the dependencies:

```bash
npm install
```

### 2. Development

Start the development server - Shopify CLI will guide you through the setup:

```bash
npm run dev
```

**What happens when you run this command:**

1. **Shopify CLI Interactive Setup** - You'll be prompted to:
   - Select or create a Shopify Partner organization
   - Create or select an app
   - Choose a development store
   - Configure your app settings

2. **Automatic Local Database Setup** - The D1 database is created and migrations are applied automatically to your local environment

3. **Dev Server Starts** - Your app becomes available at `http://localhost:5173` with a Cloudflare tunnel URL for Shopify

That's it! No manual database creation needed for local development.

### 3. Creating New Database Migrations (Optional)

If you need to add new tables or modify the database schema:

```bash
npx wrangler d1 migrations create shopify-app-db <migration-name>
```

Example:

```bash
npx wrangler d1 migrations create shopify-app-db add_products_table
```

This creates a new SQL file in `migrations/`. Edit it to add your changes:

```sql
-- migrations/0002_add_products_table.sql
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  shop TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
```

Migrations are automatically applied when you run `npm run dev`.

### 4. Database Queries in Development

Execute SQL queries directly:

```bash
# Local database - check sessions
npx wrangler d1 execute shopify-app-db --local --command="SELECT * FROM sessions"

# Production database (after deployment)
npx wrangler d1 execute shopify-app-db --remote --command="SELECT * FROM sessions"
```

### 5. Viewing Local Database with TablePlus (Recommended)

For a better database browsing experience, use [TablePlus](https://tableplus.com/) (free app available for macOS, Windows, and Linux).

**Setup steps:**

1. **Download TablePlus** - Get the free version from [tableplus.com](https://tableplus.com/)

2. **Locate your local D1 database** - The database file is stored inside your project's `.wrangler` directory:

   ```bash
   # The file is at:
   .wrangler/state/v3/d1/miniflare-D1DatabaseObject/[database-id].sqlite

   # Or find it quickly with:
   find .wrangler -name "*.sqlite" -type f
   ```

3. **Connect in TablePlus:**
   - Click "Create a new connection"
   - Select "SQLite"
   - Browse to your `.sqlite` file
   - Click "Connect"

Now you can visually browse tables, run queries, and inspect your data with a nice UI!

**Alternative Database Viewers:**

- [DB Browser for SQLite](https://sqlitebrowser.org/) (Free, open-source)
- [SQLiteStudio](https://sqlitestudio.pl/) (Free, cross-platform)
- [DBeaver](https://dbeaver.io/) (Free, supports multiple databases)

## Deployment

When you're ready to deploy your app to production, you need to create a production D1 database and deploy to Cloudflare Workers.

### Step 1: Create Production D1 Database

First, create your production database:

```bash
npx wrangler d1 create shopify-app-db
```

This outputs your database configuration. Copy the `database_id` and update your `wrangler.jsonc`:

```jsonc
[[d1_databases]]
binding = "DB"
database_name = "shopify-app-db"
database_id = "your-database-id-here"  // Replace with your actual database_id
migrations_dir = "./migrations"
```

### Step 2: Apply Migrations to Production

Apply your database migrations to the production database:

```bash
npx wrangler d1 migrations apply shopify-app-db --remote
```

This creates all tables and indexes in your production database.

### Step 3: Deploy Using Shopify CLI

Deploy your app through Shopify CLI (recommended):

```bash
npm run deploy
```

This command:

1. Builds your app
2. Deploys to Cloudflare Workers
3. Updates your Shopify app configuration
4. Provides your production URL

### Alternative: Direct Cloudflare Workers Deployment

Deploy directly to Cloudflare Workers without Shopify CLI:

```bash
npm run deploy:workers
```

**After deployment, update your Shopify app settings:**

1. Go to your [Shopify Partner Dashboard](https://partners.shopify.com)
2. Navigate to your app settings
3. Update the "App URL" with your Workers URL (format: `https://your-worker.your-subdomain.workers.dev`)
4. Update "Allowed redirection URLs" with: `https://your-worker.your-subdomain.workers.dev/auth/callback`

### Verify Deployment

Test your production database:

```bash
npx wrangler d1 execute shopify-app-db --remote --command="SELECT COUNT(*) FROM sessions"
```

### Managing Production Deployments

View your deployment history:

```bash
npx wrangler deployments list
```

Rollback to a previous version if needed:

```bash
npx wrangler rollback [deployment-id]
```

### Automatic Deployments with GitHub

Connect your GitHub repository to Cloudflare Workers for automatic deployments on every push:

**1. Go to Cloudflare Workers Dashboard:**

- Navigate to [Cloudflare Dashboard](https://dash.cloudflare.com)
- Select your Worker
- Go to **Settings** → **Deployments**

**2. Connect GitHub:**

- Click "Connect to GitHub"
- Authorize Cloudflare to access your repositories
- Select your repository and branch (e.g., `main`)

**3. Configure Build Settings:**

- Build command: `npm run build`
- Build output directory: `build/client`

Now every push to your selected branch automatically deploys your app! 🚀

## Project Structure

```
├── app/                    # React Router application
│   ├── routes/            # Application routes
│   └── entry.server.tsx   # Server entry point
├── workers/               # Cloudflare Workers code
│   └── app.ts            # Worker entry point
├── migrations/           # D1 database migrations
├── public/              # Static assets
└── wrangler.jsonc       # Cloudflare configuration
```

## Next Steps

- [ ] Run `npm run dev` to start the interactive Shopify CLI setup
- [ ] Build your app's core functionality
- [ ] Create production D1 database when ready to deploy
- [ ] Deploy using `npm run deploy`
- [ ] Add webhook handlers for app lifecycle events

## Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [D1 Database Docs](https://developers.cloudflare.com/d1/)
- [React Router Docs](https://reactrouter.com/)
- [Shopify App Development](https://shopify.dev/docs/apps)

---

**Created by [Mladen Terzic](https://mladenterzic.com)** | **[Codersy](https://www.codersy.com)** - [Shopify Plus Partner Agency](https://www.shopify.com/partners/directory/partner/codersy)

Built with ❤️ for the Shopify developer community
