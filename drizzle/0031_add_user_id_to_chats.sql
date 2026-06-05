-- Add userId to chats for user isolation
ALTER TABLE chats ADD COLUMN user_id TEXT;
CREATE INDEX idx_chats_user_id ON chats(user_id);
