# 为 CF Manager 贡献代码 / Contributing to CF Manager

感谢你关注并愿意为 CF Manager 做出贡献！本文档提供了贡献的指引与说明。
Thank you for your interest in contributing to CF Manager! This document provides guidelines and instructions for contributing.

## 开始之前 / Getting Started

1. Fork 本仓库 / Fork the repository
2. 克隆你的 Fork / Clone your fork：`git clone https://github.com/YOUR_USERNAME/cf-manager.git`
3. 新建分支 / Create a branch：`git checkout -b feature/your-feature-name`

## 开发环境搭建 / Development Setup

### 后端（Docker 版）/ Backend (Docker version)

```bash
cd backend
npm install
ENCRYPTION_KEY="dev-key" npm run dev
```

### 前端 / Frontend

```bash
cd frontend
npm install
npm run dev
```

### Worker（Cloudflare Pages 版）/ Worker (Cloudflare Pages version)

```bash
cd worker
npm install
npm run dev
```

## 项目结构 / Project Structure

CF Manager 采用双后端架构 / CF Manager uses a dual-backend architecture：

- `backend/` —— 用于 Docker 部署的 Express 后端 / Express backend for Docker
- `worker/` —— 用于 Cloudflare Pages 部署的 Hono 后端 / Hono backend for Cloudflare Pages
- `frontend/` —— 两端共用的 Vue 3 前端 / shared Vue 3 frontend
- `shared/` —— 共享资源（唯一真实来源）/ shared resources (single source of truth)

**重要**：绝大多数后端改动需要同时在 `backend/` 与 `worker/` 两端对称实现。
**Important**: Most backend changes must be implemented symmetrically in both `backend/` and `worker/`.

## 如何贡献 / How to Contribute

### 报告 Bug / Reporting Bugs

- 使用 [Bug 报告模板](.github/ISSUE_TEMPLATE/bug_report.md) / Use the bug report template
- 包含复现步骤、预期与实际行为 / Include steps to reproduce, expected & actual behavior
- 说明你使用的部署方式（Docker 或 Cloudflare Pages）/ Mention your deployment method
- 附上相关日志或截图 / Include logs or screenshots

### 提出功能建议 / Suggesting Features

- 使用 [功能请求模板](.github/ISSUE_TEMPLATE/feature_request.md) / Use the feature request template
- 清晰描述问题以及你提议的方案 / Clearly describe the problem and proposed solution
- 说明该功能为何有用 / Explain why it would be useful

### 提交 Pull Request / Pull Requests

1. 确保代码符合现有风格与约定 / Follow existing style & conventions
2. 提交前运行 lint 与类型检查 / Run linting and type checking
3. 在 `CHANGELOG.md` 对应版本下补充变更说明 / Update `CHANGELOG.md`
4. 若新增后端功能，确保 Express 与 Hono 两端均已更新 / Update both Express and Hono
5. 完整填写 Pull Request 模板 / Fill out the PR template completely
6. 关联相关 Issue / Link related issues

## 代码约定 / Code Conventions

- 已开启 TypeScript `strict` 模式 / TypeScript `strict` mode enabled
- 文件与变量使用 camelCase / camelCase for files & variables
- 类型与接口使用 PascalCase / PascalCase for types & interfaces
- 可添加有意义的中文或英文注释 / Comments in English or Chinese
- 不要手动编辑自动生成的文件（`version.ts`、`catalogValidate.generated.ts` 及 `backend/src/data/`、`worker/src/data/` 下文件）/ Do not manually edit auto-generated files

## 共享资源 / Shared Resources

修改 `shared/` 下的文件时 / When modifying files in `shared/`：

1. 编辑 `shared/` 中的源文件 / Edit the source file in `shared/`
2. 运行 `node scripts/sync-shared.js` 同步改动 / Run `node scripts/sync-shared.js`
3. 确认 backend 与 worker 两端都收到更新 / Verify both backends receive updates

## 测试 / Testing

- 提交前在本地测试你的改动 / Test locally before submitting
- 双后端相关的改动，尽量分别测试 Docker 版与 Worker 版 / Test both backends when possible
- 确认前端工作正常 / Verify frontend works correctly

## 有疑问？/ Questions?

如果关于贡献有疑问，欢迎直接开 Issue 讨论。
Feel free to open an issue for discussion if you have questions about contributing.
