# ChatWiki Docker 容器化方案

## Context

将 ChatWiki（Next.js 16 + Drizzle + SQLite 全栈应用）容器化，提供两套独立环境：

1. **开发环境容器**：`pnpm docker` 一键启动，行为等同 `pnpm dev`（含 HMR、源文件热更新、数据库自动初始化）
2. **生产环境容器**：多阶段构建产出的精简镜像，通过 `pnpm docker:prod:*` 管理生命周期

> **用户决策**：不修改 `next.config.ts`（不添加 `output: "standalone"`），Docker 相关文件统一放 `docker/` 子目录。

### 关键项目特征

| 特性 | 现状 | Docker 适配要点 |
|------|------|------------------|
| Next.js | 16.2.6（App Router） | 生产构建需完整 `node_modules`（不开启 standalone） |
| 端口 | 3000（Web）+ 4001（MCP，由 `src/instrumentation.ts` 启动） | 两个端口都需对外暴露 |
| 数据库 | SQLite（`./data.db`，WAL 模式）+ 业务文件（`./data/personal/...`） | 数据卷持久化 |
| 原生依赖 | `better-sqlite3`、`@anthropic-ai/claude-agent-sdk`（已在 `serverExternalPackages`） | 需 `python3`/`make`/`g++` 编译工具链 |
| 工作空间 | `fs.symlinkSync` 软链 `workspace/{id}/{projectId}` → `../../projects/{projectId}` | 软链全部位于 `data/` 卷内，跨卷挂载无碍 |
| 沙盒 | 外部 OpenSandbox 服务（`openapi.sandbox.rabbitai-lab.com`，可在管理后台配置） | 容器内无需运行沙盒，仅需网络可达 |
| 包管理 | 当前 `npm`（`package-lock.json` 存在） | 容器内改用 `pnpm`（按用户要求） |

## 文件清单

| 文件 | 改动 | 用途 |
|------|------|------|
| `package.json` | 修改 | 新增 `docker*` 系列脚本 + `dev:docker`/`start:docker` |
| `docker/Dockerfile.dev` | 新增 | 开发镜像 |
| `docker/Dockerfile.prod` | 新增 | 生产镜像（多阶段 + pnpm prune） |
| `docker/.dockerignore` | 新增 | 共享的 Docker 忽略规则 |
| `docker/docker-compose.dev.yml` | 新增 | 开发环境编排 |
| `docker/docker-compose.prod.yml` | 新增 | 生产环境编排（命名卷） |

## 详细步骤

### Step 1：扩展 `package.json` 脚本

新增以下脚本（保留原有 `dev`/`build`/`start`/`lint`）：

```json
"dev:docker": "next dev --hostname 0.0.0.0",
"start:docker": "next start --hostname 0.0.0.0",
"docker": "docker compose -f docker/docker-compose.dev.yml up",
"docker:build": "docker compose -f docker/docker-compose.dev.yml up --build",
"docker:down": "docker compose -f docker/docker-compose.dev.yml down",
"docker:logs": "docker compose -f docker/docker-compose.dev.yml logs -f",
"docker:prod:build": "docker compose -f docker/docker-compose.prod.yml build",
"docker:prod:up": "docker compose -f docker/docker-compose.prod.yml up -d",
"docker:prod:down": "docker compose -f docker/docker-compose.prod.yml down",
"docker:prod:logs": "docker compose -f docker/docker-compose.prod.yml logs -f"
```

> - 主入口：`pnpm docker` = 在容器内运行 `pnpm dev:docker`（含 HMR）
> - `dev:docker` 监听 `0.0.0.0`，不调用 `scripts/dev.sh`（容器内 `lsof` 不可用）
> - 生产入口：`pnpm docker:prod:up` 后台启动，`pnpm docker:prod:logs` 查看日志

### Step 2：`docker/Dockerfile.dev`

```dockerfile
FROM node:20-bookworm-slim

RUN corepack enable && corepack prepare pnpm@10.14.0 --activate

# better-sqlite3 等原生模块的编译依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
# （可选）若有 pnpm-lock.yaml 可解开下一行
# COPY pnpm-lock.yaml ./

RUN pnpm install --no-frozen-lockfile

# 源码由 docker-compose 卷挂载覆盖
COPY . .

EXPOSE 3000 4001

CMD ["pnpm", "dev:docker"]
```

### Step 3：`docker/Dockerfile.prod`（多阶段）

```dockerfile
# Stage 1: 全量依赖（含 devDeps，用于 build）
FROM node:20-bookworm-slim AS deps
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./
RUN pnpm install --no-frozen-lockfile

# Stage 2: 构建
FROM node:20-bookworm-slim AS builder
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# Stage 2.5: 裁剪为生产依赖
FROM builder AS prod-deps
RUN pnpm prune --prod

# Stage 3: 运行时
FROM node:20-bookworm-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV MCP_PORT=4001
ENV HOSTNAME=0.0.0.0

# 非 root 用户
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

# 复制构建产物与精简依赖
COPY --from=prod-deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=prod-deps --chown=nextjs:nodejs /app/package.json  ./package.json
COPY --from=builder   --chown=nextjs:nodejs /app/.next    ./.next
COPY --from=builder   --chown=nextjs:nodejs /app/public   ./public
COPY --from=builder   --chown=nextjs:nodejs /app/drizzle  ./drizzle

# 预创建数据目录
RUN mkdir -p /app/data \
 && touch /app/data.db \
 && chown -R nextjs:nodejs /app/data /app/data.db

USER nextjs

EXPOSE 3000 4001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000',r=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))"

CMD ["pnpm", "start:docker"]
```

