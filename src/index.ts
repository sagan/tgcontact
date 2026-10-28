import { Hono } from "hono";
import type { UserFromGetMe } from "grammy/types";
import { Env } from "./types";
import { createBot } from "./bot/handlers";
import { adminApp } from "./api/admin";
import { constantTimeCompare, sha256 } from "./common";

// Export Durable Object classes for Cloudflare Workers runtime
export { MediaGroupDO } from "./durable-objects/MediaGroupDO";
export { SessionDO } from "./durable-objects/SessionDO";

const app = new Hono<{ Bindings: Env }>();

let cachedBot: { token: string; info: UserFromGetMe } | null = null;

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
  if (!secretHeader) {
    return c.text("Unauthorized: Missing secret token", 401);
  }
  if (!c.env.TGC_WEBHOOK_SECRET && !c.env.TGC_PASSWORD) {
    return c.json({ error: "Server not configured: TGC_WEBHOOK_SECRET and TGC_PASSWORD are not set." }, 500);
  }
  const secret = c.env.TGC_WEBHOOK_SECRET || (await sha256(c.env.TGC_PASSWORD!));
  if (!constantTimeCompare(secretHeader, secret)) {
    return c.text("Unauthorized", 401);
  }

  try {
    const update = await c.req.json();
    const url = new URL(c.req.url);
    const origin = url.origin;

    const token = c.env.TGC_BOT_TOKEN;
    let botInfo = cachedBot && cachedBot.token === token ? cachedBot.info : undefined;

    const bot = createBot(c.env, origin, botInfo);
    if (!botInfo) {
      await bot.init();
      cachedBot = { token, info: bot.botInfo };
    }

    // Process the update
    try {
      await bot.handleUpdate(update);
    } catch (handlerErr) {
      console.error("Error processing Telegram update:", handlerErr);
    }

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
