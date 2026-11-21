export const schemes = ['system', 'light', 'dark'] as const;
export type Scheme = (typeof schemes)[number];

export const webMatches = ['http://*/*', 'https://*/*'];
export const toggleCommand = 'toggle-preview';

export function isScheme(value: unknown): value is Scheme {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function hostnameFromUrl(value?: string): string | undefined {
  if (!value) return undefined;
  const url = URL.parse(value);
  if (url?.protocol === 'http:' || url?.protocol === 'https:') return url.hostname;
  return undefined;
}
