import { Hono } from "hono";
import { sign, verify } from "hono/jwt";
import { Env } from "../types";
import { Database } from "../db";
import { Bot } from "grammy";

export const adminApp = new Hono<{ Bindings: Env }>();

// Auth: Login
adminApp.post("/auth/login", async (c) => {
  const { username, password } = await c.req.json();
  const validUser = c.env.ADMIN_WEB_USERNAME || "admin";
  const validPass = c.env.ADMIN_WEB_PASSWORD || "admin123";

  if (username !== validUser || password !== validPass) {
    return c.json({ error: "Invalid username or password" }, 401);
  }

  const secret = c.env.JWT_SECRET || "tg_interactive_worker_secret_2025";
  const token = await sign(
    {
      sub: username,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
    },
    secret,
  );

  return c.json({ token, username });
});

// Auth Middleware for /api/admin/*
adminApp.use("/admin/*", async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized: Missing token" }, 401);
  }

  const token = authHeader.substring(7);
  const secret = c.env.JWT_SECRET || "tg_interactive_worker_secret_2025";

  try {
    const payload = await verify(token, secret, "HS256");
    c.set("jwtPayload", payload);
    await next();
  } catch (err) {
    return c.json({ error: "Unauthorized: Invalid token" }, 401);
  }
});

// GET /api/admin/stats
adminApp.get("/admin/stats", async (c) => {
  const db = new Database(c.env.DB);
  const stats = await db.getStats();
  return c.json(stats);
});

// GET /api/admin/users
adminApp.get("/admin/users", async (c) => {
  const db = new Database(c.env.DB);
  const page = parseInt(c.req.query("page") || "1", 10);
  const limit = parseInt(c.req.query("limit") || "20", 10);
  const search = c.req.query("search") || "";

  const offset = (page - 1) * limit;
  const result = await db.listUsers({ search, limit, offset });

  return c.json({
    users: result.users,
    total: result.total,
    page,
    limit,
    totalPages: Math.ceil(result.total / limit),
  });
});

// POST /api/admin/users/:userId/ban
adminApp.post("/admin/users/:userId/ban", async (c) => {
  const db = new Database(c.env.DB);
  const userId = parseInt(c.req.param("userId"), 10);
  const { isBanned } = await c.req.json();

  await db.setUserBanned(userId, !!isBanned);
  return c.json({ success: true, userId, isBanned: !!isBanned });
});

// POST /api/admin/users/:userId/send
adminApp.post("/admin/users/:userId/send", async (c) => {
  const userId = parseInt(c.req.param("userId"), 10);
  const { message } = await c.req.json();

  if (!message || !message.trim()) {
    return c.json({ error: "Message cannot be empty" }, 400);
  }

  try {
    const bot = new Bot(c.env.BOT_TOKEN);
    const sent = await bot.api.sendMessage(userId, message);
    return c.json({ success: true, messageId: sent.message_id });
  } catch (err: any) {
    return c.json({ error: err?.message || "Failed to send message" }, 500);
  }
});

// GET /api/admin/messages
adminApp.get("/admin/messages", async (c) => {
  const db = new Database(c.env.DB);
  const limit = parseInt(c.req.query("limit") || "50", 10);
  const messages = await db.listRecentMessageMaps(limit);
  return c.json({ messages });
});

// GET /api/admin/topics
adminApp.get("/admin/topics", async (c) => {
  const db = new Database(c.env.DB);
  const topics = await db.listForumTopics();
  return c.json({ topics });
});

// POST /api/admin/topics/:threadId/toggle
adminApp.post("/admin/topics/:threadId/toggle", async (c) => {
  const db = new Database(c.env.DB);
  const threadId = parseInt(c.req.param("threadId"), 10);
  const { status } = await c.req.json(); // 'opened' | 'closed'

  const current = await db.getForumStatus(threadId);
  const chatId = current?.chat_id || Number(c.env.ADMIN_GROUP_ID);

  await db.setForumStatus(chatId, threadId, status === "closed" ? "closed" : "opened");
  return c.json({ success: true, threadId, status });
});

// GET /api/admin/settings
adminApp.get("/admin/settings", async (c) => {
  const db = new Database(c.env.DB);
  const settings = await db.getSettings(c.env);
  return c.json({ settings });
});

// POST /api/admin/settings
adminApp.post("/admin/settings", async (c) => {
  const db = new Database(c.env.DB);
  const body = (await c.req.json()) as Record<string, string>;

  for (const [key, value] of Object.entries(body)) {
    if (value !== undefined) {
      await db.updateSetting(key, String(value));
    }
  }

  const updated = await db.getSettings(c.env);
  return c.json({ success: true, settings: updated });
});

// POST /api/admin/broadcast
adminApp.post("/admin/broadcast", async (c) => {
  const { message } = await c.req.json();
  if (!message || !message.trim()) {
    return c.json({ error: "Broadcast message cannot be empty" }, 400);
  }

  const db = new Database(c.env.DB);
  const userIds = await db.getAllUserIds();
  const bot = new Bot(c.env.BOT_TOKEN);

  let success = 0;
  let failed = 0;

  for (const uid of userIds) {
    try {
      await bot.api.sendMessage(uid, message);
      success++;
    } catch (_) {
      failed++;
    }
  }

  return c.json({
    success: true,
    total: userIds.length,
    sent: success,
    failed,
  });
});

// GET /api/admin/bot-info
adminApp.get("/admin/bot-info", async (c) => {
  try {
    const bot = new Bot(c.env.BOT_TOKEN);
    const me = await bot.api.getMe();
    let adminGroupTitle = "Unknown";
    let adminGroupError = null;

    try {
      const chat = await bot.api.getChat(Number(c.env.ADMIN_GROUP_ID));
      if ("title" in chat && chat.title) adminGroupTitle = chat.title;
    } catch (err: any) {
      adminGroupError = err?.message || "Failed to access admin group";
    }

    return c.json({
      bot: {
        id: me.id,
        username: me.username,
        firstName: me.first_name,
        canJoinGroups: me.can_join_groups,
      },
      adminGroupId: c.env.ADMIN_GROUP_ID,
      adminGroupTitle,
      adminGroupError,
    });
  } catch (err: any) {
    return c.json({ error: err?.message || "Invalid bot token or network error" }, 500);
  }
});
