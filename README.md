# NGA-Web

用于 NGA 玩家社区的浏览器用户脚本：清理页面中已识别的广告 DOM，并在文档开始阶段移除已确认的 Tagtic 广告脚本标签。

## 功能范围

- 移除当前已确认的 Tagtic 广告脚本：
  - `https://g1.tagtic.cn/v1/xingyou/c/*.js`
  - `https://g1.tagtic.cn/g.js`
- 进入 NGA 的 `/misc/adpage_insert*.html` 插页页时，立即跳回其携带的原始 NGA 页面，不等待插页页的 15 秒跳转。
- 清理指向已识别广告域名的链接、图片和 iframe，例如 `hi4fun.com`、`new.wan.360.cn`、`wan.360.cn`、Google 广告、百度广告、阿里妈妈广告等。
- 清理明确标记为广告的 DOM 元素，以及广告删除后可能残留的深色空白广告占位。
- 监听后续动态插入的广告节点；页面加载后的前 10 秒每 500ms 额外扫描一次，以处理延迟填充的广告位。

脚本匹配 `nga.cn` 和 `ngabbs.com` 的 HTTP/HTTPS 页面，使用 `@grant none`，不申请额外权限。

## 安装

1. 在浏览器中安装 [Tampermonkey](https://www.tampermonkey.net/) 或 Violentmonkey 等用户脚本管理器。
2. 打开 [`NGA-AdCleaner.user.js`](./NGA-AdCleaner.user.js)，复制全部内容并新建用户脚本，或通过脚本管理器直接导入该文件。
3. 保存后刷新 NGA 页面。

## 脚本结构

脚本仍保持为单个文件，代码按职责分为四个代码块：

| 模块 | 职责 |
| --- | --- |
| NGA 插页广告跳过 | 只在 `/misc/adpage_insert*.html` 上解析并校验其携带的 NGA 原始地址，然后立即返回原页。 |
| 共享匹配规则 | 集中维护广告域名、DOM 选择器和广告文本规则。 |
| Tagtic 广告脚本移除 | 只匹配并删除 `g1.tagtic.cn` 的上述两个广告脚本路径及其动态插入版本。 |
| 页面广告 DOM 清理 | 删除广告链接、图片、iframe、广告节点及深色空白占位。 |
| 启动与调度 | 启动两个 `MutationObserver`，并执行短时的延迟扫描。 |

## 限制

- 本脚本通过删除 `<script>` 标签和页面 DOM 工作；插页页例外，会使用一次 `location.replace()` 回到经域名校验的原始 NGA 地址。它不会重写普通链接，也不会 Hook `window.open`、`fetch` 或 `XMLHttpRequest`。
- 它不是网络层广告拦截器；如果静态脚本已在用户脚本运行前执行，浏览器扩展的网络拦截规则通常更可靠。
- NGA 的页面结构、广告域名或广告脚本路径发生变化后，匹配规则可能需要更新。

## 本地检查

项目无需安装依赖。修改脚本后可执行：

```bash
node --check NGA-AdCleaner.user.js
git diff --check
```

## 文件说明

- [`NGA-AdCleaner.user.js`](./NGA-AdCleaner.user.js)：用户脚本主体。
- [`README.md`](./README.md)：项目说明和使用方式。
