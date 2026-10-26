
# MBLog

MBLog 是一个轻量的个人博客与作品展示网站。

## 功能

- 响应式首页、文章列表、文章详情
- 作品列表与作品详情
- 管理员登录
- 文章和作品的创建、编辑、删除
- 草稿与发布状态管理
- Slug 自动生成与唯一性检查
- Cloudflare Pages Functions API
- Cloudflare D1 数据库
- 系统主题切换
- 公开页面仅显示已发布内容

## 技术结构

- 前端：HTML、CSS、JavaScript
- 部署：Cloudflare Pages
- 后端：Cloudflare Pages Functions
- 数据库：Cloudflare D1

## 目录

```text
CFBlog/
├── index.html
├── blog.html
├── post.html
├── about.html
├── portfolio.html
├── project.html
├── admin.html
├── css/
│   └── style.css
├── js/
│   ├── site.js
│   ├── home.js
│   ├── blog.js
│   ├── post.js
│   ├── portfolio.js
│   ├── project.js
│   └── admin.js
├── functions/
│   └── api/
│       └── [[path]].js
└── migrations/
    └── 0001_init.sql
```

## 部署前检查

1. 确认所有 HTML、CSS、JavaScript 文件都已提交。
2. 创建 Cloudflare D1 数据库。
3. 将数据库绑定命名为 `DB`。
4. 执行 `migrations/0001_init.sql`。
5. 为 Pages 项目配置 `ADMIN_PASSWORD`。
6. 为 Pages 项目配置随机生成的 `SESSION_SECRET`。
7. 部署 Pages 项目并测试公开页面和后台接口。

## 安全说明

- 不要将管理员密码或 SESSION_SECRET 提交到 GitHub。
- 不要将草稿通过公开 API 返回。
- 发布前应测试登录、权限校验、限流和数据库读写。
- 定期导出备份数据库。
- 纯文本正文不会被当作 HTML 执行。

## 项目状态

本项目需要在 Cloudflare Pages 环境中完成实际部署和验证后，才能视为可用版本。
