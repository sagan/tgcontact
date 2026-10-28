-- Cloudflare D1 Database Schema for Telegram Interactive Bot

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL,
    first_name TEXT,
    last_name TEXT,
    username TEXT,
    is_premium INTEGER DEFAULT 0,
    message_thread_id INTEGER DEFAULT 0,
    is_banned INTEGER DEFAULT 0,
    is_verified INTEGER DEFAULT 0,
    last_message_at INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);
CREATE INDEX IF NOT EXISTS idx_users_thread_id ON users(message_thread_id);

CREATE TABLE IF NOT EXISTS forum_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL,
    message_thread_id INTEGER UNIQUE NOT NULL,
    status TEXT DEFAULT 'opened', -- 'opened' or 'closed'
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_forum_thread_id ON forum_status(message_thread_id);

CREATE TABLE IF NOT EXISTS message_map (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_chat_message_id INTEGER NOT NULL,
    group_chat_message_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_msg_map_user_msg ON message_map(user_chat_message_id);
CREATE INDEX IF NOT EXISTS idx_msg_map_group_msg ON message_map(group_chat_message_id);
CREATE INDEX IF NOT EXISTS idx_msg_map_user_id ON message_map(user_id);

CREATE TABLE IF NOT EXISTS broadcast_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_admin_id INTEGER,
    source_message_id INTEGER,
    total_targets INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    fail_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'completed',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bot_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Default settings matching the original python project
INSERT OR IGNORE INTO bot_settings (key, value) VALUES
    ('WELCOME_MESSAGE', 'Hello! Thanks for reaching out. An agent will respond to you shortly.'),
    ('DISABLE_CAPTCHA', 'FALSE'),
    ('MESSAGE_INTERVAL', '5'),
    ('DELETE_TOPIC_AS_FOREVER_BAN', 'FALSE'),
    ('DELETE_USER_MESSAGE_ON_CLEAR_CMD', 'TRUE');
