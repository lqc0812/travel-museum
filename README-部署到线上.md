# 部署到线上（完全免费 · 数据持久）

把「个人旅行博物馆」发布成一个手机随时能开的网址。存储走 **Cloudflare R2**（S3 兼容、10GB 免费、出站流量零费用），所以 **Render 免费档也能持久保存**——上传的照片和数据不会因休眠/重部署而丢失。

> 如果你只想在电脑上本地看 / 同一 WiFi 下用手机看，不需要部署，直接用 `dist/travel-museum.exe` 即可（详见 `README-打包成EXE.md`）。

---

## 整体流程
1. 准备一个 Cloudflare 账号（免费），建 R2 存储桶，拿到 5 个配置值。
2. 把项目推到你的 GitHub 仓库。
3. 在 Render 导入仓库，填好环境变量，部署。
4. 拿到 `https://xxx.onrender.com`，手机浏览器直接打开。

---

## 第 1 步：Cloudflare R2（存照片和数据）

1. 打开 https://dash.cloudflare.com/sign-up 注册（免费），登录后左侧菜单找到 **R2** → 按提示「开通 R2」（需绑定一张卡做验证，但不会扣费）。
2. 点 **Create bucket**，取个名字（如 `travel-museum`），地区选离你近的（如 `APAC`），创建。
3. 拿到 **Account ID**：在 R2 页面 URL 里 `https://dash.cloudflare.com/<账户ID>/r2` 就是。
4. 开启**公开访问**：进入刚建的 bucket → **Settings** → **Public access** → 点「Enable public access」，会得到一个公开地址，形如
   `https://<bucket>.r2.dev`
   （这就是 `R2_PUBLIC_URL`。如果你的账号被要求必须用自定义域名才能公开，就到 Cloudflare 的 **DNS** 里加一条 `CNAME` 指向 `<bucket>.r2.dev`，再把 `R2_PUBLIC_URL` 填成你的域名，例如 `https://photos.你的域名.com`。）
5. 生成 API 令牌：R2 页面 → **Manage R2 API Tokens** → **Create API token**：
   - 权限（Permissions）选 **Object Read & Write**（读写对象即可）。
   - 作用范围（Specify bucket）选你这个 bucket。
   - 创建后复制 **Access Key ID** 和 **Secret Access Key**（只显示一次，妥善保存）。

记下这 5 个值，第 3 步要用：
```
R2_ACCOUNT_ID=你的Account ID
R2_ACCESS_KEY_ID=上面的Access Key ID
R2_SECRET_ACCESS_KEY=上面的Secret Access Key
R2_BUCKET=travel-museum
R2_PUBLIC_URL=https://travel-museum.r2.dev
```

---

## 第 2 步：推到 GitHub

1. 在 https://github.com/new 新建一个仓库（如 `travel-museum`），**公开/私有均可**（Render 连私有仓库需要授权，公开更省事）。
2. 在本机项目目录初始化并推送（已装 Git 的前提下）：
   ```bash
   cd travel-museum
   git init
   git add .
   git commit -m "个人旅行博物馆"
   git branch -M main
   git remote add origin https://github.com/你的用户名/travel-museum.git
   git push -u origin main
   ```
   > 注意：`.env` 已被 `.gitignore` 忽略，密码不会上传；上传的是代码和 `render.yaml`。

---

## 第 3 步：Render 部署

1. 打开 https://dashboard.render.com/ 注册并登录（可用 GitHub 登录）。
2. 右上角 **New** → **Blueprint**（或 **Web Service**）→ 授权并选中你的 `travel-museum` 仓库 → Render 会自动读取仓库里的 `render.yaml`。
3. 确认配置：名称 `travel-museum`、计划 `Free`、Build `npm install`、Start `npm start`，然后点 **Create Web Service**。
4. 部署完成后，进入该服务的 **Environment** 标签页，逐个添加以下环境变量（值来自第 1 步，以及你自己设的密码）：

   | 变量 | 值 |
   |---|---|
   | `ADMIN_PASSWORD` | 你的管理员密码（改成自己的强密码） |
   | `JWT_SECRET` | 一段足够长的随机字符串，例如 `openssl rand -hex 32` 的输出 |
   | `R2_ACCOUNT_ID` | 第 1 步的 Account ID |
   | `R2_ACCESS_KEY_ID` | 第 1 步的 Access Key ID |
   | `R2_SECRET_ACCESS_KEY` | 第 1 步的 Secret Access Key |
   | `R2_BUCKET` | bucket 名称，如 `travel-museum` |
   | `R2_PUBLIC_URL` | 公开地址，如 `https://travel-museum.r2.dev` |

   改完变量后，Render 会重新部署一次（**Deploy** → **Manual Deploy** → **Deploy latest commit**）。
5. 部署成功后，Render 给你一个网址，类似 `https://travel-museum.onrender.com`。

---

## 第 4 步：验证 & 使用

1. 手机/电脑浏览器打开 `https://travel-museum.onrender.com` → 看到空展厅。
2. 打开 `https://travel-museum.onrender.com/admin.html`（或页脚隐藏入口）登录。
3. 「+ 新建展区」→ 进展区「+ 上传照片」，把旅行照片传上去。
4. 刷新页面、甚至等它休眠后再打开，照片都还在——因为存在 R2，不在 Render 本地磁盘。
5. 把 `https://travel-museum.onrender.com` 发到手机，随时随地都能看你的博物馆。

> ⚠️ Render 免费档在 15 分钟无访问后会休眠，下次打开约等 1 分钟冷启动；这是免费档唯一的小缺点，数据不会丢。

---

## 其他说明

- **本地 exe 仍可用**：`dist/travel-museum.exe` 不配置 R2 时会自动走本地存储（数据在 exe 同目录的 `data/` 和 `uploads/`），适合电脑本地 / 同 WiFi 看。想让 exe 也用云端存储，在 exe 同目录放 `.env` 填好上面的 R2 变量即可。
- **换存储**：代码是双模式（`server/config.js` 检测 R2 变量）。只要清掉 R2 变量就回退本地；想换别的 S3 兼容存储，改 `config.js` 的 endpoint 即可。
- **安全**：`ADMIN_PASSWORD` / `JWT_SECRET` 只在服务端环境变量里，前端代码里没有任何密码；`render.yaml` 里它们都标了 `sync: false`，需要你手动填，不会进代码库。
