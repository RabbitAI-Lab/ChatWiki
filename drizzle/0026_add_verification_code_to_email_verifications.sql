-- Phase 5: 邮箱验证码
-- 给 email_verifications 添加 6 位数字验证码列（与 token 并存）
-- 验证码（短、易记）适合用户在邮箱中手动输入；token 仍用于一次性链接

ALTER TABLE email_verifications ADD COLUMN code TEXT;
CREATE UNIQUE INDEX idx_email_verifications_code ON email_verifications(code) WHERE code IS NOT NULL;
