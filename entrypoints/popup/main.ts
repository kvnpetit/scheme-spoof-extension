import { browser } from 'wxt/browser';
import type { PopupRequest, PopupResponse } from '../../utils/messages';
import { isPopupResponse } from '../../utils/messages';
import { hostnameFromUrl, isScheme } from '../../utils/scheme';
import type { Scheme } from '../../utils/scheme';
import { invalidateDiagnostics, refreshDiagnostics } from './diagnostics';
import { initializeShortcut } from './shortcut';
import { element } from './view';
import './style.css';

const domain = element('domain');
const controls = element('tab-controls', HTMLFieldSetElement);
const choices = document.querySelectorAll<HTMLButtonElement>('button[data-scheme]');
const status = element('status');
const diagnosticRefresh = element('refresh-diagnostics', HTMLButtonElement);

let tabId: number | undefined;
let hostname: string | undefined;
let scheme: Scheme | undefined;
let busy = false;

function render() {
  domain.textContent = hostname ?? 'No accessible website in this tab';
  controls.disabled = busy || scheme === undefined || !hostname || tabId === undefined;
  diagnosticRefresh.disabled = busy || !hostname || tabId === undefined;
  for (const choice of choices)
    choice.setAttribute('aria-pressed', String(scheme === choice.dataset.scheme));
}

async function send(request: PopupRequest): Promise<PopupResponse> {
  const response: unknown = await browser.runtime.sendMessage(request);
  if (!isPopupResponse(response)) throw new Error('SchemeSpoof did not return a valid response.');
  return response;
}

function inspectCurrentTab() {
  return refreshDiagnostics(send, tabId, hostname);
}

async function chooseTheme(next: Scheme) {
  if (busy || !hostname || tabId === undefined) return;
  busy = true;
  invalidateDiagnostics();
  status.textContent = '';
  render();

  try {
    const response = await send({ type: 'set-tab', tabId, hostname, scheme: next });
    if (!response.ok) throw new Error(response.error);
    scheme = response.scheme;
    if (response.applied === false)
      status.textContent = 'This page does not currently allow SchemeSpoof to run.';
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : 'Could not set the theme.';
  } finally {
    busy = false;
    render();
    void inspectCurrentTab();
  }
}

for (const choice of choices) {
  choice.addEventListener('click', () => {
    const next = choice.dataset.scheme;
    if (isScheme(next)) void chooseTheme(next);
  });
}

diagnosticRefresh.addEventListener('click', () => void inspectCurrentTab());

async function initialize() {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    tabId = tab?.id;
    hostname = hostnameFromUrl(tab?.url);
    const response = await send({ type: 'load', tabId });
    if (!response.ok) throw new Error(response.error);
    scheme = response.scheme;
  } catch {
    status.textContent = 'Could not load the tab theme. Reopen the popup to try again.';
  }
  render();
}

void initialize().then(inspectCurrentTab);
void initializeShortcut();
