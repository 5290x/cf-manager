# External API 文档 (`/v1`)

CF Manager 暴露 `/v1` 系列接口，兼容 OpenAI API 格式，方便本地对接 Cursor、ChatGPT-Next-Web、Open WebUI 等自研测试工具。

> ⚠️ 该接口仅推荐**局域网本地开发调试**使用：禁止直接公网暴露、对外提供给第三方商用；公网开放多账户自动调度接口会违反 Cloudflare 服务条款，存在账号封禁风险；仅用于自有项目本地对接调试，不支持对外分发算力服务。

## 认证

如果后端配置了 `API_SECRET`，所有请求需要在 Header 中携带：

```
Authorization: Bearer <你的 API_SECRET>
```

## Base URL

```
http://<你的服务器地址>:<端口>
```

Docker 部署默认为 `http://localhost:3000`，本地开发为 `http://localhost:3001`。

---

## AI 推理接口

### 获取模型列表

```
GET /v1/models
```

返回当前可用的所有 Cloudflare Workers AI 模型，格式兼容 OpenAI `/v1/models`。

**响应示例：**

```json
{
  "object": "list",
  "data": [
    {
      "id": "@cf/meta/llama-3.1-8b-instruct",
      "object": "model",
      "created": 1718179200,
      "owned_by": "cloudflare"
    },
    {
      "id": "@cf/qwen/qwen2.5-coder-32b-instruct",
      "object": "model",
      "created": 1718179200,
      "owned_by": "cloudflare"
    }
  ]
}
```

---

### 聊天补全

```
POST /v1/chat/completions
```

兼容 OpenAI Chat Completions API，支持流式和非流式模式。默认在单账户内对请求做缓存复用（Prompt Caching 模型 GLM-5.2 / Kimi K2.5 / K2.6 / K2.7-code 优先复用同一账户的缓存），以降低单账号自身神经元消耗；自动账户切换仅为技术调度逻辑，请勿用于跨账号分摊配额。

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `model` | string | 是 | 模型名称，如 `@cf/meta/llama-3.1-8b-instruct` |
| `messages` | array | 是 | 消息列表，OpenAI 格式 |
| `stream` | boolean | 否 | 是否开启流式返回，默认 `false` |

> **提示**：流式模式下 `stream_options.include_usage` 会被自动注入，确保响应包含 `usage` 信息。

**请求示例：**

```json
{
  "model": "@cf/meta/llama-3.1-8b-instruct",
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "Hello!" }
  ],
  "stream": false
}
```

**非流式响应示例：**

```json
{
  "id": "chatcmpl-xxx",
  "object": "chat.completion",
  "created": 1718179200,
  "model": "@cf/meta/llama-3.1-8b-instruct",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you today?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 20,
    "completion_tokens": 10,
    "total_tokens": 30,
    "prompt_tokens_details": {
      "cached_tokens": 0
    }
  }
}
```

**流式响应：**

当 `stream: true` 时，返回 SSE（Server-Sent Events）格式，与 OpenAI 流式格式一致：

```
data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","choices":[{"delta":{"content":"Hello"},"index":0}]}

data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","choices":[{"delta":{"content":"!"},"index":0}]}

data: [DONE]
```

**错误响应：**

| HTTP 状态码 | 场景 |
|---|---|
| 401 | 缺少或无效的 Authorization Header |
| 429 | 所有账户配额已耗尽 |
| 503 | 没有可用账户 |

```json
{
  "error": {
    "message": "All accounts have reached daily neuron limit",
    "type": "quota_exceeded",
    "code": "ALL_ACCOUNTS_EXHAUSTED"
  }
}
```

---

## AI 图片生成

### 生成图片

```
POST /v1/images/generations
```

