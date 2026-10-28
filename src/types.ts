export interface Env {
  // Cloudflare D1
  DB: D1Database;

  // Cloudflare Durable Objects
  MEDIA_GROUP_DO: DurableObjectNamespace;
  SESSION_DO: DurableObjectNamespace;

  // Static Assets
  ASSETS: Fetcher;

  // Environment variables
  TGC_NAME?: string;
  TGC_BOT_TOKEN: string;
  TGC_ADMIN_GROUP_ID?: string;
  TGC_ADMIN_USER_IDS?: string;
  TGC_WELCOME_MESSAGE?: string;
  TGC_DELETE_TOPIC_AS_FOREVER_BAN?: string;
  TGC_DELETE_USER_MESSAGE_ON_CLEAR_CMD?: string;
  TGC_DISABLE_CAPTCHA?: string;
  TGC_MESSAGE_INTERVAL?: string;
  TGC_USERNAME?: string;
  TGC_PASSWORD?: string;
  TGC_SECRET?: string;
  TGC_WEBHOOK_SECRET?: string;
}

export interface UserRecord {
  id: number;
  user_id: number;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  is_premium: number;
  message_thread_id: number;
  is_banned: number;
  is_verified: number;
  last_message_at: number;
  created_at: string;
  updated_at: string;
}

export interface ForumStatusRecord {
  id: number;
  chat_id: number;
  message_thread_id: number;
  status: "opened" | "closed";
  updated_at: string;
}

export interface MessageMapRecord {
  id: number;
  user_chat_message_id: number;
  group_chat_message_id: number;
  user_id: number;
  created_at: string;
}

export interface BotSettings {
  /**
   * Welcome message.
   */
  TGC_WELCOME_MESSAGE: string;
  /**
   * Disable captcha. Defaults to 0 (false).
   */
  TGC_DISABLE_CAPTCHA: number;
  /**
   * Telegram Message interval in seconds. Defaults to 5.
   */
  TGC_MESSAGE_INTERVAL: number;
  /**
   * Delete topic as forever ban. Defaults to 0 (false).
   */
  TGC_DELETE_TOPIC_AS_FOREVER_BAN: number;
  /**
   * Delete user message on clear command. Defaults to 1 (true).
   */
  TGC_DELETE_USER_MESSAGE_ON_CLEAR_CMD: number;
}
