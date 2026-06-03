# Email 模板配置功能

## Context

当前邮件内容（HTML 模板、品牌名 "RabbitDocs"、中文文案）完全硬编码在 `src/lib/auth/mail.ts` 中，管理员无法在后台自定义邮件主题、内容和品牌名。需要在 `/admin/email` 页面增加模板编辑和预览能力。

## 修改文件清单

| 操作 | 文件 | 说明 |
|------|------|------|
| 修改 | `src/lib/auth/settings.ts` | 新增 `getBrandName()` 便捷函数 |
| 修改 | `src/lib/auth/mail.ts` | 提取默认模板常量、新增 `renderTemplate`、改造 `sendVerificationEmail` |
| 修改 | `src/app/api/auth/admin/system-settings/route.ts` | 扩展 SETTING_KEYS、zod schema、GET/PATCH 支持模板字段 |
| 新增 | `src/app/api/auth/admin/system-settings/preview-email/route.ts` | 模板预览 API |
| 修改 | `src/components/admin/EmailPageClient.tsx` | 新增品牌名配置 + 邮件模板编辑 UI + 预览 |

无需数据库迁移，全部复用现有 `system_settings` KV 表。

## Task 1: settings.ts 新增 getBrandName

在 `src/lib/auth/settings.ts` 末尾添加：

```ts
export function getBrandName(): string {
  return getSetting("brand_name") || "RabbitDocs";
}
```

## Task 2: mail.ts 模板引擎化

### 2.1 新增默认模板常量（导出供前端和预览 API 使用）

```ts
export const DEFAULT_EMAIL_TEMPLATES = {
  verifySubject: "{{brandName}} - 验证您的邮箱",
  verifyHtml: `<div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <h2 style="color:#333;margin-bottom:16px">验证您的邮箱</h2>
  <p style="color:#555;line-height:1.6">欢迎注册 {{brandName}}！请点击下面的链接或输入验证码完成邮箱验证：</p>
  {{codeBlock}}
  <div style="text-align:center;margin:24px 0">
    <a href="{{verifyUrl}}" style="display:inline-block;padding:12px 32px;background:#1677ff;color:white;text-decoration:none;border-radius:6px;font-weight:500">验证邮箱</a>
  </div>
  <p style="color:#999;font-size:12px;margin-top:16px;line-height:1.5">链接 24 小时内有效。如果这不是您的操作，请忽略此邮件。</p>
  <hr style="margin:24px 0;border:none;border-top:1px solid #eee">
  <p style="color:#bbb;font-size:11px;text-align:center">此邮件由 {{brandName}} 系统自动发送，请勿直接回复。</p>
</div>`,
};
```

### 2.2 新增 renderTemplate 和 getCodeBlockHtml

```ts
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) =>
    key in vars ? vars[key] : match
  );
}

export function getCodeBlockHtml(code: string): string {
  return `<div style="margin:24px 0;padding:20px;background:#f5f5f5;border-radius:8px;text-align:center">
    <div style="font-size:13px;color:#666;margin-bottom:8px;letter-spacing:.5px">您的验证码（6 位）</div>
    <div style="font-size:36px;font-weight:700;letter-spacing:8px;color:#1677ff;font-family:'Courier New',monospace">${code}</div>
    <div style="font-size:12px;color:#999;margin-top:8px">验证码 24 小时内有效</div>
  </div>
  <p style="color:#666;font-size:13px;text-align:center">也可以点击下方按钮直接验证：</p>`;
}
```

### 2.3 改造 sendVerificationEmail

核心逻辑：从 `system_settings` 读取模板 → `renderTemplate` 替换变量 → 发送。

