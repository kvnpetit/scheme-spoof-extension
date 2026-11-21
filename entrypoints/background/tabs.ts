import { browser } from 'wxt/browser';
import type { ContentMessage, Diagnostics } from '../../utils/messages';
import { isDiagnostics } from '../../utils/messages';
import type { Scheme } from '../../utils/scheme';
import { hostnameFromUrl } from '../../utils/scheme';

export type Tab = { id?: number | undefined; url?: string | undefined };

export async function getTab(tabId?: number): Promise<Tab | undefined> {
  if (tabId !== undefined) return browser.tabs.get(tabId).catch(() => undefined);
  return undefined;
}

function sendToTab(tabId: number, message: ContentMessage): Promise<unknown> {
  return browser.tabs.sendMessage(tabId, message, { frameId: 0 }).catch(() => undefined);
}

export async function inspectTab(tabId: number): Promise<Diagnostics | undefined> {
  const response = await sendToTab(tabId, { type: 'inspect' });
  return isDiagnostics(response) ? response : undefined;
}

export async function ensureContent(tabId: number): Promise<boolean> {
  const target = { tabId };
  try {
    if (await sendToTab(tabId, { type: 'ping' })) return true;
    await browser.scripting.executeScript({
      target,
      files: ['/content-scripts/content.js'],
      world: 'MAIN',
    });
    await browser.scripting.executeScript({ target, files: ['/content-scripts/bridge.js'] });
    return Boolean(await sendToTab(tabId, { type: 'ping' }));
  } catch {
    return false;
  }
}

export async function applyToTab(tab: Tab, scheme: Scheme): Promise<boolean> {
  if (tab.id === undefined) return false;
  const tabId = tab.id;
  const hostname = hostnameFromUrl(tab.url);
  const text = !hostname || scheme === 'system' ? '' : scheme === 'dark' ? 'D' : 'L';

  async function updateBadge() {
    if (text) await browser.action.setBadgeBackgroundColor({ tabId, color: '#5146b5' });
    await browser.action.setBadgeText({ tabId, text });
  }

  const [applied] = await Promise.all([
    hostname ? sendToTab(tabId, { type: 'apply', hostname, scheme }) : undefined,
    updateBadge().catch(() => undefined),
  ]);
  return applied === true;
}
