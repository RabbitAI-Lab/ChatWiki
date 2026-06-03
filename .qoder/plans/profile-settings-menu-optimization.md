# 优化菜单：Profile 精简 + Settings（Account）重组

## Context
当前 `/profile` 页面承载了过多功能（基本信息、账户安全、通行密钥、邀请码、通用注册秘钥、CLI 令牌、退出登录），需要将其拆分：基本信息留在 Profile，其余全部移至 `/settings` 页面，同时将菜单中 Settings 改名为 Account。

## 变更文件

### 1. 精简 `/profile/page.tsx`
**文件**: `src/app/profile/page.tsx`

- **保留**: Section 1（基本信息）— 头像、名称编辑、账号类型、用户ID
- **删除**: Section 2~6（账户安全、通行密钥、邀请码、通用注册秘钥、CLI 令牌）和底部退出登录
- **清理**: 移除不再需要的 import（`LockOutlined`, `PlusOutlined`, `CopyOutlined`, `PasskeySection`, `CliTokensSection`, `GeneralRegistrationKeySection`）、state 变量（`passwordForm`, `inviteCodes`, `loadingPassword`, `loadingCodes`）、以及相关 handler 函数（`handleChangePassword`, `loadInviteCodes`, `handleCreateInviteCode`, `copyInviteLink`）

### 2. 创建 `/settings/page.tsx`
**文件**: `src/app/settings/page.tsx`

- 从原 `/profile/page.tsx` 迁移以下内容：
  - Section 2: 账户安全（修改密码）
  - Section 3: 通行密钥（PasskeySection）
  - Section 4: 邀请码
  - Section 5: 通用注册秘钥（GeneralRegistrationKeySection）
  - Section 6: CLI 令牌（CliTokensSection）
  - 退出登录按钮
- 页面标题改为 "Account"（或"账户设置"）
- 复用 `SectionHeader` 组件

### 3. 更新 MyAccountMenu 菜单
**文件**: `src/components/layout/MyAccountMenu.tsx`

- 将 `menuItems` 中的 `{ label: "Settings", href: "/settings" }` 改为 `{ label: "Account", href: "/settings" }`

## 验证

1. 访问 `/profile` — 只显示基本信息区块
2. 访问 `/settings` — 显示账户安全、通行密钥、邀请码、通用注册秘钥、CLI 令牌、退出登录
3. 点击 My Account 弹出菜单 — 确认显示 "Account" 而非 "Settings"
4. 确认所有功能（修改密码、通行密钥管理、邀请码创建、退出登录等）在新页面中正常工作
