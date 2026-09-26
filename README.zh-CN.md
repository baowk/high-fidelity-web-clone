# High-Fidelity Web Clone

一个用于 Codex 的高保真网页复刻 skill，帮助复现网站的公开 UI、响应式布局和可观察交互，并通过浏览器证据进行验证。

这个工作流把目标网站当作产品规格：先整理可用源码和运行时状态，再复现页面结构、样式和交互，最后在相同的路由、视口和输入序列下对比原站与 clone。源码可以加快实现，但最终以浏览器中的实际行为为准。

## 安装

将仓库克隆到 Codex skills 目录：

```bash
mkdir -p ~/.codex/skills
git clone git@github.com:baowk/high-fidelity-web-clone.git \
  ~/.codex/skills/high-fidelity-web-clone
```

如果 Codex 没有自动发现 skill，请重启或刷新 Codex。

## 使用

在网页复刻请求中调用：

```text
$high-fidelity-web-clone 复刻 https://example.com，生成一个本地响应式网站。
```

这个 skill 主要面向公开页面和可观察的前端行为。登录、支付、私有 API 和服务端业务逻辑需要使用本地替代方案，并在交付说明中明确范围。

## 工作流程

1. 明确路由、视口尺寸和复刻范围。
2. 按 HTML/DOM、CSS、JavaScript、资源/字体和数据/网络整理源码。
3. 采集浏览器状态、截图、网络请求、控制台输出和交互轨迹。
4. 按证据重建页面结构、样式、响应式规则和状态变化。
5. 在原站和 clone 上回放相同操作，对比截图、几何尺寸、URL、资源和错误。
6. 输出已测试状态、误差阈值、已知差异和受限资源。

交互状态记录格式见 [`references/state-capture.md`](references/state-capture.md)，源码归类模板见 [`references/source-inventory.md`](references/source-inventory.md)。

## 验收原则

- 原站和 clone 使用相同的路由、视口、浏览器条件和输入序列。
- 菜单、弹窗、懒加载、粘性导航和滚动动画等重要中间状态也要检查。
- 明确记录几何误差和截图 diff 阈值，并说明动态内容造成的例外。
- 不要静默替换缺失的字体、图片、API 或交互。
- 复制或发布源码、文字、品牌和媒体前检查其许可和使用条款。

## 可执行工具链

仓库提供可选的 Node 工具，用于重复执行证据采集和一致性验证。工具使用项目已有的 Playwright 或 Chrome，不会自动下载浏览器。

```bash
npm install

npm run capture -- \
  --url http://127.0.0.1:4173/ \
  --name home \
  --full-page

npm run replay -- --flow path/to/home-flow.json --trace

npm run compare -- \
  --reference artifacts/reference/home/screenshot.png \
  --clone artifacts/clone/home/screenshot.png \
  --fail-ratio 0.01
```

工具说明、flow JSON 格式、页面 ready 标记和截图阈值见 [`references/toolkit.md`](references/toolkit.md)。

如果 Playwright 没有可用的托管浏览器，可以指定本机已有的 Chrome 或 Chromium：

```bash
npm run capture -- \
  --url http://127.0.0.1:4173/ \
  --executable-path "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
```

clone 建议在数据和可见 UI 准备完成后设置：

```html
<body data-page-ready="true">
```

回放工具会在每个交互前等待这个 ready 检查点。第三方原站通常没有这个标记，因此采集原站时可以不强制要求；验证 clone 时可以使用 `requireMarker: true`。

## 仓库内容

- `SKILL.md`：skill 的触发条件、工作流程和验收标准。
- `references/state-capture.md`：交互状态记录和回放格式。
- `references/source-inventory.md`：HTML/DOM、CSS、JavaScript、资源和网络映射模板。
- `references/toolkit.md`：可执行采集、回放和截图对比说明。
- `scripts/`：Playwright 采集、flow 回放、ready 检测和像素 diff 工具。
- `agents/openai.yaml`：Codex skill 展示信息。

## 范围限制

工具可以提高复刻过程的可重复性，但不会自动实现私有后端、登录后的业务逻辑或动态数据服务。跨域资源、受限字体、媒体和接口需要记录实际限制，不能用未说明的占位内容掩盖差异。

[English README](README.md)

