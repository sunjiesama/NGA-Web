// ==UserScript==
// @name         NGA 直接删除广告 DOM
// @namespace    https://nga.cn/
// @version      0.3.4
// @description  删除 NGA 广告 DOM，移除 Tagtic 广告 script，并跳过 NGA 插页广告。
// @author       xianfish-codex
// @match        http://nga.cn/*
// @match        https://nga.cn/*
// @match        http://*.nga.cn/*
// @match        https://*.nga.cn/*
// @match        http://*.ngabbs.com/*
// @match        https://*.ngabbs.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  // =============================================================================
  // 模块 0：NGA 插页广告跳过
  // 职责：进入 /misc/adpage_insert*.html 时，立即回到其携带的 NGA 原始页面。
  // =============================================================================
  const NGA_AD_INTERSTITIAL_PATH_RE = /^\/misc\/adpage_insert(?:_\d+)?\.html$/i;
  const NGA_TRUSTED_HOST_RE = /^(?:[a-z0-9-]+\.)?(?:nga\.cn|nga\.donews\.com|ngacn\.cc|178\.com|ngabbs\.com|bigccq\.cn)$/i;

  function getNgaAdInterstitialTarget() {
    if (!NGA_AD_INTERSTITIAL_PATH_RE.test(location.pathname)) return null;

    // NGA 以 ?https://bbs.nga.cn/read.php?... 的形式携带原始跳转地址；
    // 兼容其原页 getJump() 对可选数字前缀的处理。
    const rawTarget = location.search.slice(1).replace(/^\d+/, '');
    if (!rawTarget) return null;

    try {
      const target = new URL(rawTarget, location.href);
      if (!/^https?:$/.test(target.protocol)) return null;
      if (!NGA_TRUSTED_HOST_RE.test(target.hostname)) return null;
      if (NGA_AD_INTERSTITIAL_PATH_RE.test(target.pathname)) return null;
      return target.href;
    } catch {
      return null;
    }
  }

  function bypassNgaAdInterstitial() {
    const target = getNgaAdInterstitialTarget();
    if (!target) return false;

    location.replace(target);
    return true;
  }

  // 在插页文档开始阶段结束当前脚本，避免执行插页广告的后续页面逻辑。
  if (bypassNgaAdInterstitial()) return;

  // =============================================================================
  // 模块 1：共享匹配规则
  // =============================================================================
  // 广告域名黑名单：当前页面已观察到 hi4fun.com、new.wan.360.cn。
  const AD_HOST_KEYWORDS = [
    'hi4fun.com',
    'new.wan.360.cn',
    'wan.360.cn',
    'doubleclick.net',
    'googlesyndication.com',
    'googleadservices.com',
    'cpro.baidu.com',
    'pos.baidu.com',
    'alimama.com',
    'tanx.com',
  ];

  // 只使用比较明确的广告选择器，避免 [class*=ad] 误伤 read / head / thread 等正文节点。
  const AD_SELECTORS = [
    'iframe[src]',
    'script[src]',
    'img[src]',
    'a[href]',
    '[id^="ad_"]',
    '[id$="_ad"]',
    '[id="ad"]',
    '[class~="ad"]',
    '[class~="ads"]',
    '[class~="advert"]',
    '[class~="advertise"]',
    '[data-ad]',
    '[data-ads]',
    '[data-ad-slot]',

    // NGA 广告内容被删除后常留下的右侧空广告列
    'td.null[style*="background"]',
    'td[class="null"]',
  ];

  const AD_TEXT_RE = /^(广告|推广|赞助|赞助商广告|ADVERTISEMENT|AD)$/i;

  // =============================================================================
  // 模块 2：Tagtic 广告脚本移除
  // 职责：只删除 g1.tagtic.cn 的广告 <script> 标签及其动态插入版本。
  // =============================================================================
  // 直接删除当前页面注入的 Tagtic 广告脚本；不拦截跳转、网络或其他页面 API。
  function isTagticAdScript(script) {
    if (script?.tagName !== 'SCRIPT') return false;

    try {
      const url = new URL(script.getAttribute('src') || script.src, location.href);
      return url.hostname === 'g1.tagtic.cn' && (url.pathname === '/g.js' || /^\/v1\/xingyou\/c\/[^/]+\.js$/i.test(url.pathname));
    } catch {
      return false;
    }
  }

  function removeTagticAdScript(script) {
    if (isTagticAdScript(script)) script.remove();
  }

  function removeTagticAdScripts(root) {
    if (!root) return;

    if (root.nodeType === Node.ELEMENT_NODE) removeTagticAdScript(root);
    root.querySelectorAll?.('script[src]').forEach(removeTagticAdScript);
  }

  function startTagticAdScriptRemoval() {
    removeTagticAdScripts(document);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes') removeTagticAdScript(mutation.target);
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) removeTagticAdScripts(node);
        });
      }
    });

    observer.observe(document, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src'],
    });

    document.addEventListener('DOMContentLoaded', () => removeTagticAdScripts(document), { once: true });
  }

  // =============================================================================
  // 模块 3：页面广告 DOM 清理
  // 职责：删除广告链接、图片、iframe 与残留的深色空广告占位。
  // =============================================================================
  function hasAdUrl(node) {
    const url = node?.getAttribute?.('href') || node?.getAttribute?.('src') || '';
    if (!url) return false;
    const lower = url.toLowerCase();
    return AD_HOST_KEYWORDS.some((keyword) => lower.includes(keyword));
  }

  function isLikelyAdNode(node) {
    if (!node || node.nodeType !== 1) return false;

    if (hasAdUrl(node)) return true;

    const id = String(node.id || '').toLowerCase();
    const cls = String(node.className || '').toLowerCase();
    const text = String(node.textContent || '').replace(/\s+/g, '').trim();

    // 精确一点的 id/class 判断，避免误删正文。
    if (/^(ad|ads|advert|advertise|sponsor)(-|_|$)/.test(id)) return true;
    if (/(^|\s)(ad|ads|advert|advertise|sponsor)(\s|$)/.test(cls)) return true;
    if (text && text.length <= 16 && AD_TEXT_RE.test(text)) return true;

    // NGA 帖子右侧广告位：广告链接删除后会残留 <td class="null" style="background: rgb(66, 61, 53); ..."></td>。
    if (node.tagName === 'TD' && cls === 'null' && text.length === 0) {
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      if (rect.width >= 80 && rect.height >= 80 && isDarkColor(style.backgroundColor)) return true;
    }

    return false;
  }

  function pickDeleteTarget(node) {
    if (!node || node.nodeType !== 1) return null;

    // 链接/图片/iframe 广告，优先删除最近的小容器，避免只删 a 后留下大空白。
    if (hasAdUrl(node)) {
      const candidates = [];
      let cur = node;
      for (let i = 0; cur && i < 4; i += 1, cur = cur.parentElement) {
        candidates.push(cur);
      }

      for (const el of candidates) {
        if (!el || el === document.body || el === document.documentElement) continue;
        const text = String(el.textContent || '').replace(/\s+/g, '').trim();
        const rect = typeof el.getBoundingClientRect === 'function' ? el.getBoundingClientRect() : null;
        const smallText = text.length <= 30;
        const notWholePage = !rect || (rect.width < window.innerWidth * 0.95 && rect.height < window.innerHeight * 0.8);
        if (smallText && notWholePage) return el;
      }
    }

    return node;
  }

  function removeElement(node) {
    const target = pickDeleteTarget(node);
    if (target && target.parentNode) target.remove();
  }


  function isDarkColor(color) {
    const m = String(color || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/i);
    if (!m) return false;
    const r = Number(m[1]);
    const g = Number(m[2]);
    const b = Number(m[3]);
    const a = m[4] == null ? 1 : Number(m[4]);
    return a > 0.2 && r <= 80 && g <= 80 && b <= 80;
  }

  function isEmptyDarkPlaceholder(node) {
    if (!node || node.nodeType !== 1) return false;
    if (node === document.body || node === document.documentElement) return false;

    const text = String(node.textContent || '').replace(/\s+/g, '').trim();
    if (text.length > 2) return false;

    const rect = typeof node.getBoundingClientRect === 'function' ? node.getBoundingClientRect() : null;
    if (!rect) return false;

    const width = rect.width;
    const height = rect.height;
    if (width <= 0 || height <= 0) return false;

    // 当前 NGA 漏出的黑色广告占位常见形态：右侧竖条，或帖子间横条。
    const looksLikeSideBlock = width >= 80 && height >= 80;
    const looksLikeHorizontalBar = width >= 300 && height >= 6 && height <= 40;
    if (!looksLikeSideBlock && !looksLikeHorizontalBar) return false;

    // 避免误删整页/大正文容器。
    const viewportArea = Math.max(1, window.innerWidth * window.innerHeight);
    const area = width * height;
    if (area > viewportArea * 0.35) return false;

    const style = window.getComputedStyle(node);
    return isDarkColor(style.backgroundColor) || isDarkColor(style.borderColor);
  }

  function removeEmptyDarkPlaceholders(root) {
    if (!root || root.nodeType !== 1) return;

    if (isEmptyDarkPlaceholder(root)) {
      removeElement(root);
      return;
    }

    root.querySelectorAll?.('div, aside, section, ins, iframe, td').forEach((node) => {
      if (isEmptyDarkPlaceholder(node)) removeElement(node);
    });
  }

  function clean(root = document) {
    if (!root) return;

    // root 本身也检查一次。
    if (root.nodeType === 1 && isLikelyAdNode(root)) {
      removeElement(root);
      return;
    }

    const scope = root.querySelectorAll ? root : document;
    for (const selector of AD_SELECTORS) {
      scope.querySelectorAll(selector).forEach((node) => {
        if (isLikelyAdNode(node)) removeElement(node);
      });
    }

    removeEmptyDarkPlaceholders(scope.nodeType === 1 ? scope : document.documentElement);
  }

  // =============================================================================
  // 模块 4：启动与调度
  // 职责：先启动脚本移除模块，再启动原有 DOM 清理与延迟扫描。
  // =============================================================================
  function start() {
    clean(document);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) clean(node);
        });
      }
    });

    observer.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'src', 'href'],
    });

    // NGA 有些广告位不是新增节点，而是页面脚本稍后给已有 td 写入深色背景；
    // 前几秒主动扫几次，避免留下黑色空块。
    let sweepLeft = 20;
    const sweepTimer = window.setInterval(() => {
      clean(document);
      sweepLeft -= 1;
      if (sweepLeft <= 0) window.clearInterval(sweepTimer);
    }, 500);
  }

  startTagticAdScriptRemoval();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
    // document-start 阶段也尽量先扫一次已有节点。
    if (document.documentElement) clean(document);
  } else {
    start();
  }
})();
