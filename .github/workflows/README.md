# GitHub Actions

参考 `RabbitAI` 的部署流水线，拆分出三个独立 workflow：

| Workflow | 触发 | 用途 |
| --- | --- | --- |
| `ci.yml` | push / PR 到 `main` | ESLint + TypeScript 类型检查 + Next.js 构建 |
| `docker.yml` | push 到 `main` / `v*.*.*` tag / 手动 | 构建生产镜像并推送到 GHCR |
| `deploy.yml` | push 到 `main` / 手动 | SSH 远程拉取镜像、滚动重启、端口健康检查 |

## 触发顺序

```
push to main
   ├──► CI（lint + typecheck + build）
   ├──► Build & Push Image（构建并推送到 ghcr.io）
   └──► Deploy（通过 SSH 在服务器上拉取并重启容器）
```

## 必需配置

### Secrets（仓库级别 Settings → Secrets and variables → Actions）

| 名称 | 用途 |
| --- | --- |
| `SSH_PRIVATE_KEY` | 部署目标服务器的 SSH 私钥（ed25519 / rsa），公钥需提前加入目标机器的 `~/.ssh/authorized_keys` |

> **镜像推送与拉取鉴权说明**
> - **推送**：`docker.yml` 使用 GitHub Actions 内置的 `secrets.GITHUB_TOKEN`（`permissions: packages: write`），无需额外 PAT。
> - **拉取**：远端服务器执行 `docker compose pull` 时**不需要**任何凭据，前提是 GHCR 上的 `rabbitdocs` 包在 Package settings → Visibility 中被设为 **Public**。
>   - 路径：仓库首页 → 右侧 **Packages** → `rabbitdocs` → **Package settings** → 底部 **Change package visibility** → Public
>   - 设为 Private 时必须改回 PAT 方案（旧版 `GHCR_PAT`），或在服务器上 `docker login ghcr.io` 用 deploy token 持久化凭据。

### Variables（仓库级别 Settings → Secrets and variables → Actions → Variables）

| 名称 | 格式 | 用途 |
| --- | --- | --- |
| `SERVERS` | JSON 数组 | 部署目标机矩阵，例如 `[{"host":"1.2.3.4","user":"deploy"}]` |
| `SERVER_ENV_FILE` | 多行字符串 | 写入远端 `/home/$USER/deploy/.env` 的完整环境变量文件内容 |

### 示例 `SERVERS`

```json
[
  { "host": "10.0.0.10", "user": "deploy" },
  { "host": "10.0.0.11", "user": "deploy" }
]
```

### 示例 `SERVER_ENV_FILE`

```
NODE_ENV=production
PORT=3000
MCP_PORT=4001
HOSTNAME=0.0.0.0
ANTHROPIC_API_KEY=sk-ant-...
# ... 其余业务环境变量
```

## 镜像命名

所有 workflow 复用同一个 `env.IMAGE_NAME`（`rabbitdocs`），推送至：

```
ghcr.io/<owner>/rabbitdocs:latest
ghcr.io/<owner>/rabbitdocs:<sha-short>
ghcr.io/<owner>/rabbitdocs:<vX.Y.Z>   # tag 推送时追加
```

## 手动部署指定镜像

`Deploy` workflow 支持 `workflow_dispatch`，可在手动触发时输入 `image_tag`（如 `v0.1.3` 或某次提交的 sha）来覆盖默认的 `latest`。

## 远端目录约定

部署脚本在服务器上的工作目录固定为 `/home/$USER/deploy/`，结构如下：

```
~/deploy/
├── docker-compose.yml            # 来自仓库 docker/docker-compose.prod.yml
├── docker-compose.override.yml   # 运行时生成，覆盖 image 字段
├── .env                          # 来自 SERVER_ENV_FILE 变量
└── data/                         # 命名卷会挂载到 /app/data
```
