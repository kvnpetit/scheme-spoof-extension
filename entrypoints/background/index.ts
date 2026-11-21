import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { hasMessageType, isPopupRequest } from '../../utils/messages';
import { hostnameFromUrl, toggleCommand } from '../../utils/scheme';
import { getTabScheme, removeLegacyPreferences, setTabScheme } from '../../utils/storage';
import { handlePopupRequest } from './requests';
import { applyToTab, ensureContent, getTab, inspectTab } from './tabs';
import type { Tab } from './tabs';

async function updateAfterNavigation(tabId: number) {
  const tab = await getTab(tabId);
  if (tab) await applyToTab(tab, await getTabScheme(tabId));
}

async function toggleTabScheme(activeTab?: Tab) {
  const tab = activeTab ?? (await browser.tabs.query({ active: true, lastFocusedWindow: true }))[0];
  const hostname = hostnameFromUrl(tab?.url);
  if (tab?.id === undefined || !hostname || !(await ensureContent(tab.id))) return;

  const current = await getTabScheme(tab.id);
  let isDark = current === 'dark';
  if (current === 'system') {
    await applyToTab(tab, current);
    isDark = (await inspectTab(tab.id))?.matches === 'dark';
  }
  const next = isDark ? 'light' : 'dark';
  await setTabScheme(tab.id, next);
  await applyToTab(tab, next);
}

export default defineBackground(() => {
  let pending: Promise<unknown> = Promise.resolve();

  // Serialize read-modify-write operations across popup, shortcut and tab events.
  function enqueue<T>(work: () => Promise<T>): Promise<T> {
    const result = pending.then(work);
    pending = result.catch((error) =>
      console.warn('SchemeSpoof background operation failed.', error),
    );
    return result;
  }

  browser.runtime.onMessage.addListener((request: unknown, sender, sendResponse) => {
    if (
      hasMessageType(request) &&
      request.type === 'resolve' &&
      sender.frameId === 0 &&
      sender.tab?.id !== undefined
    ) {
      const hostname = hostnameFromUrl(sender.url);
      const tabId = sender.tab.id;
      if (!hostname || !Number.isInteger(tabId)) return false;
      void enqueue(() => getTabScheme(tabId)).then(sendResponse, () => sendResponse(undefined));
      return true;
    }

    if (sender.url !== browser.runtime.getURL('/popup.html') || !isPopupRequest(request))
      return false;
    void enqueue(() => handlePopupRequest(request)).then(sendResponse, () => {
      sendResponse({ ok: false, error: 'SchemeSpoof could not complete the request.' });
    });
    return true;
  });

  browser.tabs.onUpdated.addListener((tabId, change) => {
    if (change.url || change.status === 'complete')
      void enqueue(() => updateAfterNavigation(tabId));
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    void enqueue(() => setTabScheme(tabId, 'system'));
  });

  browser.commands?.onCommand?.addListener((command, activeTab) => {
    if (command === toggleCommand) void enqueue(() => toggleTabScheme(activeTab));
  });

  browser.runtime.onInstalled.addListener(() => void enqueue(removeLegacyPreferences));
});
