# Modal 弹窗添加全局边框

## Context
Modal 弹窗的背景色与页面背景色几乎相同（尤其是 dark mode 下），导致弹窗边界不清。用户希望给整个 Modal 弹窗加边框来增强视觉层次。

## 方案：全局 CSS 给 `.ant-modal-content` 加边框

只需修改一个文件 `globals.css`，添加一条 CSS 规则，所有 Modal 自动生效，无需逐个修改组件。

**修改文件**: `src/app/globals.css`

在文件末尾添加：

```css
/* Modal 弹窗边框：增强与页面背景的视觉区分 */
.ant-modal-content {
  border: 1px solid var(--popup-border);
}
```

利用项目已有的 CSS 变量 `--popup-border`：
- light mode: `#e5e7eb`（浅灰边框）
- dark mode: `#27272a`（深灰边框）

## 为什么用全局 CSS 而非逐个改组件
- 项目中有大量 Modal（Plans、Model、SystemPrompts、Orders、MCP、UserModel 等）
- 全局 CSS 一处修改，所有 Modal 包括 `modal.confirm` 等动态弹窗全部生效
- 不影响 Modal 内部的 padding、布局、滚动等行为

## 验证
- light/dark 模式下打开任意 Modal 查看边框效果
- 确认 Modal 圆角和边框配合正常
- 确认 `modal.confirm` 等非 `<Modal>` 组件创建的弹窗也有边框
