/**
 * Vercel serverless entry point.
 *
 * Re-exports the Hono app as the default export — Vercel's Hono
 * integration picks this up and handles request routing automatically.
 */

import { app } from '../src/web/app.js';

export default app;