```ts
export async function sendVerificationEmail(email: string, token: string, code?: string): Promise<void> {
  const transporter = getTransporter();
  const verifyUrl = `${getAppUrl()}/verify-email?token=${token}`;

  if (!transporter) {
    console.log(`[mail] SMTP not configured. Verify URL: ${verifyUrl}`);
    if (code) console.log(`[mail] Verify code: ${code}`);
    return;
  }

  const brandName = getBrandName();
  const subjectTpl = getSetting("email_verify_subject") || DEFAULT_EMAIL_TEMPLATES.verifySubject;
  const htmlTpl = getSetting("email_verify_html") || DEFAULT_EMAIL_TEMPLATES.verifyHtml;
  const codeBlockHtml = code ? getCodeBlockHtml(code) : "";

  const vars = { brandName, code: code || "", verifyUrl, codeBlock: codeBlockHtml };
  const subject = renderTemplate(subjectTpl, vars);
  const html = renderTemplate(htmlTpl, vars);

  await transporter.sendMail({ from: getFromAddress(), to: email, subject, html });
  console.log(`[mail] Verification email sent to: ${email}`);
}
```

## Task 3: system-settings API 扩展

### 3.1 SETTING_KEYS 新增

```ts
"brand_name", "email_verify_subject", "email_verify_html",
```

### 3.2 zod schema 新增字段

```ts
brandName: z.string().trim().max(64).optional(),
emailTemplates: z.object({
  verifySubject: z.string().trim().max(500).optional(),
  verifyHtml: z.string().max(50000).optional(),
}).optional(),
```

### 3.3 GET 返回新增

```ts
brandName: getSetting("brand_name") || "RabbitDocs",
emailTemplates: {
  verifySubject: getSetting("email_verify_subject") || "",
  verifyHtml: getSetting("email_verify_html") || "",
},
```

### 3.4 PATCH 写入新增

在现有 SMTP 写入逻辑后追加 `brandName` 和 `emailTemplates` 的写入。空字符串也写入（读取时回退到默认值）。

## Task 4: 预览 API

新增 `src/app/api/auth/admin/system-settings/preview-email/route.ts`：

- POST 端点，`requireAdmin` 鉴权
- 接收 `{ verifySubject?, verifyHtml? }`
- 用示例变量（`brandName`, `code: "384726"`, `verifyUrl: "https://example.com/verify-email?token=sample"`) 渲染模板
- 返回 `{ preview: { subject, html } }`

## Task 5: EmailPageClient UI 扩展

在现有 SmtpCard 下方新增两张卡片：

### 5.1 Brand Name Card
- 单字段 Input，保存 `brand_name`
- Alert 说明：用于邮件模板和系统展示

### 5.2 Email Template Card
- **Subject** — Input，placeholder 为默认模板
- **HTML Body** — TextArea (monospace, rows=12)，placeholder 为默认模板
- **变量参考 Alert**：列出 `{{brandName}}`, `{{code}}`, `{{verifyUrl}}`, `{{codeBlock}}`
- **操作按钮**：Preview（眼睛图标）+ Reset to Default（撤销图标）
- **预览区域**：iframe sandbox 渲染 HTML + 显示 Subject 文本

### 5.3 状态管理
- 新增 `templates`/`templateDraft`/`brandName`/`brandNameDraft` 状态
- dirty 检测扩展：比较 brandNameDraft 和 templateDraft
- handleSave 扩展：PATCH body 追加 brandName + emailTemplates
- load 函数扩展：从 GET 响应读取新字段

## 模板变量设计

| 变量 | 说明 |
|------|------|
| `{{brandName}}` | 品牌名，默认 "RabbitDocs" |
| `{{code}}` | 6 位验证码数字 |
| `{{verifyUrl}}` | 验证链接完整 URL |
| `{{codeBlock}}` | 预渲染的验证码展示区块 HTML（含 code 时非空） |

空模板字段（空字符串）= 使用默认模板。保存空值到 DB，读取时回退到 DEFAULT。

## 验证方式

1. 启动开发服务器 `npm run dev`
2. 访问 `/admin/email`，确认新增 Brand Name 和 Email Template 卡片
3. 修改品牌名为自定义值 → 保存 → 查看预览
4. 修改邮件模板 HTML → 点击 Preview → iframe 中预览渲染效果
5. 点击 Reset to Default → 模板恢复为空（使用默认值）
6. 注册新用户 → 确认收到自定义模板的验证邮件
7. 未配置模板时 → 确认发送默认模板邮件（行为不变）
