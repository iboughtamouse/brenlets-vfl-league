/**
 * Local development server — Hono on Node.js.
 *
 * Imports the shared Hono app from app.ts and adds:
 *   - Static file serving for the built React client
 *   - SPA fallback (index.html for non-API routes)
 *   - @hono/node-server to start a persistent HTTP server
 *
 * NOT used in production — Vercel serves static files via CDN
 * and routes API calls to the serverless function in api/index.ts.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { app as apiApp } from './app.js';

const app = new Hono();

// Mount API routes from the shared app
app.route('/', apiApp);

// ---------------------------------------------------------------------------
// Static files — serve built React client locally
// ---------------------------------------------------------------------------

const clientDist = resolve(import.meta.dirname, '../../client/dist');

if (existsSync(clientDist)) {
  // Serve static assets (JS, CSS, images) — root is relative to CWD
  app.use('/*', serveStatic({ root: './client/dist' }));

  // SPA fallback — serve index.html for any non-API route
  app.get('*', (c) => {
    const html = readFileSync(resolve(clientDist, 'index.html'), 'utf-8');
    return c.html(html);
  });
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const port = Number(process.env.PORT ?? 3000);

serve({ fetch: app.fetch, port }, () => {
  console.log(`Server running at http://localhost:${port}`);
});
