import { Hono } from "hono";
import { Env } from "./types";
import { createBot } from "./bot/handlers";
import { adminApp } from "./api/admin";

// Export Durable Object classes for Cloudflare Workers runtime
export { MediaGroupDO } from "./durable-objects/MediaGroupDO";
export { SessionDO } from "./durable-objects/SessionDO";

const app = new Hono<{ Bindings: Env }>();

// Mount Admin & Auth API
app.route("/api", adminApp);

// Health check endpoint
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Telegram Bot Webhook endpoint
app.post("/webhook", async (c) => {
  // Validate optional webhook secret token
  const secretHeader = c.req.header("x-telegram-bot-api-secret-token");
  if (c.env.WEBHOOK_SECRET && secretHeader !== c.env.WEBHOOK_SECRET) {
    return c.text("Unauthorized", 401);
  }

  try {
    const update = await c.req.json();
    const url = new URL(c.req.url);
    const origin = url.origin;

    const bot = createBot(c.env, origin);
    // Process the update
    await bot.handleUpdate(update);

    return c.text("OK", 200);
  } catch (err) {
    console.error("Error handling Telegram webhook:", err);
    return c.text("Internal Server Error", 500);
  }
});

// Fallback to Static Assets (Admin UI and Captcha images)
app.get("*", async (c) => {
  if (c.env.ASSETS) {
    const res = await c.env.ASSETS.fetch(c.req.raw);
    if (res.status === 404 && c.req.header("accept")?.includes("text/html")) {
      // SPA fallback to index.html for client-side routing
      const url = new URL(c.req.url);
      url.pathname = "/index.html";
      return await c.env.ASSETS.fetch(new Request(url.toString(), c.req.raw));
    }
    return res;
  }
  return c.text("Static Assets binding not configured", 404);
});

export default app;
