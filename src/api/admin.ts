import { Hono } from "hono";
import { sign, verify } from "hono/jwt";
import { Env } from "../types";
import { Database, ensureSchema } from "../db";
import { Bot } from "grammy";
import { constantTimeCompare, sha256 } from "../common";

export const adminApp = new Hono<{ Bindings: Env }>();

// Auth: Login
adminApp.post("/auth/login", async (c) => {
  const { username, password } = await c.req.json();
  const validUser = c.env.TGC_USERNAME || "";
  const validPass = c.env.TGC_PASSWORD || "";

  if (!validUser || !validPass) {
    return c.json({ error: "Server not configured: TGC_USERNAME or TGC_PASSWORD is not set." }, 500);
  }

  if (!constantTimeCompare(username, validUser) || !constantTimeCompare(password, validPass)) {
    return c.json({ error: "Invalid username or password" }, 401);
  }

  const secret = c.env.TGC_SECRET || validPass;
  const token = await sign(
    {
      sub: username,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 36500, // 100 year
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
  const secret = c.env.TGC_SECRET || c.env.TGC_PASSWORD;

  if (!secret) {
    return c.json({ error: "Server not configured: TGC_PASSWORD and TGC_SECRET are not set." }, 500);
  }

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
  try {
    const db = new Database(c.env.DB);
    const stats = await db.getStats();
    return c.json(stats);
  } catch (err: any) {
    console.error("Failed to get admin stats:", err);
    return c.json({
      totalUsers: 0,
      bannedUsers: 0,
      openTopics: 0,
      closedTopics: 0,
      totalMessagesMapped: 0,
    });
  }
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
    const bot = new Bot(c.env.TGC_BOT_TOKEN);
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
  const chatId = current?.chat_id || Number(c.env.TGC_ADMIN_GROUP_ID) || 0;

  if (!chatId) {
    return c.json({ error: "Server not configured: TGC_ADMIN_GROUP_ID is not set." }, 500);
  }

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
  const bot = new Bot(c.env.TGC_BOT_TOKEN);

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

// Helper: Admin Supergroup & Permissions Validator
export interface AdminGroupCheck {
  checked: boolean;
  groupId: number | string;
  title?: string;
  type?: string;
  isSupergroup: boolean;
  isForum: boolean;
  botInGroup: boolean;
  botIsAdmin: boolean;
  canManageTopics: boolean;
  canDeleteMessages: boolean;
  status: "ok" | "warning" | "error";
  issues: string[];
  error?: string;
}

export async function checkAdminGroup(bot: Bot, groupId: number, botId: number): Promise<AdminGroupCheck> {
  const check: AdminGroupCheck = {
    checked: true,
    groupId,
    isSupergroup: false,
    isForum: false,
    botInGroup: false,
    botIsAdmin: false,
    canManageTopics: false,
    canDeleteMessages: false,
    status: "ok",
    issues: [],
  };

  if (!groupId) {
    check.checked = false;
    check.status = "error";
    check.error = "TGC_ADMIN_GROUP_ID is not configured";
    check.issues.push("TGC_ADMIN_GROUP_ID is not set in environment or wrangler.toml.");
    return check;
  }

  try {
    const chat = await bot.api.getChat(groupId);
    check.title = "title" in chat ? chat.title : String(groupId);
    check.type = chat.type;
    check.isSupergroup = chat.type === "supergroup";
    check.isForum = !!(chat as any).is_forum;

    if (!check.isSupergroup) {
      check.issues.push(
        `Group type is "${chat.type}". Tgcontact requires a "supergroup". In Telegram group settings, turn on 'Topics' (or 'Forum') to convert it to a supergroup.`
      );
    } else if (!check.isForum) {
      check.issues.push(
        "Group is a supergroup but 'Topics' (Forum) is disabled. In group settings, enable 'Topics' / 'Forum'."
      );
    }

    try {
      const member = await bot.api.getChatMember(groupId, botId);
      check.botInGroup = member.status !== "left" && member.status !== "kicked";

      if (member.status === "creator") {
        check.botIsAdmin = true;
        check.canManageTopics = true;
        check.canDeleteMessages = true;
      } else if (member.status === "administrator") {
        check.botIsAdmin = true;
        check.canManageTopics = !!(member as any).can_manage_topics;
        check.canDeleteMessages = !!(member as any).can_delete_messages;

        if (!check.canManageTopics) {
          check.issues.push("Bot is an Administrator but is missing the 'Manage Topics' permission.");
        }
        if (!check.canDeleteMessages) {
          check.issues.push("Bot is an Administrator but is missing the 'Delete Messages' permission.");
        }
      } else {
        check.botIsAdmin = false;
        check.issues.push(
          `Bot is in the group as a regular "${member.status}", not as an Administrator. Please promote the bot to Administrator.`
        );
      }
    } catch (memberErr: any) {
      check.issues.push(
        `Could not verify bot membership: ${memberErr?.message || "Bot is not in group"}. Please invite the bot to the group as Administrator.`
      );
    }
  } catch (chatErr: any) {
    check.error = chatErr?.message || "Failed to reach group";
    check.issues.push(
      `Cannot access group (${groupId}): ${check.error}. Please ensure the bot is added to the group.`
    );
  }

  if (check.error || !check.botInGroup) {
    check.status = "error";
  } else if (check.issues.length > 0) {
    check.status = "warning";
  } else {
    check.status = "ok";
  }

  return check;
}

// GET /api/admin/bot-info
adminApp.get("/admin/bot-info", async (c) => {
  if (!c.env.TGC_BOT_TOKEN) {
    return c.json({ error: "Server not configured: TGC_BOT_TOKEN is not set." }, 500);
  }

  try {
    const bot = new Bot(c.env.TGC_BOT_TOKEN);
    const me = await bot.api.getMe();
    let adminGroupTitle = "Unknown";
    let adminGroupError: string | null = null;
    let adminGroupCheck: AdminGroupCheck | null = null;

    const chatId = Number(c.env.TGC_ADMIN_GROUP_ID) || 0;
    if (chatId) {
      adminGroupCheck = await checkAdminGroup(bot, chatId, me.id);
      if (adminGroupCheck.title) adminGroupTitle = adminGroupCheck.title;
      if (adminGroupCheck.issues.length > 0) {
        adminGroupError = adminGroupCheck.issues.join("; ");
      }
    } else {
      adminGroupError = "TGC_ADMIN_GROUP_ID is not configured";
    }

    let webhookInfo = null;
    try {
      const wh = await bot.api.getWebhookInfo();
      webhookInfo = {
        url: wh.url,
        hasCustomCertificate: wh.has_custom_certificate,
        pendingUpdateCount: wh.pending_update_count,
        lastErrorDate: wh.last_error_date,
        lastErrorMessage: wh.last_error_message,
      };
    } catch (_) {}

    return c.json({
      bot: {
        id: me.id,
        username: me.username,
        firstName: me.first_name,
        canJoinGroups: me.can_join_groups,
      },
      adminGroupId: c.env.TGC_ADMIN_GROUP_ID,
      adminGroupTitle,
      adminGroupError,
      adminGroupCheck,
      webhookInfo,
    });
  } catch (err: any) {
    return c.json({ error: err?.message || "Invalid bot token or network error" }, 500);
  }
});

// POST /api/admin/webhook/configure
adminApp.post("/admin/webhook/configure", async (c) => {
  if (!c.env.TGC_BOT_TOKEN) {
    return c.json({ error: "Server not configured: TGC_BOT_TOKEN is not set." }, 500);
  }

  const secret = c.env.TGC_WEBHOOK_SECRET || (c.env.TGC_PASSWORD ? await sha256(c.env.TGC_PASSWORD) : null);
  if (!secret) {
    return c.json({ error: "Server not configured: TGC_WEBHOOK_SECRET and TGC_PASSWORD are not set." }, 500);
  }

  try {
    const body = (await c.req.json().catch(() => ({}))) as { origin?: string; baseUrl?: string };
    const rawOrigin = body?.origin || body?.baseUrl || new URL(c.req.url).origin;
    const origin = rawOrigin.trim().replace(/\/+$/, "");
    const webhookUrl = `${origin}/webhook`;

    // Ensure database tables exist
    await ensureSchema(c.env.DB).catch(() => null);

    const bot = new Bot(c.env.TGC_BOT_TOKEN);

    // Delete existing webhook and drop any backlog of failing updates
    await bot.api.deleteWebhook({ drop_pending_updates: true }).catch(() => null);

    // Set new webhook and purge pending retries
    await bot.api.setWebhook(webhookUrl, {
      secret_token: secret,
      drop_pending_updates: true,
    });

    // Register Telegram Bot commands as menu buttons
    await bot.api.setMyCommands([
      { command: "start", description: "Start the bot & show welcome message" },
      { command: "info", description: "Show your user ID and group ID" },
    ]);

    const adminGroupId = Number(c.env.TGC_ADMIN_GROUP_ID) || 0;
    if (adminGroupId) {
      try {
        await bot.api.setMyCommands(
          [
            { command: "start", description: "Check bot status in admin group" },
            { command: "info", description: "Show your user ID and group ID" },
            { command: "clear", description: "Close topic & clear chat history" },
            { command: "broadcast", description: "Broadcast replied message to all users" },
          ],
          { scope: { type: "chat", chat_id: adminGroupId } },
        );
      } catch (err: any) {
        console.warn("Could not register admin group scoped commands:", err);
      }
    }

    const info = await bot.api.getWebhookInfo().catch(() => null);

    return c.json({
      success: true,
      message: "Webhook and bot menu commands successfully configured with Telegram",
      webhookUrl,
      info,
    });
  } catch (err: any) {
    console.error("Failed to configure Telegram webhook:", err);
    return c.json({ error: err?.message || "Failed to configure Telegram webhook" }, 500);
  }
});

// GET /api/admin/webhook/info
adminApp.get("/admin/webhook/info", async (c) => {
  if (!c.env.TGC_BOT_TOKEN) {
    return c.json({ error: "Server not configured: TGC_BOT_TOKEN is not set." }, 500);
  }

  try {
    const bot = new Bot(c.env.TGC_BOT_TOKEN);
    const info = await bot.api.getWebhookInfo();
    return c.json({ success: true, info });
  } catch (err: any) {
    return c.json({ error: err?.message || "Failed to get webhook info" }, 500);
  }
});

// GET /api/admin/config/status
adminApp.get("/admin/config/status", async (c) => {
  const hasBotToken = !!c.env.TGC_BOT_TOKEN;
  const adminGroupId = c.env.TGC_ADMIN_GROUP_ID || "";
  const adminUserIdsRaw = c.env.TGC_ADMIN_USER_IDS || "";
  const adminUserIds = adminUserIdsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const username = c.env.TGC_USERNAME || "";
  const hasPassword = !!c.env.TGC_PASSWORD;
  const hasJwtSecret = !!c.env.TGC_SECRET;
  const hasWebhookSecret = !!c.env.TGC_WEBHOOK_SECRET;

  let botInfo: { id: number; username: string; firstName: string } | null = null;
  let webhookInfo: any = null;
  let adminGroupCheck: AdminGroupCheck | null = null;
  let botError: string | null = null;

  if (hasBotToken) {
    try {
      const bot = new Bot(c.env.TGC_BOT_TOKEN);
      const me = await bot.api.getMe();
      botInfo = {
        id: me.id,
        username: me.username,
        firstName: me.first_name,
      };

      const adminGroupIdNum = Number(adminGroupId) || 0;
      if (adminGroupIdNum) {
        adminGroupCheck = await checkAdminGroup(bot, adminGroupIdNum, me.id);
      }

      const wh = await bot.api.getWebhookInfo().catch(() => null);
      if (wh) {
        webhookInfo = {
          url: wh.url,
          hasCustomCertificate: wh.has_custom_certificate,
          pendingUpdateCount: wh.pending_update_count,
          lastErrorDate: wh.last_error_date,
          lastErrorMessage: wh.last_error_message,
        };
      }
    } catch (err: any) {
      botError = err?.message || "Failed to connect to Telegram";
    }
  }

  return c.json({
    env: {
      TGC_BOT_TOKEN: {
        isSet: hasBotToken,
        preview: hasBotToken ? (c.env.TGC_BOT_TOKEN.length > 10 ? `${c.env.TGC_BOT_TOKEN.slice(0, 6)}...` : "Configured") : "Not Set",
      },
      TGC_ADMIN_GROUP_ID: {
        isSet: !!adminGroupId && adminGroupId !== "0",
        value: adminGroupId || undefined,
      },
      TGC_ADMIN_USER_IDS: {
        isSet: adminUserIds.length > 0,
        value: adminUserIds.join(", "),
        count: adminUserIds.length,
      },
      TGC_USERNAME: {
        isSet: !!username,
        value: username || undefined,
      },
      TGC_PASSWORD: {
        isSet: hasPassword,
      },
      TGC_SECRET: {
        isSet: hasJwtSecret,
        fallback: hasPassword ? "TGC_PASSWORD" : null,
      },
      TGC_WEBHOOK_SECRET: {
        isSet: hasWebhookSecret,
        fallback: hasPassword ? "sha256(TGC_PASSWORD)" : null,
      },
    },
    botInfo,
    adminGroupCheck,
    webhookInfo,
    botError,
  });
});

// POST /api/admin/bot/test
adminApp.post("/admin/bot/test", async (c) => {
  if (!c.env.TGC_BOT_TOKEN) {
    return c.json({ error: "Server not configured: TGC_BOT_TOKEN is not set." }, 400);
  }

  const results: {
    botVerified: boolean;
    bot?: { id: number; username: string; firstName: string };
    adminGroup?: AdminGroupCheck;
    adminUsers?: { checked: boolean; attempted: number; delivered: number; details: string[]; error?: string };
    webhook?: any;
    summary: string;
  } = {
    botVerified: false,
    summary: "",
  };

  try {
    const bot = new Bot(c.env.TGC_BOT_TOKEN);
    const me = await bot.api.getMe();
    results.botVerified = true;
    results.bot = {
      id: me.id,
      username: me.username,
      firstName: me.first_name,
    };

    // Check Webhook Info
    const wh = await bot.api.getWebhookInfo().catch(() => null);
    if (wh) {
      results.webhook = {
        url: wh.url,
        pendingUpdateCount: wh.pending_update_count,
        lastErrorDate: wh.last_error_date,
        lastErrorMessage: wh.last_error_message,
      };
    }

    // Check Admin Group (Supergroup, Forum Topics, and Admin Permissions)
    const adminGroupId = Number(c.env.TGC_ADMIN_GROUP_ID) || 0;
    const adminGroupCheck = await checkAdminGroup(bot, adminGroupId, me.id);
    results.adminGroup = adminGroupCheck;

    // Send Test Message to Admin Users
    const adminUserIds = (c.env.TGC_ADMIN_USER_IDS || "")
      .split(",")
      .map((id) => Number(id.trim()))
      .filter(Boolean);

    if (adminUserIds.length > 0) {
      let delivered = 0;
      const details: string[] = [];
      const testMsg = `🤖 <b>[Tgcontact Diagnostic Test]</b>\n\n✅ Your Telegram Bot (@${me.username}) is connected and operating normally.\n⏰ Timestamp: ${new Date().toISOString()}\n🌐 Webhook: ${wh?.url || "Not configured"}`;

      for (const uid of adminUserIds) {
        try {
          await bot.api.sendMessage(uid, testMsg, { parse_mode: "HTML" });
          delivered++;
          details.push(`User ${uid}: Sent successfully`);
        } catch (err: any) {
          details.push(`User ${uid}: Failed (${err?.message || "Unknown error"})`);
        }
      }

      results.adminUsers = {
        checked: true,
        attempted: adminUserIds.length,
        delivered,
        details,
        error: delivered === 0 ? "Could not deliver test message to admin user(s). Ensure admin user has messaged /start to the bot." : undefined,
      };
    } else {
      results.adminUsers = {
        checked: false,
        attempted: 0,
        delivered: 0,
        details: [],
        error: "TGC_ADMIN_USER_IDS is not configured. Add your Telegram user ID in wrangler.toml or environment variables.",
      };
    }

    const groupOk = adminGroupCheck.status === "ok";
    const usersDelivered = results.adminUsers?.delivered && results.adminUsers.delivered > 0;

    if (groupOk && usersDelivered) {
      results.summary = `All checks passed! Supergroup topics verified, bot is Administrator, and direct test message delivered to ${results.adminUsers.delivered} admin user(s).`;
    } else if (!groupOk && usersDelivered) {
      results.summary = `Test message delivered to admin user(s), BUT support group needs attention: ${adminGroupCheck.issues[0] || adminGroupCheck.error}`;
    } else if (groupOk && !usersDelivered) {
      results.summary = `Supergroup verified, but direct test message could not be sent to admin users. Ensure admin accounts have messaged /start to the bot.`;
    } else {
      results.summary = `Configuration check completed with warnings: ${adminGroupCheck.issues[0] || adminGroupCheck.error || "Please verify TGC_ADMIN_USER_IDS."}`;
    }

    return c.json({ success: true, results });
  } catch (err: any) {
    return c.json({ error: err?.message || "Failed to verify Telegram Bot" }, 500);
  }
});