兼容 OpenAI Images API，调用 Cloudflare Workers AI 生成图片。支持文生图和图生图。

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `model` | string | 是 | 模型名称，如 `@cf/black-forest-labs/flux-1-schnell` |
| `prompt` | string | 是 | 提示词 |
| `image` | string | 否 | 图生图模式下的参考图（base64，不含 Data URL 前缀） |
| `num_steps` | number | 否 | 生成步数，Flux 默认 4，SDXL 默认 20 |
| `width` | number | 否 | 图片宽度（仅 SDXL，默认 1024） |
| `height` | number | 否 | 图片高度（仅 SDXL，默认 1024） |
| `guidance` | number | 否 | 引导强度（仅 SDXL，默认 7.5） |
| `negative_prompt` | string | 否 | 反向提示词（仅 SDXL） |
| `strength` | number | 否 | 图生图强度 0-1（仅 SDXL，默认 0.6） |

**请求示例：**

```json
{
  "model": "@cf/black-forest-labs/flux-1-schnell",
  "prompt": "a cute cat sitting on a windowsill"
}
```

**成功响应：**

```json
{
  "created": 1718179200,
  "data": [
    {
      "b64_json": "iVBORw0KGgoAAAANSUhEUgAA...",
      "neurons": 12
    }
  ]
}
```

---

## AI 语音合成

### 生成语音

```
POST /v1/audio/speech
```

兼容 OpenAI Audio API，调用 Cloudflare Workers AI 生成语音。

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `model` | string | 是 | 模型名称，如 `@cf/myshell-ai/melotts` |
| `input` | string | 是 | 要合成语音的文本（最多 5000 字符） |
| `voice` | string | 否 | 说话人名称，默认 `luna` |

> 支持的说话人：OpenAI 兼容语音 `alloy`/`echo`/`fable`/`onyx`/`nova`/`shimmer`（自动映射到 CF 原生说话人），以及 CF 原生说话人 `luna`/`mars`/`athena`/`apollo` 等 40+ 种。

**请求示例：**

```json
{
  "model": "@cf/myshell-ai/melotts",
  "input": "Hello, world!",
  "voice": "alloy"
}
```

**成功响应：**

```json
{
  "created": 1718179200,
  "data": [
    {
      "audio": "SGVsbG8sIHdvcmxkIQ==...",
      "content_type": "audio/mpeg",
      "neurons": 8
    }
  ]
}
```

---

## AI 文本翻译

### 翻译文本

```
POST /v1/translations
```

调用 Cloudflare Workers AI 翻译模型，支持多语言翻译。

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `model` | string | 是 | 模型名称 |
| `text` | string | 是 | 要翻译的文本 |
| `source_lang` | string | 否 | 源语言代码（M2M100 用，如 `en`/`zh`/`ja`，不填自动检测） |
| `target_lang` | string | 是 | 目标语言代码 |

**支持的模型：**

| 模型 | source_lang 格式 | target_lang 格式 | 支持的源语言 |
|---|---|---|---|
| `@cf/meta/m2m100-1.2b` | `en`/`zh`/`ja`/`fr` 等语言代码 | 同左 | 多语言互译 |
| `@cf/ai4bharat/indictrans2-en-indic-1B` | 固定 `en`（英语） | `hin_Deva`/`ben_Beng`/`tam_Taml` 等 | 仅 English → 印度语系 |

**请求示例（M2M100）：**

```json
{
  "model": "@cf/meta/m2m100-1.2b",
  "text": "Hello, world!",
  "source_lang": "en",
  "target_lang": "zh"
}
```

**请求示例（IndicTrans2）：**

```json
{
  "model": "@cf/ai4bharat/indictrans2-en-indic-1B",
  "text": "Hello, world!",
  "target_lang": "hin_Deva"
}
```

**成功响应：**

```json
{
  "created": 1718179200,
  "data": [
    {
      "translated_text": "你好，世界！",
      "source_lang": "en",
      "target_lang": "zh",
      "neurons": 5
    }
  ]
}
```

---

## 浏览器渲染接口

### 渲染页面

```
POST /v1/browser/render
```

使用 Cloudflare Browser Rendering API 渲染指定 URL 的网页，支持截图、内容提取等多种模式。

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `url` | string | 是 | 要渲染的网页 URL |
| `mode` | string | 否 | 渲染模式，默认 `screenshot` |
| `accountId` | number | 否 | 指定账户 ID，不填则自动选择 |

**支持的渲染模式：**

