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
  WELCOME_MESSAGE: string;
  DISABLE_CAPTCHA: string;
  MESSAGE_INTERVAL: string;
  DELETE_TOPIC_AS_FOREVER_BAN: string;
  DELETE_USER_MESSAGE_ON_CLEAR_CMD: string;
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
      this.logout();
      window.location.reload();
      throw new Error("Unauthorized: Session expired");
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
