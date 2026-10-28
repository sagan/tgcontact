import { Env, UserRecord, ForumStatusRecord, MessageMapRecord, BotSettings } from "../types";
import { MIGRATIONS } from "./migrations";

let schemaInitialized = false;

export async function ensureSchema(db?: D1Database): Promise<void> {
  if (schemaInitialized || !db) return;

  try {
    // Ensure standard D1 migrations tracking table exists
    await db.exec(`
      CREATE TABLE IF NOT EXISTS d1_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Fetch previously applied migrations
    const appliedRows = await db
      .prepare("SELECT name FROM d1_migrations")
      .all<{ name: string }>()
      .catch(() => ({ results: [] as { name: string }[] }));

    const appliedSet = new Set((appliedRows.results || []).map((r) => r.name));

    for (const migration of MIGRATIONS) {
      if (!appliedSet.has(migration.name)) {
        try {
          await db.exec(migration.sql);
        } catch (err) {
          console.warn(`db.exec batch migration failed for ${migration.name}, executing statements individually:`, err);
          const statements = migration.sql
            .split(";")
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
          for (const stmt of statements) {
            try {
              await db.prepare(stmt).run();
            } catch {
              // Ignore statement duplicate error
            }
          }
        }

        await db
          .prepare("INSERT OR IGNORE INTO d1_migrations (name) VALUES (?)")
          .bind(migration.name)
          .run()
          .catch(() => null);
      }
    }

    schemaInitialized = true;
  } catch (err) {
    console.error("Failed to run D1 migrations:", err);
  }
}

export class Database {
  constructor(private db?: D1Database) {}

  private async ensureInitialized(): Promise<void> {
    if (!schemaInitialized && this.db) {
      await ensureSchema(this.db);
    }
  }

  async getUser(userId: number): Promise<UserRecord | null> {
    if (!this.db) return null;
    await this.ensureInitialized();
    try {
      const res = await this.db.prepare("SELECT * FROM users WHERE user_id = ?").bind(userId).first<UserRecord>();
      return res;
    } catch {
      return null;
    }
  }

  async getUserByThreadId(threadId: number): Promise<UserRecord | null> {
    if (!this.db) return null;
    await this.ensureInitialized();
    try {
      const res = await this.db
        .prepare("SELECT * FROM users WHERE message_thread_id = ?")
        .bind(threadId)
        .first<UserRecord>();
      return res;
    } catch {
      return null;
    }
  }

  async upsertUser(user: {
    user_id: number;
    first_name?: string | null;
    last_name?: string | null;
    username?: string | null;
    is_premium?: boolean;
  }): Promise<void> {
    if (!this.db) return;
    await this.ensureInitialized();
    try {
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
    } catch (err) {
      console.error("Failed to upsert user:", err);
    }
  }

  async updateUserThreadId(userId: number, threadId: number): Promise<void> {
    if (!this.db) return;
    await this.ensureInitialized();
    try {
      await this.db
        .prepare("UPDATE users SET message_thread_id = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?")
        .bind(threadId, userId)
        .run();
    } catch (err) {
      console.error("Failed to update user thread ID:", err);
    }
  }

  async setUserBanned(userId: number, isBanned: boolean): Promise<void> {
    if (!this.db) return;
    await this.ensureInitialized();
    try {
      await this.db
        .prepare("UPDATE users SET is_banned = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?")
        .bind(isBanned ? 1 : 0, userId)
        .run();
    } catch (err) {
      console.error("Failed to set user banned status:", err);
    }
  }

  async setUserVerified(userId: number, isVerified: boolean): Promise<void> {
    if (!this.db) return;
    await this.ensureInitialized();
    try {
      await this.db
        .prepare("UPDATE users SET is_verified = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?")
        .bind(isVerified ? 1 : 0, userId)
        .run();
    } catch (err) {
      console.error("Failed to set user verified status:", err);
    }
  }

  async updateUserLastMessageTime(userId: number, timestampSec: number): Promise<void> {
    if (!this.db) return;
    await this.ensureInitialized();
    try {
      await this.db
        .prepare("UPDATE users SET last_message_at = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?")
        .bind(timestampSec, userId)
        .run();
    } catch (err) {
      console.error("Failed to update user last message time:", err);
    }
  }

  async listUsers(options?: {
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ users: UserRecord[]; total: number }> {
    if (!this.db) return { users: [], total: 0 };
    await this.ensureInitialized();
    const limit = options?.limit || 20;
    const offset = options?.offset || 0;
    const search = options?.search ? `%${options.search.trim()}%` : null;

    let total = 0;
    let users: UserRecord[] = [];

    try {
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
    } catch (err) {
      console.error("Failed to list users:", err);
    }

    return { users, total };
  }

  async getAllUserIds(): Promise<number[]> {
    if (!this.db) return [];
    await this.ensureInitialized();
    try {
      const res = await this.db.prepare("SELECT user_id FROM users WHERE is_banned = 0").all<{ user_id: number }>();
      return res.results.map((r) => r.user_id);
    } catch {
      return [];
    }
  }

  // Forum Status
  async getForumStatus(threadId: number): Promise<ForumStatusRecord | null> {
    if (!this.db) return null;
    await this.ensureInitialized();
    try {
      return await this.db
        .prepare("SELECT * FROM forum_status WHERE message_thread_id = ?")
        .bind(threadId)
        .first<ForumStatusRecord>();
    } catch {
      return null;
    }
  }

  async setForumStatus(chatId: number, threadId: number, status: "opened" | "closed"): Promise<void> {
    if (!this.db) return;
    await this.ensureInitialized();
    try {
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
    } catch (err) {
      console.error("Failed to set forum status:", err);
    }
  }

  async listForumTopics(): Promise<ForumStatusRecord[]> {
    if (!this.db) return [];
    await this.ensureInitialized();
    try {
      const res = await this.db
        .prepare("SELECT * FROM forum_status ORDER BY updated_at DESC LIMIT 50")
        .all<ForumStatusRecord>();
      return res.results;
    } catch {
      return [];
    }
  }

  // Message Map
  async addMessageMap(userMsgId: number, groupMsgId: number, userId: number): Promise<void> {
    if (!this.db) return;
    await this.ensureInitialized();
    try {
      await this.db
        .prepare(
          `INSERT INTO message_map (user_chat_message_id, group_chat_message_id, user_id)
           VALUES (?, ?, ?)`,
        )
        .bind(userMsgId, groupMsgId, userId)
        .run();
    } catch (err) {
      console.error("Failed to add message map:", err);
    }
  }

  async getMapByUserMessageId(userMsgId: number): Promise<MessageMapRecord | null> {
    if (!this.db) return null;
    await this.ensureInitialized();
    try {
      return await this.db
        .prepare("SELECT * FROM message_map WHERE user_chat_message_id = ?")
        .bind(userMsgId)
        .first<MessageMapRecord>();
    } catch {
      return null;
    }
  }

  async getMapByGroupMessageId(groupMsgId: number): Promise<MessageMapRecord | null> {
    if (!this.db) return null;
    await this.ensureInitialized();
    try {
      return await this.db
        .prepare("SELECT * FROM message_map WHERE group_chat_message_id = ?")
        .bind(groupMsgId)
        .first<MessageMapRecord>();
    } catch {
      return null;
    }
  }

  async getAllMessagesByUser(userId: number): Promise<MessageMapRecord[]> {
    if (!this.db) return [];
    await this.ensureInitialized();
    try {
      const res = await this.db
        .prepare("SELECT * FROM message_map WHERE user_id = ?")
        .bind(userId)
        .all<MessageMapRecord>();
      return res.results;
    } catch {
      return [];
    }
  }

  async listRecentMessageMaps(limit: number = 50): Promise<MessageMapRecord[]> {
    if (!this.db) return [];
    await this.ensureInitialized();
    try {
      const res = await this.db
        .prepare("SELECT * FROM message_map ORDER BY id DESC LIMIT ?")
        .bind(limit)
        .all<MessageMapRecord>();
      return res.results;
    } catch {
      return [];
    }
  }

  // Settings
  async getSettings(env: Env): Promise<BotSettings> {
    const fallbackSettings: BotSettings = {
      TGC_WELCOME_MESSAGE:
        env.TGC_WELCOME_MESSAGE || "Hello! Thanks for contacting us. We will reach out as soon as possible.",
      TGC_DISABLE_CAPTCHA: parseInt((env.TGC_DISABLE_CAPTCHA || "0") as string) || 0,
      TGC_MESSAGE_INTERVAL: parseInt((env.TGC_MESSAGE_INTERVAL || "5") as string) || 5,
      TGC_DELETE_TOPIC_AS_FOREVER_BAN: parseInt((env.TGC_DELETE_TOPIC_AS_FOREVER_BAN || "0") as string) || 0,
      TGC_DELETE_USER_MESSAGE_ON_CLEAR_CMD: parseInt((env.TGC_DELETE_USER_MESSAGE_ON_CLEAR_CMD || "1") as string) || 1,
    };

    if (!this.db) return fallbackSettings;
    await this.ensureInitialized();

    try {
      const rows = await this.db.prepare("SELECT key, value FROM bot_settings").all<{ key: string; value: string }>();
      const map = new Map<string, string>();
      for (const row of rows.results) {
        map.set(row.key, row.value);
      }

      return {
        TGC_WELCOME_MESSAGE: map.get("TGC_WELCOME_MESSAGE") || fallbackSettings.TGC_WELCOME_MESSAGE,
        TGC_DISABLE_CAPTCHA: parseInt((map.get("TGC_DISABLE_CAPTCHA") || env.TGC_DISABLE_CAPTCHA) as string) || 0,
        TGC_MESSAGE_INTERVAL: parseInt((map.get("TGC_MESSAGE_INTERVAL") || env.TGC_MESSAGE_INTERVAL) as string) || 5,
        TGC_DELETE_TOPIC_AS_FOREVER_BAN:
          parseInt((map.get("TGC_DELETE_TOPIC_AS_FOREVER_BAN") || env.TGC_DELETE_TOPIC_AS_FOREVER_BAN) as string) || 0,
        TGC_DELETE_USER_MESSAGE_ON_CLEAR_CMD:
          parseInt(
            (map.get("TGC_DELETE_USER_MESSAGE_ON_CLEAR_CMD") || env.TGC_DELETE_USER_MESSAGE_ON_CLEAR_CMD) as string,
          ) || 1,
      };
    } catch {
      return fallbackSettings;
    }
  }

  async updateSetting(key: string, value: string): Promise<void> {
    if (!this.db) return;
    await this.ensureInitialized();
    try {
      await this.db
        .prepare(
          `INSERT INTO bot_settings (key, value, updated_at)
           VALUES (?1, ?2, CURRENT_TIMESTAMP)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
        )
        .bind(key, value)
        .run();
    } catch (err) {
      console.error("Failed to update setting:", err);
    }
  }

  // Stats
  async getStats(): Promise<{
    totalUsers: number;
    bannedUsers: number;
    openTopics: number;
    closedTopics: number;
    totalMessagesMapped: number;
  }> {
    const emptyStats = {
      totalUsers: 0,
      bannedUsers: 0,
      openTopics: 0,
      closedTopics: 0,
      totalMessagesMapped: 0,
    };

    if (!this.db) return emptyStats;
    await this.ensureInitialized();

    try {
      const [users, banned, open, closed, msgs] = await Promise.all([
        this.db
          .prepare("SELECT COUNT(*) as c FROM users")
          .first<{ c: number }>()
          .catch(() => ({ c: 0 })),
        this.db
          .prepare("SELECT COUNT(*) as c FROM users WHERE is_banned = 1")
          .first<{ c: number }>()
          .catch(() => ({ c: 0 })),
        this.db
          .prepare("SELECT COUNT(*) as c FROM forum_status WHERE status = 'opened'")
          .first<{ c: number }>()
          .catch(() => ({ c: 0 })),
        this.db
          .prepare("SELECT COUNT(*) as c FROM forum_status WHERE status = 'closed'")
          .first<{ c: number }>()
          .catch(() => ({ c: 0 })),
        this.db
          .prepare("SELECT COUNT(*) as c FROM message_map")
          .first<{ c: number }>()
          .catch(() => ({ c: 0 })),
      ]);

      return {
        totalUsers: users?.c || 0,
        bannedUsers: banned?.c || 0,
        openTopics: open?.c || 0,
        closedTopics: closed?.c || 0,
        totalMessagesMapped: msgs?.c || 0,
      };
    } catch (err) {
      console.error("Failed to fetch stats:", err);
      return emptyStats;
    }
  }
}
