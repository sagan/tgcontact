export interface UserItem {
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

export interface StatsResponse {
  totalUsers: number;
  bannedUsers: number;
  openTopics: number;
  closedTopics: number;
  totalMessagesMapped: number;
}

export interface WebhookInfo {
  url: string;
  hasCustomCertificate?: boolean;
  pendingUpdateCount?: number;
  lastErrorDate?: number;
  lastErrorMessage?: string;
}

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

export interface BotInfoResponse {
  bot: {
    id: number;
    username: string;
    firstName: string;
    canJoinGroups: boolean;
  };
  adminGroupId: string;
  adminGroupTitle: string;
  adminGroupError: string | null;
  adminGroupCheck?: AdminGroupCheck | null;
  webhookInfo?: WebhookInfo | null;
}

export interface EnvVarStatus {
  isSet: boolean;
  value?: string;
  preview?: string;
  count?: number;
  fallback?: string | null;
}

export interface ConfigStatusResponse {
  env: {
    TGC_BOT_TOKEN: EnvVarStatus;
    TGC_ADMIN_GROUP_ID: EnvVarStatus;
    TGC_ADMIN_USER_IDS: EnvVarStatus;
    TGC_USERNAME: EnvVarStatus;
    TGC_PASSWORD: EnvVarStatus;
    TGC_SECRET: EnvVarStatus;
    TGC_WEBHOOK_SECRET: EnvVarStatus;
  };
  botInfo?: {
    id: number;
    username: string;
    firstName: string;
  } | null;
  adminGroupCheck?: AdminGroupCheck | null;
  webhookInfo?: WebhookInfo | null;
  botError?: string | null;
}

export interface TestConfigResponse {
  success: boolean;
  results: {
    botVerified: boolean;
    bot?: { id: number; username: string; firstName: string };
    adminGroup?: AdminGroupCheck;
    adminUsers?: { checked: boolean; attempted: number; delivered: number; details: string[]; error?: string };
    webhook?: WebhookInfo | null;
    summary: string;
  };
}

export interface TopicItem {
  id: number;
  chat_id: number;
  message_thread_id: number;
  status: "opened" | "closed";
  updated_at: string;
}

export interface MessageMapItem {
  id: number;
  user_chat_message_id: number;
  group_chat_message_id: number;
  user_id: number;
  created_at: string;
}

export interface BotSettings {
  TGC_WELCOME_MESSAGE: string;
  TGC_DISABLE_CAPTCHA: number;
  TGC_MESSAGE_INTERVAL: string;
  TGC_DELETE_TOPIC_AS_FOREVER_BAN: number;
  TGC_DELETE_USER_MESSAGE_ON_CLEAR_CMD: number;
}

class ApiClient {
  private getToken(): string | null {
    return localStorage.getItem("tg_admin_token");
  }

  private setToken(token: string | null) {
    if (token) {
      localStorage.setItem("tg_admin_token", token);
    } else {
      localStorage.removeItem("tg_admin_token");
    }
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  logout() {
    this.setToken(null);
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(endpoint, {
      ...options,
      headers,
    });

    if (res.status === 401) {
      const err = await res.json().catch(() => ({ error: "Unauthorized" }));
      if (endpoint === "/api/auth/login") {
        throw new Error(err.error || "Invalid username or password");
      }
      this.logout();
      window.location.reload();
      throw new Error(err.error || "Unauthorized: Session expired");
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Request failed" }));
      throw new Error(err.error || `HTTP error ${res.status}`);
    }

    return (await res.json()) as T;
  }

  async login(username: string, password: string): Promise<{ token: string; username: string }> {
    const data = await this.request<{ token: string; username: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    this.setToken(data.token);
    return data;
  }

  async getStats(): Promise<StatsResponse> {
    return this.request<StatsResponse>("/api/admin/stats");
  }

  async getBotInfo(): Promise<BotInfoResponse> {
    return this.request<BotInfoResponse>("/api/admin/bot-info");
  }

  async configureWebhook(origin: string = window.location.origin): Promise<{
    success: boolean;
    message: string;
    webhookUrl: string;
    info?: any;
  }> {
    return this.request("/api/admin/webhook/configure", {
      method: "POST",
      body: JSON.stringify({ origin }),
    });
  }

  async getWebhookInfo(): Promise<{ success: boolean; info: any }> {
    return this.request("/api/admin/webhook/info");
  }

  async getConfigStatus(): Promise<ConfigStatusResponse> {
    return this.request<ConfigStatusResponse>("/api/admin/config/status");
  }

  async testTelegramConfig(): Promise<TestConfigResponse> {
    return this.request<TestConfigResponse>("/api/admin/bot/test", {
      method: "POST",
    });
  }

  async getUsers(
    page = 1,
    limit = 20,
    search = "",
  ): Promise<{
    users: UserItem[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const query = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      search,
    });
    return this.request(`/api/admin/users?${query.toString()}`);
  }

  async banUser(userId: number, isBanned: boolean): Promise<void> {
    await this.request(`/api/admin/users/${userId}/ban`, {
      method: "POST",
      body: JSON.stringify({ isBanned }),
    });
  }

  async sendDirectMessage(userId: number, message: string): Promise<void> {
    await this.request(`/api/admin/users/${userId}/send`, {
      method: "POST",
      body: JSON.stringify({ message }),
    });
  }

  async getTopics(): Promise<{ topics: TopicItem[] }> {
    return this.request<{ topics: TopicItem[] }>("/api/admin/topics");
  }

  async toggleTopic(threadId: number, status: "opened" | "closed"): Promise<void> {
    await this.request(`/api/admin/topics/${threadId}/toggle`, {
      method: "POST",
      body: JSON.stringify({ status }),
    });
  }

  async getMessages(limit = 50): Promise<{ messages: MessageMapItem[] }> {
    return this.request<{ messages: MessageMapItem[] }>(`/api/admin/messages?limit=${limit}`);
  }

  async getSettings(): Promise<{ settings: BotSettings }> {
    return this.request<{ settings: BotSettings }>("/api/admin/settings");
  }

  async saveSettings(settings: Partial<BotSettings>): Promise<{ settings: BotSettings }> {
    return this.request<{ settings: BotSettings }>("/api/admin/settings", {
      method: "POST",
      body: JSON.stringify(settings),
    });
  }

  async broadcast(message: string): Promise<{
    total: number;
    sent: number;
    failed: number;
  }> {
    return this.request("/api/admin/broadcast", {
      method: "POST",
      body: JSON.stringify({ message }),
    });
  }
}

export const api = new ApiClient();
