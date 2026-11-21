import { rewriteMediaQuery } from '../../utils/media-query';
import type { Scheme } from '../../utils/scheme';

type MediaOwner = CSSStyleSheet | CSSMediaRule | CSSImportRule;

export function observeStylesheets() {
  const rewrites = new WeakMap<MediaOwner, { original: string; applied: string }>();
  let scheme: Scheme = 'system';
  let scanQueued = false;

  function rewriteMedia(owner: MediaOwner) {
    const media = owner.media;
    const current = media.mediaText;
    const saved = rewrites.get(owner);
    const original = saved?.applied === current ? saved.original : current;
    const next = rewriteMediaQuery(original, scheme);
    if (current !== next) media.mediaText = next;

    if (next === original) rewrites.delete(owner);
    else rewrites.set(owner, { original, applied: media.mediaText });
    return next !== original;
  }

  function scanStyles() {
    const visited = new Set<CSSStyleSheet>();
    let rewritten = 0;
    let inaccessible = 0;

    function inspectMedia(owner: MediaOwner) {
      if (rewriteMedia(owner)) rewritten++;
    }
    function walkSheet(sheet: CSSStyleSheet) {
      if (visited.has(sheet)) return;
      visited.add(sheet);
      inspectMedia(sheet);
      try {
        walkRules(sheet.cssRules);
      } catch (error) {
        // The browser hides the rules of stylesheets that are not origin-clean.
        if (!(error instanceof DOMException && error.name === 'SecurityError')) throw error;
        inaccessible++;
      }
    }

    function walkRules(rules: CSSRuleList) {
      for (const rule of rules) {
        if (rule instanceof CSSImportRule) {
          inspectMedia(rule);
          if (rule.styleSheet) walkSheet(rule.styleSheet);
        } else if (rule instanceof CSSGroupingRule) {
          if (rule instanceof CSSMediaRule) inspectMedia(rule);
          walkRules(rule.cssRules);
        }
      }
    }

    for (const sheet of document.styleSheets) walkSheet(sheet);
    for (const sheet of document.adoptedStyleSheets) walkSheet(sheet);
    return { rewritten, inaccessible };
  }

  function scheduleScan() {
    if (scheme === 'system' || scanQueued) return;
    scanQueued = true;
    queueMicrotask(() => {
      scanQueued = false;
      if (scheme !== 'system') scanStyles();
    });
  }

  const styles = 'style, link[rel~="stylesheet" i]';
  function containsStyles(node: Node) {
    return node instanceof Element && (node.matches(styles) || node.querySelector(styles));
  }

  new MutationObserver((records) => {
    if (scheme === 'system') return;
    if (
      records.some(
        ({ target, addedNodes }) =>
          (target instanceof Element && target.matches('style, link')) ||
          (target.parentElement?.matches('style') ?? false) ||
          [...addedNodes].some(containsStyles),
      )
    )
      scheduleScan();
  }).observe(document, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['href', 'media', 'rel', 'disabled'],
  });

  document.addEventListener(
    'load',
    (event) => {
      if (event.target instanceof Element && event.target.matches(styles)) scheduleScan();
    },
    true,
  );
  document.addEventListener('DOMContentLoaded', scheduleScan, { once: true });

  for (const prototype of [CSSStyleSheet.prototype, CSSGroupingRule.prototype]) {
    const insertRule = prototype.insertRule;
    prototype.insertRule = function (rule: string, index?: number) {
      const result = insertRule.call(this, rule, index);
      scheduleScan();
      return result;
    };
  }

  // These methods are invoked below with the original CSSStyleSheet receiver.
  // oxlint-disable-next-line typescript/unbound-method
  const { replace, replaceSync } = CSSStyleSheet.prototype;
  CSSStyleSheet.prototype.replace = function (text: string) {
    const result = replace.call(this, text);
    void result.then(scheduleScan, () => undefined);
    return result;
  };
  CSSStyleSheet.prototype.replaceSync = function (text: string) {
    replaceSync.call(this, text);
    scheduleScan();
  };

  function setScheme(next: Scheme) {
    scheme = next;
    scanStyles();
  }

  return { scanStyles, setScheme };
}