> - 因不开启 `output: "standalone"`，镜像体积约 800MB-1.2GB
> - 后续如需瘦身，可改为 standalone 模式并同步更新 Dockerfile

### Step 4：`docker/.dockerignore`

```
node_modules
.next
.git
.plan
.qoder
.agents
.claude
data
data.db
data.db-shm
data.db-wal
chatwiki.db
*.log
.DS_Store
.env*
README.md
AGENTS.md
CLAUDE.md
tsconfig.tsbuildinfo
docker
scripts/add-gitnexus-to-project.ts
scripts/migrate-projects-dir.ts
scripts/migrate-projects-docs-dir.ts
```

### Step 5：`docker/docker-compose.dev.yml`

```yaml
services:
  chatwiki-dev:
    build:
      context: ..
      dockerfile: docker/Dockerfile.dev
    image: chatwiki:dev
    container_name: chatwiki-dev
    restart: unless-stopped
    ports:
      - "3000:3000"   # Next.js Web
      - "4001:4001"   # MCP Server（instrumentation.ts 启动）
    environment:
      - NODE_ENV=development
      - NEXT_TELEMETRY_DISABLED=1
    volumes:
      # 源码热更新（容器内 node_modules 仍用镜像中已安装的版本）
      - ./src:/app/src
      - ./public:/app/public
      - ./drizzle:/app/drizzle
      - ./next.config.ts:/app/next.config.ts
      - ./package.json:/app/package.json
      - ./tsconfig.json:/app/tsconfig.json
      - ./postcss.config.mjs:/app/postcss.config.mjs
      - ./eslint.config.mjs:/app/eslint.config.mjs
      - ./scripts:/app/scripts
      # 业务数据持久化（绑定挂载，宿主机可访问）
      - ../data:/app/data
      - ../data.db:/app/data.db
      - ../data.db-shm:/app/data.db-shm
      - ../data.db-wal:/app/data.db-wal
    stdin_open: true
    tty: true
```

> - compose 文件位于 `docker/`，`context: ..` 指项目根目录
> - 卷挂载源文件后 HMR 可工作（macOS 上略慢，Linux 上正常）

### Step 6：`docker/docker-compose.prod.yml`

```yaml
services:
  chatwiki-prod:
    build:
      context: ..
      dockerfile: docker/Dockerfile.prod
    image: chatwiki:prod
    container_name: chatwiki-prod
    restart: unless-stopped
    ports:
      - "3000:3000"
      - "4001:4001"
    environment:
      - NODE_ENV=production
      - NEXT_TELEMETRY_DISABLED=1
      - PORT=3000
      - MCP_PORT=4001
      - HOSTNAME=0.0.0.0
    volumes:
      # 生产数据使用命名卷，独立于宿主机目录
      - chatwiki_data:/app/data
      - chatwiki_db:/app/data.db
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://127.0.0.1:3000',r=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 20s

volumes:
  chatwiki_data:
  chatwiki_db:
```

> - 命名卷独立于宿主机目录，容器删除/升级时数据保留
> - 使用 `pnpm docker:prod:up -d` 后台运行

## 验证

### 开发环境

```bash
# 项目根目录
pnpm docker:build        # 首次构建镜像
pnpm docker              # 启动开发容器（前台日志）

# 验证：
# 1. 浏览器访问 http://localhost:3000 → 正常显示应用
# 2. 修改 src/ 下任意文件 → 浏览器自动热更新
# 3. data.db 与 data/ 目录在宿主机可见且写入正常
# 4. MCP 端点：curl -X POST http://localhost:4001/mcp \
#      -H "Content-Type: application/json" \
#      -H "Accept: application/json, text/event-stream" \
#      -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1"}},"id":1}'

pnpm docker:down         # 关闭容器
```

### 生产环境

```bash
pnpm docker:prod:build   # 构建生产镜像
pnpm docker:prod:up      # 后台启动

# 验证：
# 1. 浏览器访问 http://localhost:3000
# 2. 触发一次模型调用或文件操作，确认 SQLite 写入命名卷
# 3. 健康检查：docker inspect --format='{{.State.Health.Status}}' chatwiki-prod
# 4. 查看日志：pnpm docker:prod:logs

pnpm docker:prod:down    # 关闭（数据保留在命名卷）
pnpm docker:prod:up      # 重启后数据应保留
```

## 风险与说明

1. **未使用 standalone**：镜像体积较大（~1GB）。如需后续瘦身，可改 `output: "standalone"` 并相应简化 Dockerfile
2. **macOS 文件系统**：通过卷挂载的源文件 HMR 性能比本地慢。已在镜像中用 `--hostname 0.0.0.0` 让 Webpack 监听所有接口
3. **pnpm lockfile**：容器内 pnpm 会生成 `pnpm-lock.yaml`（已加入 `.dockerignore`）。本地保留 `package-lock.json`，不冲突；如需统一可运行 `pnpm import` 转换
4. **MCP 端口 4001**：默认在开发与生产都对外暴露。如生产不需要（如不通过外部 Claude Code 客户端连接），可删除对应映射
5. **工作空间软链**：`fs.symlinkSync` 创建的软链全部位于 `data/` 卷内，跨卷挂载无需额外配置
6. **首次构建较慢**：better-sqlite3 需要 python3/make/g++ 编译，pnpm 安装所有依赖。多阶段构建已做层级缓存，重复构建快
7. **数据迁移**：旧 `chatwiki.db` 已被忽略（空文件 0 字节，未实际使用）。如未来需要可加入 `docker/.dockerignore` 白名单并补充迁移文档
