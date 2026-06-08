# Fix: Serial Sequence Out-of-Sync After DB Restore

## Context

`restoreFromJson()` 恢复数据时通过 INSERT 带**显式 id** 写入行，但 PostgreSQL 的 serial sequence 计数器未同步。后续 `setSetting` 插入新行时，sequence 生成的 id 已存在，导致 `duplicate key value violates unique constraint "system_settings_pkey"` 错误。

涉及 **22 张**使用 `serial("id").primaryKey()` 的表，均为潜在受影响对象。

---

## 变更清单

### 1. 新增 `resetSerialSequences()` — `src/lib/db-dump.ts`

- 通过 `pg_depend` 系统目录**动态发现**所有 serial 序列（不硬编码表名，未来新表自动覆盖）
- 对非空表：`setval(seq, MAX(id))` → 下次 `nextval` 返回 `MAX(id) + 1`
- 对空表：`ALTER SEQUENCE ... RESTART WITH 1`
- 导出为 public 函数

### 2. 在 `restoreFromJson()` 事务完成后调用序列重置 — `src/lib/db-dump.ts`

- 在事务成功提交后（第 354 行之后）调用 `resetSerialSequences()`
- 必须在事务外调用：序列操作是 DDL 级别

### 3. 在 `initDb()` 启动时安全兜底 — `src/db/index.ts`

- seed 运行后（第 104 行之后）调用 `resetSerialSequences()`
- try-catch 包裹，不阻塞启动
- 覆盖手动 DB 编辑、迁移异常等边界情况

### 4. 重构 `setSetting()` 为原子 upsert — `src/lib/auth/settings.ts`

- 从 SELECT-then-INSERT/UPDATE 改为 `onConflictDoUpdate({ target: systemSettings.key, set: { value, updatedAt } })`
- 消除竞态条件，代码更简洁
- 函数签名不变，所有调用方无需修改

---

## 关键文件

| 文件 | 操作 |
|------|------|
| `src/lib/db-dump.ts` | 新增 `resetSerialSequences()` + 在 `restoreFromJson()` 后调用 |
| `src/db/index.ts` | `initDb()` 中添加序列重置调用 |
| `src/lib/auth/settings.ts` | `setSetting()` 改为 `onConflictDoUpdate` |

## 验证

1. 重启 dev server，确认无报错
2. 调用 PATCH `/api/auth/admin/system-settings` 设置 `color_scheme`，确认返回 200
3. 通过 Admin UI 执行数据库 Restore，确认完成后新设置写入正常
4. 检查 `resetSerialSequences()` 日志输出，确认序列被正确重置
