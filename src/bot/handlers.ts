import { Bot, Context, InlineKeyboard } from "grammy";
import type { UserFromGetMe } from "grammy/types";
import { Env, UserRecord } from "../types";
import { Database } from "../db";
import { getRandomCaptcha } from "./captcha";

export function createBot(env: Env, requestOrigin: string, botInfo?: UserFromGetMe) {
  const bot = new Bot(env.TGC_BOT_TOKEN, botInfo ? { botInfo } : undefined);
  bot.catch((err) => {
    console.error("Error in bot middleware:", err);
  });
  const db = new Database(env.DB);

  const adminGroupChatId = Number(env.TGC_ADMIN_GROUP_ID) || 0;
  const adminUserIds = (env.TGC_ADMIN_USER_IDS || "")
    .split(",")
    .map((id) => Number(id.trim()))
    .filter((id) => !!id);

  const escapeHtml = (text?: string | null) => {
    return (text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  };

  const getMentionHtml = (userId: number, name: string) => {
    const escaped = escapeHtml(name || "User");
    return `<a href="tg://user?id=${userId}">${escaped}</a>`;
  };

  // Helper: Get user's SessionDO
  const getSessionDO = (userId: number) => {
    const id = env.SESSION_DO.idFromName(String(userId));
    return env.SESSION_DO.get(id);
  };

  // Helper: Get MediaGroupDO
  const getMediaGroupDO = (mediaGroupId: string) => {
    const id = env.MEDIA_GROUP_DO.idFromName(mediaGroupId);
    return env.MEDIA_GROUP_DO.get(id);
  };

  // Helper: Send Captcha Challenge
  const sendCaptchaChallenge = async (userId: number, chatId: number): Promise<boolean> => {
    const sessionDO = getSessionDO(userId);
    const statusRes = await sessionDO.fetch(new Request("https://do/status"));
    const status = (await statusRes.json()) as { isHuman: boolean; isMuted: boolean };

    if (status.isMuted) {
      await bot.api.sendMessage(
        chatId,
        "You are temporarily muted due to multiple failed verification attempts. Please wait 2 minutes.",
      );
      return false;
    }

    if (!status.isHuman) {
      const captcha = getRandomCaptcha(requestOrigin, userId);
      const promptMsg = await bot.api.sendPhoto(chatId, captcha.imageUrl, {
        caption: `Please solve the captcha to contact admin:\nSelect the matching text from the image below:`,
        reply_markup: captcha.keyboard,
      });

      await sessionDO.fetch(
        new Request("https://do/set-captcha", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: captcha.code,
            chat_id: chatId,
            message_id: promptMsg.message_id,
          }),
        }),
      );
      return true;
    }

    return false;
  };

  // Command: /start
  bot.command("start", async (ctx) => {
    const user = ctx.from;
    if (!user) return;

    if (ctx.chat.type !== "private") {
      const isGroupAdmin = adminUserIds.includes(user.id);
      const groupTitle = "title" in ctx.chat ? ctx.chat.title : "Group";
      const botUsername = ctx.me?.username || env.TGC_NAME || "bot";
      if (isGroupAdmin) {
        await ctx.reply(
          `👋 Hello Admin <b>${escapeHtml(user.first_name)}</b> (<code>${user.id}</code>)!\n\n` +
            `Bot is operating normally in <b>${escapeHtml(groupTitle)}</b>.\n` +
            `Type /info to view diagnostic IDs or use /clear and /broadcast in topics.`,
          { parse_mode: "HTML" },
        );
      } else {
        await ctx.reply(
          `👋 Hello <b>${escapeHtml(user.first_name)}</b>!\n` +
            `Please message @${botUsername} directly in private chat for inquiries.`,
          { parse_mode: "HTML" },
        );
      }
      return;
    }

    await db.upsertUser({
      user_id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      username: user.username,
      is_premium: user.is_premium,
    });

    const settings = await db.getSettings(env);

    if (adminUserIds.includes(user.id)) {
      try {
        const groupChat = await ctx.api.getChat(adminGroupChatId);
        const groupTitle = "title" in groupChat ? groupChat.title : "Admin Group";
        await ctx.reply(
          `👋 Hello Admin <b>${escapeHtml(user.first_name)}</b> (<code>${user.id}</code>)!\n\n` +
            `Welcome to <b>${escapeHtml(env.TGC_NAME || "Tgcontact")}</b> Administration.\n` +
            `• <b>Status:</b> Authorized Administrator\n` +
            `• <b>Admin Group:</b> ${escapeHtml(groupTitle)} (<code>${adminGroupChatId}</code>)\n\n` +
            `<b>Available Commands:</b>\n` +
            `• /info - View your Telegram User ID & current Chat/Group ID\n` +
            `• /broadcast - Broadcast announcement to users (in admin group)\n` +
            `• /clear - Delete forum topic & clear chat history (in topic)\n\n` +
            `User messages sent to this bot will be relayed directly to the admin group.`,
          { parse_mode: "HTML" },
        );
      } catch (err: any) {
        const botUsername = ctx.me?.username || "bot";
        await ctx.reply(
          `⚠️ <b>Admin group configuration warning:</b>\n\n` +
            `Hello Admin <b>${escapeHtml(user.first_name)}</b>! Please ensure bot @${botUsername} has been added to group <code>${adminGroupChatId}</code> as Administrator with Topic Management & Message permissions.\n\n` +
            `Error: <code>${escapeHtml(err?.message || String(err))}</code>`,
          { parse_mode: "HTML" },
        );
      }
    } else {
      const mention = getMentionHtml(user.id, user.first_name);
      await ctx.reply(`${mention}:\n\n${settings.TGC_WELCOME_MESSAGE}`, {
        parse_mode: "HTML",
      });

      // Send captcha challenge immediately on /start if enabled and user not verified
      const userRecord = await db.getUser(user.id);
      if (settings.TGC_DISABLE_CAPTCHA !== 1 && !userRecord?.is_verified) {
        await sendCaptchaChallenge(user.id, ctx.chat.id);
      }
    }
  });

  // Command: /info (in private chat or group /info@bot)
  bot.command("info", async (ctx) => {
    const user = ctx.from;
    if (!user) return;

    const isAdmin = adminUserIds.includes(user.id);
    const isGroup = ctx.chat.type === "group" || ctx.chat.type === "supergroup";

    let message = `📋 <b>Telegram Information</b>\n\n`;
    message += `👤 <b>User Info:</b>\n`;
    message += `• <b>User ID:</b> <code>${user.id}</code>\n`;
    message += `• <b>First Name:</b> ${escapeHtml(user.first_name || "N/A")}\n`;
    if (user.last_name) message += `• <b>Last Name:</b> ${escapeHtml(user.last_name)}\n`;
    if (user.username) message += `• <b>Username:</b> @${escapeHtml(user.username)}\n`;
    message += `• <b>Role:</b> ${isAdmin ? "👑 Administrator" : "Standard User"}\n`;

    if (isGroup) {
      const groupTitle = "title" in ctx.chat ? ctx.chat.title : "Group";
      const isConfiguredAdminGroup = ctx.chat.id === adminGroupChatId;
      message += `\n👥 <b>Group Info:</b>\n`;
      message += `• <b>Group Title:</b> ${escapeHtml(groupTitle)}\n`;
      message += `• <b>Group ID:</b> <code>${ctx.chat.id}</code>\n`;
      message += `• <b>Chat Type:</b> ${ctx.chat.type}\n`;
      if (adminGroupChatId) {
        message += `• <b>Configured Admin Group:</b> ${isConfiguredAdminGroup ? "✅ Yes" : "❌ No"}\n`;
      }
      if (ctx.message?.message_thread_id) {
        message += `• <b>Topic Thread ID:</b> <code>${ctx.message.message_thread_id}</code>\n`;
      }
    } else {
      message += `\n💬 <b>Chat Type:</b> Private Chat\n`;
    }

    await ctx.reply(message, { parse_mode: "HTML" });
  });

  // Callback query: Captcha answers (vcode_<answer>_<userId>)
  bot.callbackQuery(/^vcode_(.+)_(.+)$/, async (ctx) => {
    const [, answer, targetUserIdStr] = ctx.match;
    const clicker = ctx.from;

    if (String(clicker.id) !== targetUserIdStr) {
      await ctx.answerCallbackQuery({ text: "This verification is not for you!", show_alert: true });
      return;
    }

    const sessionDO = getSessionDO(clicker.id);
    const verifyRes = await sessionDO.fetch(
      new Request("https://do/verify-captcha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer }),
      }),
    );

    const result = (await verifyRes.json()) as {
      success: boolean;
      wrong?: boolean;
      muted?: boolean;
      expired?: boolean;
      chat_id?: number;
      message_id?: number;
    };

    if (result.success) {
      await ctx.answerCallbackQuery({ text: "Verification successful! Welcome." });
      await db.setUserVerified(clicker.id, true);
      await ctx.reply(`Welcome ${getMentionHtml(clicker.id, clicker.first_name)}! You may now send your inquiry.`, {
        parse_mode: "HTML",
      });
    } else if (result.muted) {
      await ctx.answerCallbackQuery({
        text: "You are temporarily muted for too many wrong attempts. Please wait.",
        show_alert: true,
      });
    } else if (result.wrong) {
      await ctx.answerCallbackQuery({
        text: "Incorrect answer. You are muted for 2 minutes.",
        show_alert: true,
      });
    } else if (result.expired) {
      await ctx.answerCallbackQuery({
        text: "Captcha has expired. Please send a new message to get a new captcha.",
        show_alert: true,
      });
    }

    // Try deleting the captcha prompt message
    try {
      await ctx.deleteMessage();
    } catch (_) {}
  });

  // Admin Command: /clear (in admin group topic)
  bot.command("clear", async (ctx) => {
    if (ctx.chat.id !== adminGroupChatId) return;
    const user = ctx.from;
    if (!user || !adminUserIds.includes(user.id)) {
      await ctx.reply("You do not have permission to execute this command.", { parse_mode: "HTML" });
      return;
    }

    const threadId = ctx.message?.message_thread_id;
    if (!threadId) {
      await ctx.reply("Please run this command inside a specific forum topic.");
      return;
    }

    const settings = await db.getSettings(env);
    const targetUser = await db.getUserByThreadId(threadId);

    // 1. Delete the forum topic
    try {
      await ctx.api.deleteForumTopic(adminGroupChatId, threadId);
    } catch (err: any) {
      console.error("Failed to delete forum topic:", err);
    }

    // 2. If configured, delete all user messages in user's chat
    if (settings.TGC_DELETE_USER_MESSAGE_ON_CLEAR_CMD === 1 && targetUser) {
      try {
        const mappedMsgs = await db.getAllMessagesByUser(targetUser.user_id);
        const userMsgIds = mappedMsgs.map((m) => m.user_chat_message_id);

        // Delete in batches of 100 (Telegram limit)
        for (let i = 0; i < userMsgIds.length; i += 100) {
          const batch = userMsgIds.slice(i, i + 100);
          if (batch.length > 0) {
            await ctx.api.deleteMessages(targetUser.user_id, batch);
          }
        }
      } catch (err) {
        console.error("Failed to delete user messages on clear:", err);
      }
    }
  });

  // Admin Command: /broadcast (in admin group)
  bot.command("broadcast", async (ctx) => {
    if (ctx.chat.id !== adminGroupChatId) return;
    const user = ctx.from;
    if (!user || !adminUserIds.includes(user.id)) {
      await ctx.reply("You do not have permission to execute this command.");
      return;
    }

    const replied = ctx.message?.reply_to_message;
    if (!replied) {
      await ctx.reply("Please reply to the message you want to broadcast with /broadcast.");
      return;
    }

    const userIds = await db.getAllUserIds();
    await ctx.reply(`Starting broadcast to ${userIds.length} users in the background...`);

    let success = 0;
    let failed = 0;

    for (const uid of userIds) {
      try {
        await ctx.api.copyMessage(uid, adminGroupChatId, replied.message_id);
        success++;
      } catch (err) {
        failed++;
      }
    }

    await ctx.reply(`Broadcast finished:\n✅ Success: ${success}\n❌ Failed: ${failed}`);
  });

  // Handler: Customer -> Bot -> Admin Supergroup Topic
  bot.on("message", async (ctx, next) => {
    if (ctx.chat.type !== "private") {
      return next();
    }

    const user = ctx.from;
    if (!user) return;

    await db.upsertUser({
      user_id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      username: user.username,
      is_premium: user.is_premium,
    });

    const userRecord = await db.getUser(user.id);
    if (userRecord?.is_banned) {
      await ctx.reply("You have been banned from contacting admin.");
      return;
    }

    const settings = await db.getSettings(env);

    // 1. Captcha Check
    if (settings.TGC_DISABLE_CAPTCHA !== 1 && !userRecord?.is_verified) {
      const sent = await sendCaptchaChallenge(user.id, ctx.chat.id);
      if (sent) return;

      const sessionDO = getSessionDO(user.id);
      const statusRes = await sessionDO.fetch(new Request("https://do/status"));
      const status = (await statusRes.json()) as { isHuman: boolean; isMuted: boolean };
      if (!status.isHuman || status.isMuted) {
        return;
      }
    }

    // 2. Rate Limit Check
    if (settings.TGC_MESSAGE_INTERVAL > 0) {
      const sessionDO = getSessionDO(user.id);
      const rateLimitRes = await sessionDO.fetch(
        new Request("https://do/check-rate-limit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ intervalSec: settings.TGC_MESSAGE_INTERVAL }),
        }),
      );
      const rateLimit = (await rateLimitRes.json()) as { allowed: boolean };
      if (!rateLimit.allowed) {
        await ctx.reply("Please do not send messages too frequently.");
        return;
      }
    }

    // 3. Ensure Forum Topic Exists
    let threadId = userRecord?.message_thread_id || 0;

    // Check if topic is marked closed
    if (threadId > 0) {
      const forumStatus = await db.getForumStatus(threadId);
      if (forumStatus?.status === "closed") {
        await ctx.reply("Admin has closed this conversation. Please contact through other channels to reopen.");
        return;
      }
    }

    if (threadId === 0) {
      try {
        const topicName = `${user.first_name || "User"} | ${user.id}`;
        const newTopic = await ctx.api.createForumTopic(adminGroupChatId, topicName);
        threadId = newTopic.message_thread_id;

        await db.updateUserThreadId(user.id, threadId);
        await db.setForumStatus(adminGroupChatId, threadId, "opened");

        // Send introduction and contact card
        const mention = getMentionHtml(user.id, user.first_name);
        await ctx.api.sendMessage(
          adminGroupChatId,
          `New customer conversation started by ${mention} (<code>${user.id}</code>).`,
          { message_thread_id: threadId, parse_mode: "HTML" },
        );

        // Contact card buttons
        const cardKeyboard = new InlineKeyboard();
        cardKeyboard.url(
          user.is_premium ? "🏆 Premium Member" : "✈️ Standard Member",
          "https://t.me/" + (user.username || ""),
        );
        if (user.username) {
          cardKeyboard.row().url("👤 Direct Contact", `https://t.me/${user.username}`);
        }

        const profilePhotos = await ctx.api.getUserProfilePhotos(user.id, { limit: 1 });
        if (profilePhotos.total_count > 0) {
          const photoFileId = profilePhotos.photos[0][profilePhotos.photos[0].length - 1].file_id;
          await ctx.api.sendPhoto(adminGroupChatId, photoFileId, {
            caption: `👤 ${mention}\n\n📱 ID: <code>${user.id}</code>\n🔗 Username: ${user.username ? "@" + user.username : "None"}`,
            message_thread_id: threadId,
            reply_markup: cardKeyboard,
            parse_mode: "HTML",
          });
        } else {
          await ctx.api.sendContact(adminGroupChatId, "11111", user.first_name, {
            last_name: user.last_name || undefined,
            message_thread_id: threadId,
            reply_markup: cardKeyboard,
          });
        }
      } catch (err: any) {
        console.error("Failed to create forum topic:", err);
        await ctx.reply(`Failed to deliver message to admin: ${err?.message || err}`);
        return;
      }
    }

    // 4. Check for reply mapping
    let replyToGroupMessageId: number | undefined;
    if (ctx.message.reply_to_message) {
      const mapped = await db.getMapByUserMessageId(ctx.message.reply_to_message.message_id);
      if (mapped) {
        replyToGroupMessageId = mapped.group_chat_message_id;
      }
    }

    // 5. Forwarding: Media Group vs Single Message
    if (ctx.message.media_group_id) {
      const mediaDO = getMediaGroupDO(ctx.message.media_group_id);
      await mediaDO.fetch(
        new Request("https://do/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message_id: ctx.message.message_id,
            chat_id: ctx.chat.id,
            target_id: adminGroupChatId,
            direction: "u2a",
            message_thread_id: threadId,
            user_id: user.id,
          }),
        }),
      );
      return;
    }

    // Single Message forwarding
    try {
      const sent = await ctx.api.copyMessage(adminGroupChatId, ctx.chat.id, ctx.message.message_id, {
        message_thread_id: threadId,
        reply_to_message_id: replyToGroupMessageId,
      });

      await db.addMessageMap(ctx.message.message_id, sent.message_id, user.id);
    } catch (err: any) {
      console.error("Error in forwarding u2a:", err);
      if (err?.description?.includes("message thread not found") || err?.description?.includes("TOPIC_DELETED")) {
        if (settings.TGC_DELETE_TOPIC_AS_FOREVER_BAN === 1) {
          await ctx.reply("Failed to send: your conversation has been terminated by an administrator.");
        } else {
          await db.updateUserThreadId(user.id, 0);
          await ctx.reply(
            "Your previous conversation topic was removed. Please send your message again to start a new inquiry.",
          );
        }
      } else {
        await ctx.reply(`Delivery failed: ${err?.message || err}`);
      }
    }
  });

  // Handler: Admin Supergroup Topic -> Bot -> Customer
  bot.on("message", async (ctx) => {
    if (ctx.chat.id !== adminGroupChatId) return;

    const threadId = ctx.message?.message_thread_id;
    if (!threadId) return; // Ignore general topic messages

    const targetUser = await db.getUserByThreadId(threadId);
    if (!targetUser) return;

    // Handle topic lifecycle service messages
    if (ctx.message.forum_topic_created) {
      await db.setForumStatus(adminGroupChatId, threadId, "opened");
      return;
    }

    if (ctx.message.forum_topic_closed) {
      await db.setForumStatus(adminGroupChatId, threadId, "closed");
      await ctx.api.sendMessage(targetUser.user_id, "This conversation has been closed by admin.");
      return;
    }

    if (ctx.message.forum_topic_reopened) {
      await db.setForumStatus(adminGroupChatId, threadId, "opened");
      await ctx.api.sendMessage(targetUser.user_id, "Admin has reopened your conversation. You can now reply.");
      return;
    }

    const forumStatus = await db.getForumStatus(threadId);
    if (forumStatus?.status === "closed") {
      await ctx.reply(
        "This conversation is currently marked as closed. Reopen the topic in Telegram to resume chatting.",
      );
      return;
    }

    // Check for reply mapping
    let replyToUserMessageId: number | undefined;
    if (ctx.message.reply_to_message) {
      const mapped = await db.getMapByGroupMessageId(ctx.message.reply_to_message.message_id);
      if (mapped) {
        replyToUserMessageId = mapped.user_chat_message_id;
      }
    }

    // Media Group vs Single Message
    if (ctx.message.media_group_id) {
      const mediaDO = getMediaGroupDO(ctx.message.media_group_id);
      await mediaDO.fetch(
        new Request("https://do/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message_id: ctx.message.message_id,
            chat_id: ctx.chat.id,
            target_id: targetUser.user_id,
            direction: "a2u",
            user_id: targetUser.user_id,
          }),
        }),
      );
      return;
    }

    // Single message
    try {
      const sent = await ctx.api.copyMessage(targetUser.user_id, ctx.chat.id, ctx.message.message_id, {
        reply_to_message_id: replyToUserMessageId,
      });

      await db.addMessageMap(sent.message_id, ctx.message.message_id, targetUser.user_id);
    } catch (err: any) {
      console.error("Error forwarding a2u:", err);
      await ctx.reply(`Failed to send message to user: ${err?.message || err}`);
    }
  });

  return bot;
}
