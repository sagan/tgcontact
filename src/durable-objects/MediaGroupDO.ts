import { Env } from "../types";
import { Database } from "../db";

interface MediaItem {
  message_id: number;
  chat_id: number;
  target_id: number;
  direction: "u2a" | "a2u";
  message_thread_id?: number;
  user_id: number;
}

export class MediaGroupDO implements DurableObject {
  private state: DurableObjectState;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/add" && request.method === "POST") {
      const data = (await request.json()) as MediaItem;

      // Get existing media items
      const items: MediaItem[] = (await this.state.storage.get("items")) || [];
      items.push(data);
      await this.state.storage.put("items", items);

      // Debounce: reset alarm for 3 seconds from now
      await this.state.storage.setAlarm(Date.now() + 3000);

      return new Response(JSON.stringify({ success: true, count: items.length }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not found", { status: 404 });
  }

  async alarm(): Promise<void> {
    const items: MediaItem[] = (await this.state.storage.get("items")) || [];
    if (!items.length) return;

    try {
      const first = items[0];
      const messageIds = items.map((i) => i.message_id);
      const botToken = this.env.TGC_BOT_TOKEN;

      const payload: Record<string, unknown> = {
        chat_id: first.target_id,
        from_chat_id: first.chat_id,
        message_ids: messageIds,
      };

      if (first.direction === "u2a" && first.message_thread_id) {
        payload.message_thread_id = first.message_thread_id;
      }

      // Send via Telegram copyMessages
      const res = await fetch(`https://api.telegram.org/bot${botToken}/copyMessages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = (await res.json()) as { ok: boolean; result?: Array<{ message_id: number }> };

      if (json.ok && json.result && json.result.length === items.length) {
        const db = new Database(this.env.DB);
        for (let i = 0; i < items.length; i++) {
          const sentMsgId = json.result[i].message_id;
          const origMsgId = items[i].message_id;

          if (first.direction === "u2a") {
            await db.addMessageMap(origMsgId, sentMsgId, first.user_id);
          } else {
            await db.addMessageMap(sentMsgId, origMsgId, first.user_id);
          }
        }
      }
    } catch (err) {
      console.error("Failed to copy media group in MediaGroupDO:", err);
    } finally {
      // Clear storage
      await this.state.storage.deleteAll();
    }
  }
}
