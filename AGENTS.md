<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Ant Design v6 (CSS-in-JS) Styling Rules

- **Never override antd component styles via global CSS classes.** Ant Design v6 uses `@ant-design/cssinjs` runtime — styles are injected as inline `style` attributes and scoped `<style>` tags. External CSS selectors (even with `!important`) frequently lose to specificity/timing.
- **Use the `styles` prop** on antd components for visual customization. This is the only reliable path. Note the correct key names per component:
  - **Modal**: `styles={{ mask: {...}, container: {...}, header: {...}, body: {...}, footer: {...} }}`. ⚠️ There is NO `content` key — use `container` to style the `.ant-modal-content` element.
  - **Drawer**: `styles={{ mask: {...}, wrapper: {...}, content: {...} }}`
- **Use the `classNames` prop** if you need to add custom CSS classes to sub-slots.
- **Use `ConfigProvider theme.token`** in `ThemeRegistry.tsx` for global token overrides (colors, radii, etc.), not globals.css.

## Modal 默认样式规范

- **所有 Modal 必须添加边框**，通过 `styles.container` 设置：
  ```jsx
  styles={{ container: { border: '1px solid var(--popup-border)' } }}
  ```
- **所有表单类 Modal 必须设置高度限制和内部滚动**：
  ```jsx
  styles={{ body: { maxHeight: 'calc(90vh - 110px)', overflowY: 'auto' } }}
  ```
- **所有 Modal 必须添加 `centered` 属性**，确保水平垂直居中。
- ⚠️ **绝不能通过 globals.css 全局 CSS 给 Modal 加边框或其他样式**，antd v6 CSS-in-JS 会覆盖全局 CSS。
