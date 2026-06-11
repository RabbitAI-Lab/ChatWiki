# 修复聊天输入框无法输入空格的问题

## Context

用户报告在聊天对话框中无法输入空格。经过深入排查，定位到根因：

`ChatWorkspace.tsx` 使用 `@ant-design/x` 的 `Suggestion` 组件包裹 `Sender` 组件。`Suggestion` 内部使用 antd 的 `Cascader`，而 `Cascader` 内部使用 `@rc-component/select` 的 `BaseSelect`。

在 `BaseSelect` 的 `onInternalKeyDown` 中（`node_modules/@rc-component/select/es/BaseSelect/index.js` 第 228-237 行），有以下逻辑：

```javascript
const isSpaceKey = key === ' ';
if (isEnterKey || isSpaceKey) {
  const isCombobox = mode === 'combobox';    // false
  const isEditable = isCombobox || showSearch;  // false || false = false
  if (isSpaceKey && !isEditable || ...) {
    event.preventDefault();   // 空格键被阻止！
  }
}
```

由于 `Suggestion` 没有给 `Cascader` 传 `showSearch`，`showSearch` 默认为 `false`，导致 `isEditable` 为 `false`，空格键的默认行为被 `preventDefault()` 阻止。

此外，`Sender` 作为 `BaseSelect` 的 `RootComponent`（通过 `getRawInputElement` 传入），`BaseSelect` 的 `onInternalKeyDown` 通过 `cloneElement` 注入到 `Sender` 上，在 `Sender` 自己的 `onKeyDown` 之前执行，所以空格键在到达 `Sender` 的处理逻辑之前就被拦截了。

## 修复方案

在 `ChatWorkspace.tsx` 中，给 `Suggestion` 组件传递 `showSearch` 属性（设为 `true`），使得 `BaseSelect` 的 `isEditable` 为 `true`，从而不再拦截空格键。

虽然 `Suggestion` 的 TypeScript 类型定义（`SuggestionProps`）通过 `Omit` 排除了 `showSearch`，但运行时 `Suggestion` 会将未解构的 props 通过 `...otherProps` 透传给 `Cascader`，所以传 `showSearch` 在运行时是有效的。

## 修改文件

- `src/components/chat/ChatWorkspace.tsx`（第 318 行附近，`<Suggestion>` 组件处）

## 具体改动

```tsx
// 修改前
<Suggestion
  items={getSuggestionItems}
  onSelect={...}
  ...
>

// 修改后：添加 showSearch prop 绕过 BaseSelect 的空格拦截
<Suggestion
  items={getSuggestionItems}
  onSelect={...}
  ...
  // @ts-expect-error Suggestion Omit 了 showSearch 但运行时会透传给 Cascader
  showSearch
>
```

添加 `showSearch` 后：
- `BaseSelect` 中 `isEditable = isCombobox || showSearch` → `false || true = true`
- `isSpaceKey && !isEditable` → `true && false` → **false** → 不再 `preventDefault`
- 空格键恢复正常输入

## 验证方式

1. 启动开发服务器
2. 打开聊天页面
3. 在输入框中输入文本并按空格键，确认空格正常输入
4. 测试 `@` 触发文件建议面板后的空格输入
5. 测试中文输入法下的空格输入
6. 测试悬浮窗中的聊天输入
