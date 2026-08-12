# 安全策略 / Security Policy

## 受支持的版本 / Supported Versions

我们目前为以下版本提供安全更新 / We currently provide security updates for the following versions：

| 版本 / Version | 是否支持 / Supported |
| ------- | ------------------ |
| 2.x | ✅ |
| < 2.0 | ❌ |

## 报告安全漏洞 / Reporting a Vulnerability

如果你在 CF Manager 中发现安全漏洞，请负责任地报告。
If you discover a security vulnerability in CF Manager, please report it responsibly.

**请不要就安全漏洞在公开 Issue 中讨论。**
**Please do not open public issues for security vulnerabilities.**

请改为通过以下方式发送邮件给维护者 / Instead, send an email to the maintainer with：

- 对漏洞的清晰描述 / A clear description of the vulnerability
- 复现步骤 / Steps to reproduce the issue
- 潜在影响评估 / Potential impact assessment
- 建议的修复或缓解措施（如有）/ Suggested fix or mitigation (if any)

我们目标在 48 小时内回应安全报告，并与你协作核实、处理问题。
We aim to respond to security reports within 48 hours and will work with you to verify and address the issue.

## 安全最佳实践 / Security Best Practices

部署 CF Manager 时，请遵循以下建议 / When deploying CF Manager, please follow these recommendations：

- 使用强度足够、随机生成的 `ENCRYPTION_KEY`
- 为管理界面设置强度足够的 `API_SECRET`
- 将 Cloudflare API Token 的权限收敛到最小必要范围 / Keep tokens scoped to minimum required permissions
- 不要在没有额外保护的情况下将 `/admin/` 路径或管理界面暴露于公网 / Do not expose `/admin/` without additional protection
- 生产环境使用 HTTPS/TLS / Use HTTPS/TLS in production
- 定期更新依赖并拉取最新版本 / Regularly update dependencies
- 只添加你拥有或获得授权管理的 Cloudflare 账户 / Only add accounts you own or are authorized to manage

## 披露策略 / Disclosure Policy

我们遵循协同披露（coordinated disclosure）流程。在修复发布后，我们会发布安全公告，并在更新日志中补充相关细节。
We follow a coordinated disclosure process. After a fix is released, we will publish a security advisory and update the changelog.

## 已知安全注意事项 / Known Security Considerations

- 根路径（`/`）被刻意伪装成 nginx 欢迎页，以避免被随意扫描 / The root path is disguised as an nginx welcome page
- 浏览器渲染功能会接受外部 URL，请仅使用可信来源以防范 SSRF 风险 / Browser rendering accepts external URLs; use only trusted sources
- OpenAI 兼容 API 仅设计用于本地/内网环境 / The OpenAI-compatible API is for local/internal use only
