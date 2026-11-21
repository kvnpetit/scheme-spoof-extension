import { defineContentScript } from 'wxt/utils/define-content-script';
import { inspectEvent, readyEvent, reportEvent, schemeEvent } from '../../utils/messages';
import { isScheme, webMatches } from '../../utils/scheme';
import type { Scheme } from '../../utils/scheme';
import { installMediaQueries } from './media';
import { observeStylesheets } from './stylesheets';

export default defineContentScript({
  matches: webMatches,
  runAt: 'document_start',
  world: 'MAIN',
  main() {
    const installed = Symbol.for('schemespoof.main');
    if (Reflect.has(globalThis, installed)) return;
    Reflect.set(globalThis, installed, true);

    const mediaQueries = installMediaQueries();
    const stylesheets = observeStylesheets();
    let scheme: Scheme = 'system';

    document.addEventListener(schemeEvent, (event) => {
      if (!(event instanceof CustomEvent) || !isScheme(event.detail) || event.detail === scheme)
        return;
      scheme = event.detail;
      mediaQueries.setScheme(scheme);
      // A change listener can read computed styles immediately.
      stylesheets.setScheme(scheme);
      mediaQueries.notifyChanges();
    });

    document.addEventListener(inspectEvent, () => {
      const light = window.matchMedia('(prefers-color-scheme: light)').matches;
      const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const matches = light === dark ? 'unknown' : light ? 'light' : 'dark';
      document.dispatchEvent(
        new CustomEvent(reportEvent, {
          detail: JSON.stringify({ matches, ...stylesheets.scanStyles() }),
        }),
      );
    });

    document.dispatchEvent(new Event(readyEvent));
  },
});
