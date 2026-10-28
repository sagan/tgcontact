import { Env, UserRecord, ForumStatusRecord, MessageMapRecord, BotSettings } from "../types";

export class Database {
  constructor(private db: D1Database) {}

  async getUser(userId: number): Promise<UserRecord | null> {
    const res = await this.db.prepare("SELECT * FROM users WHERE user_id = ?").bind(userId).first<UserRecord>();
    return res;
  }

  async getUserByThreadId(threadId: number): Promise<UserRecord | null> {
    const res = await this.db
      .prepare("SELECT * FROM users WHERE message_thread_id = ?")
      .bind(threadId)
      .first<UserRecord>();
    return res;
  }

  async upsertUser(user: {
    user_id: number;
    first_name?: string | null;
    last_name?: string | null;
    username?: string | null;
    is_premium?: boolean;
  }): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO users (user_id, first_name, last_name, username, is_premium, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, CURRENT_TIMESTAMP)
         ON CONFLICT(user_id) DO UPDATE SET
           first_name = excluded.first_name,
           last_name = excluded.last_name,
           username = excluded.username,
           is_premium = excluded.is_premium,
           updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(
        user.user_id,
        user.first_name || null,
        user.last_name || null,
        user.username || null,
        user.is_premium ? 1 : 0,
      )
      .run();
  }

  async updateUserThreadId(userId: number, threadId: number): Promise<void> {
    await this.db
      .prepare("UPDATE users SET message_thread_id = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?")
      .bind(threadId, userId)
      .run();
  }

  async setUserBanned(userId: number, isBanned: boolean): Promise<void> {
    await this.db
      .prepare("UPDATE users SET is_banned = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?")
      .bind(isBanned ? 1 : 0, userId)
      .run();
  }

  async setUserVerified(userId: number, isVerified: boolean): Promise<void> {
    await this.db
      .prepare("UPDATE users SET is_verified = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?")
      .bind(isVerified ? 1 : 0, userId)
      .run();
  }

  async updateUserLastMessageTime(userId: number, timestampSec: number): Promise<void> {
    await this.db
      .prepare("UPDATE users SET last_message_at = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?")
      .bind(timestampSec, userId)
      .run();
  }

  async listUsers(options?: {
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ users: UserRecord[]; total: number }> {
    const limit = options?.limit || 20;
    const offset = options?.offset || 0;
    const search = options?.search ? `%${options.search.trim()}%` : null;

    let total = 0;
    let users: UserRecord[] = [];

    if (search) {
      const countRes = await this.db
        .prepare(
          `SELECT COUNT(*) as count FROM users 
           WHERE user_id LIKE ? OR first_name LIKE ? OR username LIKE ?`,
        )
        .bind(search, search, search)
        .first<{ count: number }>();
      total = countRes?.count || 0;

      const results = await this.db
        .prepare(
          `SELECT * FROM users 
           WHERE user_id LIKE ? OR first_name LIKE ? OR username LIKE ? 
           ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
        )
        .bind(search, search, search, limit, offset)
        .all<UserRecord>();
      users = results.results;
    } else {
      const countRes = await this.db.prepare("SELECT COUNT(*) as count FROM users").first<{ count: number }>();
      total = countRes?.count || 0;

      const results = await this.db
        .prepare("SELECT * FROM users ORDER BY updated_at DESC LIMIT ? OFFSET ?")
        .bind(limit, offset)
        .all<UserRecord>();
      users = results.results;
    }

    return { users, total };
  }

  async getAllUserIds(): Promise<number[]> {
    const res = await this.db.prepare("SELECT user_id FROM users WHERE is_banned = 0").all<{ user_id: number }>();
    return res.results.map((r) => r.user_id);
  }

  // Forum Status
  async getForumStatus(threadId: number): Promise<ForumStatusRecord | null> {
    return await this.db
      .prepare("SELECT * FROM forum_status WHERE message_thread_id = ?")
      .bind(threadId)
      .first<ForumStatusRecord>();
  }

  async setForumStatus(chatId: number, threadId: number, status: "opened" | "closed"): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO forum_status (chat_id, message_thread_id, status, updated_at)
         VALUES (?1, ?2, ?3, CURRENT_TIMESTAMP)
         ON CONFLICT(message_thread_id) DO UPDATE SET
           status = excluded.status,
           updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(chatId, threadId, status)
      .run();
  }

  async listForumTopics(): Promise<ForumStatusRecord[]> {
    const res = await this.db
      .prepare("SELECT * FROM forum_status ORDER BY updated_at DESC LIMIT 50")
      .all<ForumStatusRecord>();
    return res.results;
  }

  // Message Map
  async addMessageMap(userMsgId: number, groupMsgId: number, userId: number): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO message_map (user_chat_message_id, group_chat_message_id, user_id)
         VALUES (?, ?, ?)`,
      )
      .bind(userMsgId, groupMsgId, userId)
      .run();
  }

  async getMapByUserMessageId(userMsgId: number): Promise<MessageMapRecord | null> {
    return await this.db
      .prepare("SELECT * FROM message_map WHERE user_chat_message_id = ?")
      .bind(userMsgId)
      .first<MessageMapRecord>();
  }

  async getMapByGroupMessageId(groupMsgId: number): Promise<MessageMapRecord | null> {
    return await this.db
      .prepare("SELECT * FROM message_map WHERE group_chat_message_id = ?")
      .bind(groupMsgId)
      .first<MessageMapRecord>();
  }

  async getAllMessagesByUser(userId: number): Promise<MessageMapRecord[]> {
    const res = await this.db
      .prepare("SELECT * FROM message_map WHERE user_id = ?")
      .bind(userId)
      .all<MessageMapRecord>();
    return res.results;
  }

  async listRecentMessageMaps(limit: number = 50): Promise<MessageMapRecord[]> {
    const res = await this.db
      .prepare("SELECT * FROM message_map ORDER BY id DESC LIMIT ?")
      .bind(limit)
      .all<MessageMapRecord>();
    return res.results;
  }

  // Settings
  async getSettings(env: Env): Promise<BotSettings> {
    const rows = await this.db.prepare("SELECT key, value FROM bot_settings").all<{ key: string; value: string }>();
    const map = new Map<string, string>();
    for (const row of rows.results) {
      map.set(row.key, row.value);
    }

    return {
      WELCOME_MESSAGE: map.get("WELCOME_MESSAGE") ?? env.WELCOME_MESSAGE ?? "Hello! Thanks for reaching out.",
      DISABLE_CAPTCHA: map.get("DISABLE_CAPTCHA") ?? env.DISABLE_CAPTCHA ?? "FALSE",
      MESSAGE_INTERVAL: map.get("MESSAGE_INTERVAL") ?? env.MESSAGE_INTERVAL ?? "5",
      DELETE_TOPIC_AS_FOREVER_BAN: map.get("DELETE_TOPIC_AS_FOREVER_BAN") ?? env.DELETE_TOPIC_AS_FOREVER_BAN ?? "FALSE",
      DELETE_USER_MESSAGE_ON_CLEAR_CMD:
        map.get("DELETE_USER_MESSAGE_ON_CLEAR_CMD") ?? env.DELETE_USER_MESSAGE_ON_CLEAR_CMD ?? "TRUE",
    };
  }

  async updateSetting(key: string, value: string): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO bot_settings (key, value, updated_at)
         VALUES (?1, ?2, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(key, value)
      .run();
  }

  // Stats
  async getStats(): Promise<{
    totalUsers: number;
    bannedUsers: number;
    openTopics: number;
    closedTopics: number;
    totalMessagesMapped: number;
  }> {
    const [users, banned, open, closed, msgs] = await Promise.all([
      this.db.prepare("SELECT COUNT(*) as c FROM users").first<{ c: number }>(),
      this.db.prepare("SELECT COUNT(*) as c FROM users WHERE is_banned = 1").first<{ c: number }>(),
      this.db.prepare("SELECT COUNT(*) as c FROM forum_status WHERE status = 'opened'").first<{ c: number }>(),
      this.db.prepare("SELECT COUNT(*) as c FROM forum_status WHERE status = 'closed'").first<{ c: number }>(),
      this.db.prepare("SELECT COUNT(*) as c FROM message_map").first<{ c: number }>(),
    ]);

    return {
      totalUsers: users?.c || 0,
      bannedUsers: banned?.c || 0,
      openTopics: open?.c || 0,
      closedTopics: closed?.c || 0,
      totalMessagesMapped: msgs?.c || 0,
    };
  }
}
