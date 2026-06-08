# 修复 features.includes is not a function

## Context

页面加载报错 `features.includes is not a function`，API `/api/features` 返回 `{"features":{}}` 而非数组。

**根因**：`src/app/api/features/route.ts` 中调用了 `getUserFeatures()` 和 `getAllFeatureNames()` 但缺少 `await`。这两个函数都是 `async`，返回 `Promise<string[]>`。Promise 对象被 `NextResponse.json()` 序列化为 `{}`，前端收到后 `{}` 是 truthy 不会 fallback 到 `[]`，最终 `setFeatures({})` 存入对象，触发 `includes is not a function`。

## 修改方案

### 1. 修复 API 路由 — 添加缺失的 `await`（根因修复）

**文件**: `src/app/api/features/route.ts`（第14行、第19行）

```diff
- const allFeatures = getAllFeatureNames();
+ const allFeatures = await getAllFeatureNames();

- const features = getUserFeatures(auth.id);
+ const features = await getUserFeatures(auth.id);
```

### 2. 前端防御性加固

**文件**: `src/components/auth/AuthProvider.tsx`

**2a. `fetchFeatures` 增加 Array.isArray 校验（第92行）：**
```diff
- .then((data) => setFeatures(data.features || []))
+ .then((data) => setFeatures(Array.isArray(data.features) ? data.features : []))
```

**2b. `hasFeature` 增加 Array.isArray 防御（第172行）：**
```diff
- (key: string) => features.includes(key) || features.some(f => f.toLowerCase().includes(key.toLowerCase())),
+ (key: string) => Array.isArray(features) && (features.includes(key) || features.some(f => f.toLowerCase().includes(key.toLowerCase()))),
```

## 验证

1. 重启 dev server，访问页面确认不再报错
2. 浏览器 Network 面板检查 `/api/features` 响应，确认 `features` 是字符串数组
3. 验证 `hasFeature("workspace")` 正常工作