| mode | 返回字段 | 数据格式 |
|---|---|---|
| `screenshot` | `result.screenshot` | `data:image/png;base64,...` Data URL |
| `content` | `result.html` | 原始 HTML 字符串 |
| `markdown` | `result.markdown` | Markdown 文本 |
| `pdf` | `result.pdf` | `data:application/pdf;base64,...` Data URL |
| `links` | `result.links` | URL 字符串数组 |

**请求示例：**

```json
{
  "url": "https://example.com",
  "mode": "markdown"
}
```

**成功响应 - screenshot 模式：**

```json
{
  "success": true,
  "result": {
    "mode": "screenshot",
    "screenshot": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "duration": 2.345,
    "browserMsUsed": 2345
  }
}
```

**成功响应 - content 模式：**

```json
{
  "success": true,
  "result": {
    "mode": "content",
    "html": "<!DOCTYPE html><html><head><title>Example Domain</title></head><body>...</body></html>",
    "duration": 1.234,
    "browserMsUsed": 1234
  }
}
```

**成功响应 - markdown 模式：**

```json
{
  "success": true,
  "result": {
    "mode": "markdown",
    "markdown": "# Example Domain\n\nThis domain is for use in illustrative examples in documents...",
    "duration": 1.567,
    "browserMsUsed": 1567
  }
}
```

**成功响应 - pdf 模式：**

```json
{
  "success": true,
  "result": {
    "mode": "pdf",
    "pdf": "data:application/pdf;base64,JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAv...",
    "duration": 3.456,
    "browserMsUsed": 3456
  }
}
```

**成功响应 - links 模式：**

```json
{
  "success": true,
  "result": {
    "mode": "links",
    "links": [
      "https://www.iana.org/domains/example",
      "https://example.com/about",
      "https://example.com/contact"
    ],
    "duration": 1.890,
    "browserMsUsed": 1890
  }
}
```

> **说明：**
> - `duration`：总耗时（秒），包含网络请求和浏览器渲染
> - `browserMsUsed`：Cloudflare 浏览器实际渲染耗时（毫秒），用于配额计费
> - `screenshot` 和 `pdf` 返回 Data URL 格式，可直接用于 `<img>` 标签或下载
> - Data URL 前缀包含 MIME 类型，方便前端直接使用

**错误响应：**

| HTTP 状态码 | 场景 |
|---|---|
| 400 | 缺少 url 或无效的 mode |
| 404 | 指定的 accountId 不存在 |
| 429 | 请求频率过高或所有账户配额耗尽 |
| 500 | 渲染失败 |

```json
{
  "success": false,
  "error": {
    "message": "所有账户今日浏览器渲染配额已耗尽",
    "code": "ALL_ACCOUNTS_EXHAUSTED"
  }
}
```

### 查看渲染状态

```
GET /v1/browser/status
```

返回当前浏览器渲染的账户可用状态。

**成功响应：**

```json
{
  "available_accounts": 3,
  "total_accounts": 5,
  "token_interval_ms": 5000
}
```

| 字段 | 说明 |
|---|---|
| `available_accounts` | 当前可用的渲染账户数（未耗尽配额） |
| `total_accounts` | 启用了浏览器渲染的账户总数 |
| `token_interval_ms` | 令牌桶间隔（毫秒），控制请求频率 |

---

## 使用示例

### Cursor 配置

在 Cursor 设置中将 API 地址配置为本服务的 `/v1` 端点：

```
Base URL: http://localhost:3000/v1
API Key:  <你的 API_SECRET，没配置则留空>
```

### Python (openai SDK)

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:3000/v1",
    api_key="your-api-secret",  # 没配置 API_SECRET 则随意填
)

response = client.chat.completions.create(
    model="@cf/meta/llama-3.1-8b-instruct",
    messages=[{"role": "user", "content": "Hello!"}],
)
print(response.choices[0].message.content)
```

### curl

```bash
# 非流式
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-secret" \
  -d '{
    "model": "@cf/meta/llama-3.1-8b-instruct",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'

# 流式
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-secret" \
  -d '{
    "model": "@cf/meta/llama-3.1-8b-instruct",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": true
  }'

# 浏览器渲染
curl http://localhost:3000/v1/browser/render \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-secret" \
  -d '{"url": "https://example.com", "mode": "markdown"}'
```
