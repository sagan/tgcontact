import { Env } from "../types";

export class SessionDO implements DurableObject {
  private state: DurableObjectState;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/check-rate-limit" && request.method === "POST") {
      const { intervalSec } = (await request.json()) as { intervalSec: number };
      const now = Date.now();
      const lastTime = ((await this.state.storage.get("last_message_time")) as number) || 0;

      if (intervalSec > 0 && now - lastTime < intervalSec * 1000) {
        return Response.json({
          allowed: false,
          remainingSec: Math.ceil((intervalSec * 1000 - (now - lastTime)) / 1000),
        });
      }

      await this.state.storage.put("last_message_time", now);
      return Response.json({ allowed: true });
    }

    if (url.pathname === "/set-captcha" && request.method === "POST") {
      const data = (await request.json()) as {
        code: string;
        chat_id: number;
        message_id: number;
      };

      await this.state.storage.put("captcha", {
        code: data.code,
        chat_id: data.chat_id,
        message_id: data.message_id,
        created_at: Date.now(),
      });

      // Set alarm to clean up the captcha prompt after 60 seconds
      await this.state.storage.setAlarm(Date.now() + 60000);

      return Response.json({ success: true });
    }

    if (url.pathname === "/verify-captcha" && request.method === "POST") {
      const { answer } = (await request.json()) as { answer: string };
      const captcha = (await this.state.storage.get("captcha")) as {
        code: string;
        chat_id: number;
        message_id: number;
      } | null;

      const muteUntil = ((await this.state.storage.get("mute_until")) as number) || 0;
      if (Date.now() < muteUntil) {
        return Response.json({
          success: false,
          muted: true,
          remainingSec: Math.ceil((muteUntil - Date.now()) / 1000),
        });
      }

      if (!captcha) {
        return Response.json({ success: false, expired: true });
      }

      if (captcha.code === answer) {
        // Success
        await this.state.storage.delete("captcha");
        await this.state.storage.put("is_human", true);
        return Response.json({
          success: true,
          chat_id: captcha.chat_id,
          message_id: captcha.message_id,
        });
      } else {
        // Fail: mute for 2 minutes
        const muteExpiry = Date.now() + 120000;
        await this.state.storage.put("mute_until", muteExpiry);
        await this.state.storage.delete("captcha");
        return Response.json({
          success: false,
          wrong: true,
          chat_id: captcha.chat_id,
          message_id: captcha.message_id,
        });
      }
    }

    if (url.pathname === "/status" && request.method === "GET") {
      const isHuman = ((await this.state.storage.get("is_human")) as boolean) || false;
      const muteUntil = ((await this.state.storage.get("mute_until")) as number) || 0;
      const isMuted = Date.now() < muteUntil;
      const captcha = await this.state.storage.get("captcha");

      return Response.json({
        isHuman,
        isMuted,
        hasPendingCaptcha: !!captcha,
      });
    }

    return new Response("Not found", { status: 404 });
  }

  async alarm(): Promise<void> {
    // Delete expired captcha message
    const captcha = (await this.state.storage.get("captcha")) as {
      chat_id: number;
      message_id: number;
    } | null;

    if (captcha && this.env.BOT_TOKEN) {
      try {
        await fetch(`https://api.telegram.org/bot${this.env.BOT_TOKEN}/deleteMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: captcha.chat_id,
            message_id: captcha.message_id,
          }),
        });
      } catch (err) {
        // Ignore deletion errors
      }
      await this.state.storage.delete("captcha");
    }
  }
}
