-- 添加用户角色字段
-- 支持多管理员模式，将现有管理员迁移到 role 字段

ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
UPDATE users SET role = 'admin' WHERE id = (SELECT value FROM system_settings WHERE key = 'admin_user_id');
