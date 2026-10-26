# 我的旅行博物馆 · 个人线上照片展馆

一个用于陈列旅行照片的个人网站：博物馆展厅式首页 → 展区照片墙 → 点击看大图。访客免登录浏览，管理员通过隐藏入口登录后增删改。

技术栈：**Node.js + Express + 原生 HTML/CSS/JS**，零原生依赖，无构建步骤，开箱即跑。

## 存储模式（双模式，自动切换）

- **本地模式（默认）**：数据存 `data/museum.json`，图片存 `uploads/`。适合电脑本地双击 exe、或局域网访问。
- **云端模式（配了 R2 即启用）**：数据 JSON 与图片全部存到 **Cloudflare R2**（10GB 免费、出站零流量费），因此部署到 Render 免费档也能**持久保存**，休眠/重部署都不丢。

R2 凭据通过环境变量注入（绝不写进仓库），缺任一即自动回退本地模式。

---

## 一、项目结构

```
travel-museum/
├── package.json          # 依赖与启动脚本
├── .env.example          # 环境变量模板（复制为 .env 后填密码 / R2）
├── .gitignore
├── render.yaml           # Render 一键部署配置（free 计划 + R2 变量）
├── Dockerfile            # 容器化部署
├── server/
│   ├── index.js          # Express 主程序：路由 / 上传 / 静态服务
│   ├── db.js             # 数据层（R2 或本地 JSON，双模式）
│   ├── storage.js        # 图片存储（R2 或本地，双模式）
│   ├── config.js         # 运行目录 / R2 开关与客户端
│   └── auth.js           # 管理员密码校验 + JWT token 签发/校验
├── public/               # 前端（静态文件，直接由 Express 托管）
│   ├── index.html        # 首页：展厅网格
│   ├── section.html      # 展区照片墙 + 灯箱大图
│   ├── admin.html        # 管理后台（隐藏入口）
│   ├── css/style.css     # 博物馆风格样式
│   └── js/{home,section,admin}.js
├── uploads/              # 本地模式图片（自动创建，已 gitignore）
└── data/                # 本地模式数据（自动创建，已 gitignore）
```

## 二、本地运行（3 步）

前置：已安装 **Node.js 18+** 和 **npm**。

```
cd travel-museum
npm install
cp .env.example .env          # 编辑 .env，填 ADMIN_PASSWORD 和 JWT_SECRET
npm start                     # 打开 http://localhost:3000
```

- 首页（访客）： http://localhost:3000
- 管理后台（隐藏入口）： http://localhost:3000/admin.html （首页页脚有极低透明度小链接，也可直接收藏该 URL）

首次打开首页是空的，登录后台 → 「+ 新建展区」（上传封面、填目的地/年份）→ 在该展区点「照片」→「+ 上传照片」（填标题、拍摄地点、日期、描述）。刷新数据不丢失。

> 生成随机 `JWT_SECRET`：`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

## 三、管理员认证与安全

- 密码只存在于服务端环境变量 `ADMIN_PASSWORD`，前端无法获取，也不在任何返回里。
- 登录时服务端用 **SHA-256 + 时序安全比较**校验，通过后签发 **JWT（7 天有效）**。
- 所有写操作（`POST/PUT/DELETE`）要求请求头 `Authorization: Bearer <token>`，无 token 返回 401。
- 图片上传限制 15MB，仅允许 `image/*`，前端以 base64 发送、服务端解码落盘（避免 multipart 在打包环境异常）。

## 四、部署到线上（手机随时可看）

完整图文步骤见 **`README-部署到线上.md`**，要点：

1. **Cloudflare R2**：建 bucket → 开公开访问（拿到 `https://pub-xxx.r2.dev`）→ 生成 API 令牌。得到 5 个值：
   `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET` / `R2_PUBLIC_URL`。
2. 把本仓库推到 GitHub（含 `render.yaml`）。
3. Render 新建 **Blueprint**，选本仓库 → 在 Environment 填入：`ADMIN_PASSWORD`、`JWT_SECRET`、以及上述 5 个 `R2_*` 变量 → 部署。
4. 完成后拿到 `https://travel-museum.onrender.com`，手机浏览器直接打开即可。

> Render 免费档约 15 分钟无访问会休眠，下次打开需约 1 分钟冷启动，但**数据不丢**（存于 R2）。

## 五、打包成可双击的 exe（仅电脑本地用）

见 `README-打包成EXE.md`。`npm run build:exe` 在 `dist/` 生成单文件 `travel-museum.exe`，无需安装 Node，双击即开；数据存在 exe 同目录的 `data/` 与 `uploads/`。
