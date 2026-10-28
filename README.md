# Telegram Interactive Customer Support Bot (Cloudflare Serverless Edition)

A high-performance, serverless rewrite of [Telegram-interactive-bot](https://github.com/MiHaKun/Telegram-interactive-bot) designed to run **100% on Cloudflare's Free Tier** (Workers + D1 + Durable Objects + Static Assets).

Includes a built-in **React & Material UI Administration Web Portal**.

---

## 🌟 Key Architecture & Features

### 1. Cloudflare Free Plan Architecture

- **Cloudflare Workers**: Edge runtime processing incoming Telegram updates via HTTPS Webhooks (sub-millisecond cold starts, zero server maintenance).
- **Cloudflare D1 (Native Edge SQLite)**: Persistent storage for customers, topic threads, message ID relay maps, and audit logs.
- **Cloudflare Durable Objects (DO)**:
  - `MediaGroupDO`: Handles Telegram album/media group debouncing using **DO Alarms**, solving the classic Serverless race condition when users upload multiple photos at once.
  - `SessionDO`: State machine for rate-limiting, captcha challenge expiration, and 2-minute temporary mute timers.
- **Workers Static Assets**:
  - Hosts the 100 anti-spam captcha challenge images directly under `/captcha/*.png`.
  - Serves the built Vite + React + Material UI administration dashboard from `/`.

### 2. Full Parity with Original Python Bot

- **Topic Thread Routing**: When a customer messages the bot, a dedicated Forum Topic is automatically opened in your Telegram Supergroup.
- **Bidirectional Relay**: Admin replies inside the topic are seamlessly forwarded back to the customer.
- **Reply-to Mapping**: Preserves message quote chains (`message_map` table).
- **Album / Media Group Forwarding**: Buffered and dispatched via `copyMessages`.
- **Anti-Bot Captcha**: Visual challenge with 8 inline buttons matching image text.
- **Rate-Limiting**: Configurable message interval throttling per customer.
- **Moderation Commands**: `/clear` to delete topic and optionally purge customer chat history; `/broadcast` to blast announcements.

### 3. Dedicated Admin Web Portal

- **Dashboard**: Real-time telemetry, active topic count, message volume, and Telegram bot health.
- **User Directory**: Search, inspect topic IDs, ban/unban users, and send direct messages right from the browser.
- **Forum Topics Management**: Remotely view and toggle topics between Open and Closed.
- **Message Relay Audit Log**: Inspect correlated user and group message IDs.
- **Broadcast Center**: Compose and publish announcements to all non-banned customers.
- **Dynamic Bot Settings**: Modify welcome messages, rate limits, and captcha policies without redeploying Worker code.

---

## 🚀 Quick Start & Deployment Guide

### Prerequisites

- Node.js >= 18
- A Telegram Bot Token from [@BotFather](https://t.me/BotFather)
- A Telegram Supergroup with **Forum Topics enabled**, with your bot added as Administrator (with `Manage Topics` and `Delete Messages` permissions).

### Step 1: Install Dependencies & Build Frontend

```bash
cd tg-interactive-worker
npm install
npm run build
```

### Step 2: Create Cloudflare D1 Database

Create the D1 database:

```bash
npx wrangler d1 create tg-bot-db
```

Copy the output `database_id` into `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "tg-bot-db"
database_id = "<YOUR_D1_DATABASE_ID>"
```

### Step 3: Run Database Migrations

Initialize the tables in D1:

```bash
# For local testing:
npx wrangler d1 execute tg-bot-db --local --file=./schema.sql

# For production deployment:
npx wrangler d1 execute tg-bot-db --remote --file=./schema.sql
```

### Step 4: Configure Environment Variables

Open [wrangler.toml](file:///root/projects/tgcontact/tg-interactive-worker/wrangler.toml) and update the variables:

```toml
[vars]
BOT_TOKEN = "123456789:ABCDefghIJKLmnOPQRstuvWXyz"
ADMIN_GROUP_ID = "-1002234110823"  # Your Supergroup ID (starts with -100)
ADMIN_USER_IDS = "1281631753"       # Comma-separated Admin Telegram User IDs
WELCOME_MESSAGE = "Hello! Thanks for reaching out. How can I help you today?"
ADMIN_WEB_USERNAME = "admin"
ADMIN_WEB_PASSWORD = "your_secure_password"
JWT_SECRET = "generate_a_random_secret_string"
```

_(Tip: For production secrets, you can also use `npx wrangler secret put BOT_TOKEN`)_

### Step 5: Deploy to Cloudflare Workers

```bash
npm run deploy
```

Once deployed, Cloudflare will output your worker URL (e.g., `https://tg-interactive-worker.<your-subdomain>.workers.dev`).

### Step 6: Configure Telegram Webhook

Register your Cloudflare Worker URL with Telegram:

```bash
curl -F "url=https://<YOUR_WORKER_SUBDOMAIN>.workers.dev/webhook" https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook
```

You can also open the Web UI at `https://<YOUR_WORKER_SUBDOMAIN>.workers.dev/` and use the built-in **Webhook Setup Guide**.

---

## 🖥️ Admin Web Portal Access

Navigate to your deployed worker URL (or `http://localhost:8787` during local dev):

- **URL**: `https://<YOUR_WORKER_SUBDOMAIN>.workers.dev/`
- **Default Username**: `admin` (or what you configured in `ADMIN_WEB_USERNAME`)
- **Default Password**: `admin_password_change_me` (or what you configured in `ADMIN_WEB_PASSWORD`)

---

## 🛠️ Local Development & Debugging

Run the worker locally with Wrangler (simulates D1 and Durable Objects locally):

```bash
npm run dev
```

To expose your local development server to Telegram's Webhook, you can use Cloudflare Tunnel or ngrok:

```bash
cloudflared tunnel --url http://localhost:8787
```

Then point your Telegram webhook to the temporary tunnel URL.
