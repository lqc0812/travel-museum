# 打包成可双击打开的程序（.exe）

本项目支持两种方式变成「双击即可打开」的程序。

---

## 方式一：免编译启动器（最简单，前提是本机已装 Node.js）

直接双击项目里的 **`启动博物馆.bat`** 即可：

- 首次运行会自动 `npm install`；
- 然后启动服务并自动打开浏览器到 http://localhost:3000 ；
- 后台那个命令行窗口是服务，关掉它就停止服务。
- 后台那个命令行窗口是服务，关掉它就停止服务。

> 适合自己用。数据存在项目目录的 `data/museum.json` 与 `uploads/`。

---

## 方式二：编译成单个 .exe（无需安装 Node，可发给别人）

### 1. 安装打包工具（仅需一次）
```bash
npm install
```

### 2. 编译
```bash
npm run build:exe
```
成功后会在 `dist/` 目录生成 `travel-museum.exe`。

### 3. 使用
- 把 `dist/travel-museum.exe` 复制到一个**你有权限写入的文件夹**（如「文档」或「桌面」新建的文件夹，不要放 C 盘根目录或 Program Files）；
- 双击 `travel-museum.exe`，会自动打开浏览器进入博物馆；
- 数据（数据库 `museum.json` 与上传的图片）会自动保存在 **exe 同目录** 的 `data/` 和 `uploads/` 里，换电脑时连同这两个文件夹一起拷贝即可。

### 4. 管理员密码
打包后的程序仍从环境变量读取密码。两种办法：
- 简单：在 `dist/` 目录放一个 `.env` 文件（内容同项目根目录的 `.env.example`），程序启动时会读取；
- 或设置系统环境变量 `ADMIN_PASSWORD` 与 `JWT_SECRET`。

> 若未设置 `ADMIN_PASSWORD`，则任何人都能通过 `/admin.html` 管理——**务必设置**。

---

## 常见问题

- **编译时卡在下载 Node 运行时 / 报错网络**：`pkg` 需要从 GitHub 下载 Node 运行时，部分网络环境会被墙。可在能访问 GitHub 的机器上执行 `npm run build:exe`，再把 `dist/` 拷回来。
- **双击 exe 没反应**：确认 exe 所在目录你有写入权限（不要在只读目录），并检查同目录是否生成了 `data/`、`uploads/`。
- **改了密码要重新打包吗**：不用。密码走环境变量 / `.env`，改完重启 exe 即可。
