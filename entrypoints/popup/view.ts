import type { Scheme } from '../../utils/scheme';

export function element(id: string): HTMLElement;
export function element<T extends HTMLElement>(id: string, type: new () => T): T;
export function element(id: string, type: new () => HTMLElement = HTMLElement): HTMLElement {
  const node = document.getElementById(id);
  if (!(node instanceof type)) throw new Error('Missing or invalid popup element #' + id);
  return node;
}

export const labels: Record<Scheme, string> = { system: 'System', light: 'Light', dark: 'Dark' };
