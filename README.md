# 我的旅行博物馆 · 个人线上照片展馆

一个用于陈列旅行照片的个人网站：博物馆展厅式首页 → 展区照片墙 → 点击看大图。访客免登录浏览，管理员通过隐藏入口登录后增删改。

技术栈：**Node.js + Express + 纯 JSON 文件存储 + 原生 HTML/CSS/JS**，零原生依赖，无构建步骤，开箱即跑。

---

## 一、项目结构

```
travel-museum/
├── package.json          # 依赖与启动脚本
├── .env.example          # 环境变量模板（复制为 .env 后填密码）
├── .gitignore
├── render.yaml           # Render 一键部署配置
├── Dockerfile            # 容器化部署
├── server/
│   ├── index.js          # Express 主程序：路由 / 上传 / 静态服务
│   ├── db.js             # JSON 文件存储（自动建库、原子写入）
│   └── auth.js           # 管理员密码校验 + JWT token 签发/校验
├── public/               # 前端（静态文件，直接由 Express 托管）
│   ├── index.html        # 首页：展厅网格
│   ├── section.html      # 展区照片墙 + 灯箱大图
│   ├── admin.html        # 管理后台（隐藏入口）
│   ├── css/style.css     # 博物馆风格样式
│   └── js/
│       ├── home.js       # 首页逻辑
│       ├── section.js    # 照片墙 + 灯箱逻辑
│       └── admin.js      # 后台管理逻辑
├── uploads/              # 上传的图片（自动创建，已 gitignore）
└── data/                 # SQLite 数据库文件（自动创建，已 gitignore）
```

---

## 二、本地运行（3 步）

前置：已安装 **Node.js 18+** 和 **npm**。

```bash
# 1. 进入项目目录
cd travel-museum

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
#   用编辑器打开 .env，修改 ADMIN_PASSWORD 和 JWT_SECRET（见下方说明）

# 4. 启动
npm start
# 或开发模式（文件改动自动重启）：npm run dev
```

启动后访问：

- 首页（访客）： http://localhost:3000
- 管理后台（隐藏入口）： http://localhost:3000/admin.html

首次打开首页是空的，登录后台 → 「展区管理」→「+ 新建展区」（上传封面、填目的地/年份）→ 在该展区点「照片」→「+ 上传照片」（填标题、拍摄地点、日期、描述）。刷新页面数据不丢失。

### 环境变量说明（`.env`）

| 变量 | 作用 | 是否必须 |
|------|------|----------|
| `PORT` | 服务端口，默认 3000 | 否 |
| `ADMIN_PASSWORD` | **管理员密码**，仅服务端使用，绝不写进前端 | 是 |
| `JWT_SECRET` | 签发登录 token 的密钥，请改成一段长随机串 | 是 |
| `DB_PATH` | 数据文件路径（JSON），默认 `./data/museum.json` | 否（部署时设持久磁盘） |
| `UPLOADS_DIR` | 图片存储目录，默认 `./uploads` | 否（部署时设持久磁盘） |

> 生成随机 `JWT_SECRET` 的命令：`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

---

## 三、管理员认证与安全

- 密码**只存在于服务端环境变量** `ADMIN_PASSWORD`，前端无法获取，也不在任何返回里。
- 登录时服务端用 **SHA-256 + 时序安全比较**校验，通过后签发一个 **JWT（7 天有效）**。
- 所有写操作接口（`POST/PUT/DELETE`）都要求请求头携带 `Authorization: Bearer <token>`，无 token 返回 401。
- 管理入口 `/admin.html` 在首页页脚有一个极低透明度的小链接，访客基本看不到；你也可以直接收藏该 URL。
- 图片上传限制 15MB，且只允许图片类型（`image/*`）。

---

## 四、部署方案

### 方案 A：Render（推荐，最接近本地，一键）

1. 把代码推到 GitHub。
2. 在 Render 新建 **Web Service** → 选择仓库；或在仓库放好 `render.yaml` 后选 **Blueprint**。
3. Render 会自动识别 `npm install` / `npm start`。
4. 在 Render 控制台设置环境变量：`ADMIN_PASSWORD`、`JWT_SECRET`（务必手动填，不要写进仓库）。
5. 关键：在 Render 给服务挂一个 **Persistent Disk**（挂载到 `/data`），并在环境变量里设 `DB_PATH=/data/museum.db` 与 `UPLOADS_DIR=/data/uploads`——这样数据库和图片在重启/重新部署后**不会丢失**（`render.yaml` 已写好）。
6. 免费版会在无访问时休眠，首次访问稍慢，属正常。

### 方案 B：Railway

1. 连接 GitHub 仓库，Railway 自动检测 Node 项目。
2. 在 Variables 里加 `ADMIN_PASSWORD`、`JWT_SECRET`。
3. 添加一个 **Volume**（如 `/data`），并设置 `DB_PATH=/data/museum.db`、`UPLOADS_DIR=/data/uploads`。
4. 部署完成后获得 `*.railway.app` 域名。

### 方案 C：Docker / 任意 VPS

```bash
# 构建
docker build -t travel-museum .
# 运行（把宿主机 /srv/museum-data 挂载到容器 /data 做持久化）
docker run -d --name museum \
  -p 3000:3000 \
  -e ADMIN_PASSWORD=你的密码 \
  -e JWT_SECRET=你的密钥 \
  -v /srv/museum-data:/data \
  travel-museum
```
然后在浏览器打开 `http://服务器IP:3000`。Nginx 反代 + 域名 + HTTPS 自行配置即可。

### 方案 D：Vercel / 其他纯 Serverless（需改造）

> ⚠️ 本仓库默认用 **本地磁盘 + JSON 文件**，而 Vercel 函数运行时**文件系统只读且临时**，图片和数据库无法持久保存。因此**不建议直接部署到 Vercel**。

如果一定要上 Vercel，需要把两处存储换成外部服务：

- **数据**：把 `server/db.js` 的数据层换成外部数据库（如 [Turso（libSQL）](https://turso.tech) 或 Supabase Postgres）。
- **图片**：改用 S3 / Cloudflare R2 等对象存储，把 `server/index.js` 里的 `saveDataUrl()` 改为直接上传到对象存储并返回完整 URL，前端传来的仍是 base64，数据库里存完整 URL 而非 `/uploads/xxx`。
- 再用 `vercel.json` 把 `server/index.js` 指为 `@vercel/node` 的 Node 函数入口。

需要我直接给你一版「Vercel + Turso + R2」的改造代码，可以再说。

---

## 五、图片存储建议

- **个人小流量（推荐）**：就用本地磁盘（Render/Railway 挂持久卷、Docker 挂 volume）。零额外成本，最简单，图片随项目一起备份。
- **要扩容 / 多实例 / CDN 加速**：把图片存到 **Cloudflare R2 / AWS S3 / 阿里云 OSS**，数据库里只存对象 URL，前端直接走对象存储的 CDN 域名加载，速度和成本都更好。

---

## 六、常见问题

- **首页空白/加载失败**：确认服务已启动、数据库已自动创建；用 `curl http://localhost:3000/api/sections` 看是否返回 `[]` 或数据。
- **上传图片失败**：检查单图是否超过 15MB；检查 `uploads/` 目录是否可写。
- **部署后数据丢失**：确认已挂载持久磁盘并正确设置了 `DB_PATH` / `UPLOADS_DIR`（见各方案）。
- **忘记管理员密码**：改 `.env` 里的 `ADMIN_PASSWORD` 并重启服务即可。
