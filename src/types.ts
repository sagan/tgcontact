export interface Env {
  // Cloudflare D1
  DB: D1Database;

  // Cloudflare Durable Objects
  MEDIA_GROUP_DO: DurableObjectNamespace;
  SESSION_DO: DurableObjectNamespace;

  // Static Assets
  ASSETS: Fetcher;

  // Environment variables
  APP_NAME?: string;
  BOT_TOKEN: string;
  ADMIN_GROUP_ID?: string;
  ADMIN_USER_IDS?: string;
  WELCOME_MESSAGE?: string;
  DELETE_TOPIC_AS_FOREVER_BAN?: string;
  DELETE_USER_MESSAGE_ON_CLEAR_CMD?: string;
  DISABLE_CAPTCHA?: string;
  MESSAGE_INTERVAL?: string;
  ADMIN_WEB_USERNAME?: string;
  ADMIN_WEB_PASSWORD?: string;
  JWT_SECRET?: string;
  WEBHOOK_SECRET?: string;
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
  WELCOME_MESSAGE: string;
  DISABLE_CAPTCHA: string;
  MESSAGE_INTERVAL: string;
  DELETE_TOPIC_AS_FOREVER_BAN: string;
  DELETE_USER_MESSAGE_ON_CLEAR_CMD: string;
}
