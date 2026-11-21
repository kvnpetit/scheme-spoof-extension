import type { Scheme } from './scheme';
import { isScheme } from './scheme';

export const schemeEvent = 'schemespoof:scheme';
export const readyEvent = 'schemespoof:ready';
export const inspectEvent = 'schemespoof:inspect';
export const reportEvent = 'schemespoof:report';

export interface Diagnostics {
  matches: 'light' | 'dark' | 'unknown';
  rewritten: number;
  inaccessible: number;
}

export type PopupRequest =
  | { type: 'load' | 'inspect'; tabId?: number | undefined }
  | { type: 'set-tab'; tabId: number; hostname: string; scheme: Scheme };

export type ContentMessage =
  | { type: 'ping' }
  | { type: 'inspect' }
  | { type: 'apply'; hostname: string; scheme: Scheme };

export type PopupResponse =
  | { ok: true; scheme: Scheme; applied?: boolean; diagnostics?: Diagnostics }
  | { ok: false; error: string };

export function hasMessageType(
  value: unknown,
): value is Record<string, unknown> & { type: string } {
  return (
    typeof value === 'object' && value !== null && 'type' in value && typeof value.type === 'string'
  );
}

function isTabId(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

export function isPopupRequest(value: unknown): value is PopupRequest {
  if (!hasMessageType(value)) return false;
  if (value.type === 'load' || value.type === 'inspect') {
    return value.tabId === undefined || isTabId(value.tabId);
  }
  return (
    value.type === 'set-tab' &&
    isTabId(value.tabId) &&
    typeof value.hostname === 'string' &&
    isScheme(value.scheme)
  );
}

export function isDiagnostics(value: unknown): value is Diagnostics {
  return (
    typeof value === 'object' &&
    value !== null &&
    'matches' in value &&
    (value.matches === 'light' || value.matches === 'dark' || value.matches === 'unknown') &&
    'rewritten' in value &&
    typeof value.rewritten === 'number' &&
    Number.isSafeInteger(value.rewritten) &&
    value.rewritten >= 0 &&
    'inaccessible' in value &&
    typeof value.inaccessible === 'number' &&
    Number.isSafeInteger(value.inaccessible) &&
    value.inaccessible >= 0
  );
}

export function isPopupResponse(value: unknown): value is PopupResponse {
  if (typeof value !== 'object' || value === null || !('ok' in value)) return false;
  if (value.ok === false) return 'error' in value && typeof value.error === 'string';
  return (
    value.ok === true &&
    'scheme' in value &&
    isScheme(value.scheme) &&
    (!('applied' in value) || typeof value.applied === 'boolean') &&
    (!('diagnostics' in value) || isDiagnostics(value.diagnostics))
  );
}
