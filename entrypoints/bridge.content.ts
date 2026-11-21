import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import {
  hasMessageType,
  inspectEvent,
  isDiagnostics,
  readyEvent,
  reportEvent,
  schemeEvent,
} from '../utils/messages';
import { isScheme, webMatches } from '../utils/scheme';
import type { Diagnostics } from '../utils/messages';
import type { Scheme } from '../utils/scheme';

function inspect(): Diagnostics | undefined {
  let diagnostic: Diagnostics | undefined;
  function receive(event: Event) {
    if (!(event instanceof CustomEvent) || typeof event.detail !== 'string') return;
    try {
      const data: unknown = JSON.parse(event.detail);
      if (isDiagnostics(data)) diagnostic = data;
    } catch {
      // Discard malformed events from the page.
    }
  }
  document.addEventListener(reportEvent, receive);
  try {
    document.dispatchEvent(new Event(inspectEvent));
    return diagnostic;
  } finally {
    document.removeEventListener(reportEvent, receive);
  }
}

export default defineContentScript({
  matches: webMatches,
  runAt: 'document_start',
  world: 'ISOLATED',
  main() {
    const installed = Symbol.for('schemespoof.bridge');
    if (Reflect.has(globalThis, installed)) return;
    Reflect.set(globalThis, installed, true);

    let scheme: Scheme = 'system';
    let receivedUpdate = false;

    function publish() {
      document.dispatchEvent(new CustomEvent(schemeEvent, { detail: scheme }));
    }

    document.addEventListener(readyEvent, publish);
    browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
      if (!hasMessageType(message)) return;
      if (message.type === 'ping') sendResponse(true);
      if (message.type === 'inspect') sendResponse(inspect());
      if (
        message.type === 'apply' &&
        message.hostname === location.hostname &&
        isScheme(message.scheme)
      ) {
        receivedUpdate = true;
        scheme = message.scheme;
        publish();
        sendResponse(true);
      }
    });

    void browser.runtime
      .sendMessage({ type: 'resolve' })
      .then((resolved) => {
        if (receivedUpdate || !isScheme(resolved)) return;
        scheme = resolved;
        publish();
      })
      .catch((error) => console.warn('SchemeSpoof could not read the tab theme.', error));
  },
});
