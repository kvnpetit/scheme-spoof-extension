import type { PopupRequest, PopupResponse } from '../../utils/messages';
import { hostnameFromUrl, isScheme } from '../../utils/scheme';
import { getTabScheme, setTabScheme } from '../../utils/storage';
import { applyToTab, ensureContent, getTab, inspectTab } from './tabs';

export async function handlePopupRequest(request: PopupRequest): Promise<PopupResponse> {
  const tab = await getTab(request.tabId);
  const hostname = hostnameFromUrl(tab?.url);
  if (tab?.id === undefined || !hostname) {
    return request.type === 'set-tab'
      ? { ok: false, error: 'Open a web page to choose a theme.' }
      : { ok: true, scheme: 'system' };
  }

  const tabId = tab.id;
  if (request.type === 'set-tab') {
    if (hostname !== request.hostname)
      return { ok: false, error: 'The tab changed. Reopen the popup to choose a theme.' };
    if (!isScheme(request.scheme)) return { ok: false, error: 'Unknown color scheme.' };
    await setTabScheme(tabId, request.scheme);
    await ensureContent(tabId);
    const applied = await applyToTab(tab, request.scheme);
    return { ok: true, scheme: request.scheme, applied };
  }

  const scheme = await getTabScheme(tabId);
  if (request.type === 'load') return { ok: true, scheme };
  if (request.type !== 'inspect') return { ok: false, error: 'Unknown request.' };

  await ensureContent(tabId);
  const applied = await applyToTab(tab, scheme);
  const diagnostics = applied ? await inspectTab(tabId) : undefined;
  return diagnostics ? { ok: true, scheme, diagnostics } : { ok: true, scheme };
}
