import { storage } from 'wxt/utils/storage';
import type { Scheme } from './scheme';

const tabThemes = storage.defineItem<Partial<Record<number, Exclude<Scheme, 'system'>>>>(
  'session:tabThemes',
  {
    fallback: {},
  },
);

export async function getTabScheme(tabId: number): Promise<Scheme> {
  return (await tabThemes.getValue())[tabId] ?? 'system';
}

export async function setTabScheme(tabId: number, scheme: Scheme) {
  const themes = await tabThemes.getValue();
  if ((themes[tabId] ?? 'system') === scheme) return;
  if (scheme === 'system') delete themes[tabId];
  else themes[tabId] = scheme;
  await tabThemes.setValue(themes);
}

export async function removeLegacyPreferences() {
  await storage.removeItem('local:preferences');
}
