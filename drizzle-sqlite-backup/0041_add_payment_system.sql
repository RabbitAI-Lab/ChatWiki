-- plans 表新增字段
ALTER TABLE plans ADD COLUMN provider_prices TEXT NOT NULL DEFAULT '{}';
ALTER TABLE plans ADD COLUMN billing_mode TEXT NOT NULL DEFAULT 'subscription';

-- user_subscriptions 表新增字段
ALTER TABLE user_subscriptions ADD COLUMN provider TEXT;
ALTER TABLE user_subscriptions ADD COLUMN provider_subscription_id TEXT;
ALTER TABLE user_subscriptions ADD COLUMN provider_customer_id TEXT;
ALTER TABLE user_subscriptions ADD COLUMN provider_session_id TEXT;
ALTER TABLE user_subscriptions ADD COLUMN payment_mode TEXT NOT NULL DEFAULT 'subscription';

-- users 表新增字段
ALTER TABLE users ADD COLUMN provider_customer_ids TEXT DEFAULT '{}';

-- orders 订单表
CREATE TABLE orders (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  plan_id INTEGER NOT NULL REFERENCES plans(id),
  subscription_id TEXT,
  next_renewal_reminder_sent INTEGER NOT NULL DEFAULT 0,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CNY',
  original_amount INTEGER NOT NULL,
  discount_amount INTEGER NOT NULL DEFAULT 0,
  billing_cycle TEXT NOT NULL,
  payment_mode TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_payment_id TEXT,
  provider_charge_id TEXT,
  provider_invoice_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TEXT,
  cancelled_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- refunds 退款表
CREATE TABLE refunds (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL REFERENCES orders(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  amount INTEGER NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TEXT,
  review_note TEXT,
  provider TEXT NOT NULL,
  provider_refund_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 索引
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_provider ON orders(provider);
CREATE INDEX idx_refunds_order_id ON refunds(order_id);
CREATE INDEX idx_refunds_status ON refunds(status);
CREATE INDEX idx_refunds_user_id ON refunds(user_id);

-- notification_jobs 通知任务队列表
CREATE TABLE notification_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  order_id TEXT,
  subscription_id TEXT,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  scheduled_at TEXT NOT NULL,
  sent_at TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_notification_jobs_status ON notification_jobs(status);
CREATE INDEX idx_notification_jobs_scheduled_at ON notification_jobs(scheduled_at);
CREATE INDEX idx_notification_jobs_user_id ON notification_jobs(user_id);
