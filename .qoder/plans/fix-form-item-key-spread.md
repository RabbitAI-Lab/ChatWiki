# 修复 PlansPageClient Form.Item key spread 警告

## Context
`PlansPageClient.tsx` 中 `Form.List` 的 `fields.map` 回调里，`{...field}` 展开包含 `key` 属性到 `Form.Item`，React 要求 `key` 必须显式传递，不能通过 spread。

## 修改文件
- `src/components/admin/PlansPageClient.tsx`

## 修改内容
将第 408-409、419-420、431-432 行的 `{...field}` 改为 `{...(({ key, ...rest }) => rest)(field)}`，或更简洁地解构：

```tsx
// 之前
<Form.Item {...field} name={[field.name, "currency"]} ...>

// 之后 — 从 field 中排除 key 再展开
{(({ key: _key, ...fieldRest }) => (
  <Form.Item {...fieldRest} key={_key} name={[field.name, "currency"]} ...>
))(field)}
```

实际上最简洁的做法是直接在 spread 中 omit key：

```tsx
const { key: fieldKey, ...fieldProps } = field;
// 然后在 map 中用 <Form.Item {...fieldProps} key={fieldKey} ...>
```

但由于外层 `<div key={field.key}>` 已经处理了 key，`Form.Item` 不需要 key，直接用 rest 即可：

**方案**：在 `fields.map` 回调顶部解构 `field`，排除 `key`：
```tsx
{fields.map((field) => {
  const { key: _, ...fieldProps } = field;
  return (
    <div key={field.key} ...>
      <Form.Item {...fieldProps} name={...} ...>
```

然后 3 处 `<Form.Item {...field}` 全部改为 `<Form.Item {...fieldProps}`。

## 验证
- 启动开发服务器，访问 admin/plans 页面
- 控制台不再出现 "key prop is being spread" 警告
- 动态 Pricing 编辑功能正常（添加/删除/编辑货币行）
