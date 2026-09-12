# Jant 部署记录

日期：2026-06-14

## 目标

将 fork 自 `jant-me/jant` 的主仓库部署到 Cloudflare Workers，域名 `jant.xixihaha.tech`，并配置 GitHub Actions 实现 push 自动部署。

---

## 一、背景与仓库选择

### 遇到的问题

用户尝试通过 Cloudflare Workers & Pages 控制台，用 `https://github.com/sunyuan686/jant` 直接部署，报错「无法获取存储库内容」。

### 原因

用户 fork 的是**主仓库**（monorepo），根目录没有 `wrangler.toml`，Cloudflare 找不到 Worker 入口。`wrangler.toml` 位于子目录 `sites/demo/`。

### 结论

- 只想部署 → 应 fork `jant-me/jant-starter`（极简模板）
- 想自己开发功能 → fork 主仓库，但需要手动配置部署流程

用户选择 fork 主仓库，走手动配置路线。

---

## 二、创建 Cloudflare 资源

### 登录 Wrangler

```bash
npx wrangler login
```

账号：`sunyuan608@gmail.com`  
Account ID：`1fa95d28c712735240b0bb2f0004c085`

### 创建 D1 数据库

```bash
npx wrangler d1 create jant-db
```

- Database Name：`jant-db`
- Database ID：`45127a41-b2a2-4bc7-8c81-0b8d500cbacf`
- 区域：APAC

### 创建 R2 存储桶

#### 遇到的问题

运行 `npx wrangler r2 bucket create jant-media` 报错：

```
Please enable R2 through the Cloudflare Dashboard. [code: 10042]
```

#### 解决方法

前往 Cloudflare 控制台手动开启 R2（首次使用需接受条款），之后重新运行命令成功。

```bash
npx wrangler r2 bucket create jant-media
# ✅ Created bucket 'jant-media'
```

---

## 三、配置 wrangler.toml

修改 `sites/demo/wrangler.toml`，替换 demo 专用配置为个人配置：

| 字段 | 修改内容 |
|------|---------|
| `name` | `jant-demo` → `jant` |
| `account_id` | 替换为个人 Account ID |
| `SITE_ORIGIN` | `https://demo.jant.me` → `https://jant.xixihaha.tech` |
| `database_name` | `jant-demo-db` → `jant-db` |
| `database_id` | 替换为新创建的 D1 ID |
| `bucket_name` | `jant-demo-media` → `jant-media` |
| 删除 | `DEMO_EMAIL`、`DEMO_PASSWORD`、`DEMO_MODE`、`remote = true` |

### 设置 AUTH_SECRET

通过 `wrangler secret put` 写入，不提交到代码：

```bash
echo "<32字节随机字符串>" | npx wrangler secret put AUTH_SECRET
```

---

## 四、配置 GitHub Actions 自动部署

新建 `.github/workflows/deploy-site.yml`：

```yaml
name: Deploy Site

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    name: Deploy to jant.xixihaha.tech
    uses: ./.github/workflows/deploy.yml
    with:
      working_directory: sites/demo
      github_environment: production
    secrets:
      CF_API_TOKEN: ${{ secrets.CF_API_TOKEN }}
      CF_ACCOUNT_ID: ${{ secrets.CF_ACCOUNT_ID }}
```

### 在 GitHub 配置

1. 创建 GitHub Environment：`production`
2. 添加 Repository Secrets：`CF_API_TOKEN`、`CF_ACCOUNT_ID`

---

## 五、首次部署失败

### 遇到的问题

push 后 GitHub Actions 的 **Run migrations** 步骤失败，exit code 1。

### 原因

使用「编辑 Cloudflare Workers」模板创建的 API Token **缺少 D1 权限**。该模板只包含 Workers 相关权限，没有 `D1:编辑`。

### 解决方法

重新创建自定义 API Token，手动添加以下权限：

| 类型 | 权限 | 级别 |
|------|------|------|
| 帐户 | Workers 脚本 | 编辑 |
| 帐户 | Workers KV 存储 | 编辑 |
| 帐户 | Workers R2 存储 | 编辑 |
| 帐户 | **D1** | **编辑** |
| 区域 | Workers 路由 | 编辑 |

更新 GitHub Secret `CF_API_TOKEN` 后重新触发部署，全部步骤通过。

---

## 六、绑定自定义域名

通过 Cloudflare API 直接绑定，无需手动操作控制台：

```bash
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/workers/domains" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "hostname": "jant.xixihaha.tech",
    "service": "jant",
    "environment": "production",
    "zone_id": "f6688b6753f84ab73e81c6562231cb09"
  }'
```

DNS 自动写入，证书自动签发，约几分钟内生效。

---

## 七、最终状态

| 项目 | 状态 |
|------|------|
| Worker 名称 | `jant` |
| 访问地址 | `https://jant.xixihaha.tech` |
| 备用地址 | `https://jant.sunyuan608.workers.dev` |
| D1 数据库 | `jant-db` |
| R2 存储桶 | `jant-media` |
| 自动部署 | push 到 `main` 分支自动触发 |

---

## 八、关键管理地址

| 地址 | 用途 |
|------|------|
| `/setup` | 首次设置，创建管理员账号 |
| `/signin` | 登录 |
| `/new` | 写新文章 |
| `/settings` | 站点设置（主题、GitHub Sync、Telegram Bot 等） |
| `/search` | 搜索 |
| `/archive` | 归档 |

---

## 九、后续待完成

- [ ] 访问 `/setup` 创建管理员账号
- [ ] Settings → General 填写站点名称和描述
- [ ] Settings → GitHub Sync 配置文章备份仓库
- [ ] Settings → Telegram 配置 Bot 随手记笔记
- [x] R2 绑定自定义媒体域名（`jant-media.xixihaha.tech`），启用 `R2_PUBLIC_URL`

---

## 十、同步上游更新

```bash
git remote add upstream https://github.com/jant-me/jant.git
git fetch upstream
git merge upstream/main
git push  # 自动触发重新部署
```
