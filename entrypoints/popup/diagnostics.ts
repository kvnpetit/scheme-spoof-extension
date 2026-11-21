import type { PopupRequest, PopupResponse } from '../../utils/messages';
import { element, labels } from './view';

type SendMessage = (request: PopupRequest) => Promise<PopupResponse>;

const diagnosticValues = element('diagnostic-values');
const diagnosticStatus = element('diagnostic-status');
let diagnosticVersion = 0;

export function invalidateDiagnostics() {
  diagnosticVersion++;
}

export async function refreshDiagnostics(send: SendMessage, tabId?: number, hostname?: string) {
  const version = ++diagnosticVersion;
  diagnosticValues.hidden = true;
  if (!hostname || tabId === undefined) {
    diagnosticStatus.textContent = 'Open a web page to inspect its theme.';
    return;
  }
  diagnosticStatus.textContent = 'Inspecting the page…';
  try {
    const response = await send({ type: 'inspect', tabId });
    if (version !== diagnosticVersion) return;
    if (!response.ok || !response.diagnostics)
      throw new Error('Page diagnostics are unavailable here.');
    const { matches, rewritten, inaccessible } = response.diagnostics;
    element('requested').textContent = labels[response.scheme];
    element('observed').textContent = matches === 'unknown' ? 'Unknown' : labels[matches];
    element('rewritten').textContent = String(rewritten);
    element('inaccessible').textContent = String(inaccessible);
    diagnosticStatus.textContent = '';
    diagnosticValues.hidden = false;
  } catch {
    if (version === diagnosticVersion)
      diagnosticStatus.textContent = 'Page diagnostics are unavailable here.';
  }
}
