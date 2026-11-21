import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import type { TestBrowser } from './browsers.mts';
import { launchChromium, launchFirefox, record, until } from './browsers.mts';
import { startFixture } from './fixture.mts';

const executables = {
  chrome: [
    process.env.SCHEMESPOOF_CHROME,
    process.env.SCHEMESPOOF_CHROMIUM,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ],
  firefox: [
    process.env.SCHEMESPOOF_FIREFOX,
    'C:/Program Files/Mozilla Firefox/firefox.exe',
    '/usr/bin/firefox',
    '/Applications/Firefox.app/Contents/MacOS/firefox',
  ],
};
const launch = { chrome: launchChromium, firefox: launchFirefox };
const selected = process.argv.slice(2).map((target) => (target === 'chromium' ? 'chrome' : target));
const targets = selected.length ? selected : Object.keys(launch);

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

async function removeProfile(profile: string) {
  for (let attempt = 1; ; attempt++) {
    try {
      await rm(profile, { recursive: true, force: true });
      return;
    } catch (error) {
      // On Windows, browser subprocesses can hold profile files briefly after exit.
      const code = error instanceof Error && 'code' in error && error.code;
      if (attempt >= 10 || (code !== 'EBUSY' && code !== 'EPERM' && code !== 'ENOTEMPTY')) {
        console.warn('Could not remove test browser profile ' + profile, error);
        return;
      }
      await delay(200);
    }
  }
}

async function runScenario(browser: TestBrowser, port: number) {
  const { site } = browser;
  const primary = 'http://127.0.0.1:' + port + '/';
  const anotherHost = 'http://localhost:' + port + '/';
  await browser.navigate(site, primary);
  const second = await browser.open(primary);
  // Opening a tab can change the active tab even when automation requests a background tab.
  const popup = await browser.open('about:blank');
  await browser.activate(site);
  await browser.navigate(popup, browser.popup);
  const ui = (expression: string) => browser.execute(popup, expression);
  const read = async (tab: string) => {
    const { start, matches, events, colors } = record(
      await browser.execute(
        tab,
        `window.probe && ({
    start: probe.start,
    matches: probe.queries.map((query) => query.matches),
    events: probe.events,
    colors: ['theme', 'linked', 'dynamic'].map((id) => getComputedStyle(document.getElementById(id)).color),
  })`,
      ),
    );
    assert.equal(typeof start, 'number');
    assert.ok(isArray(matches) && isArray(events) && isArray(colors));
    return { start, matches, events: events.filter(isArray), colors };
  };
  const loaded = (tab: string, url: string) =>
    until(
      () =>
        browser.execute(
          tab,
          'location.href === ' +
            JSON.stringify(url) +
            ' && document.readyState === "complete" && !!window.probe',
        ),
      'test page to finish loading',
    );

  function showScheme(scheme: 'system' | 'light' | 'dark') {
    return until(
      () =>
        ui(
          'document.querySelector("[data-scheme=' +
            scheme +
            ']")?.getAttribute("aria-pressed") === "true" && !document.querySelector("#tab-controls").disabled',
        ),
      scheme + ' selection in the popup',
    );
  }

  const click = (selector: string) =>
    ui('document.querySelector(' + JSON.stringify(selector) + ').click()');
  const badge = () =>
    ui(`(async () => {
    const api = globalThis.browser ?? globalThis.chrome;
    const [tab] = await api.tabs.query({active: true, currentWindow: true});
    return api.action.getBadgeText({tabId: tab.id});
  })()`);

  await loaded(site, primary);
  await loaded(second, primary);
  await until(
    () => ui('document.querySelector("#domain")?.textContent === "127.0.0.1"'),
    'the popup',
  ).catch(async (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(message + '. Popup state: ' + String(await ui('document.body?.innerText')), {
      cause: error,
    });
  });
  await showScheme('system');
  await until(
    () =>
      ui(
        '!document.querySelector("#diagnostic-values").hidden && ' +
          'document.getElementById("requested").textContent === "System"',
      ),
    'diagnostics on popup open',
  );
  const initial = await read(site);
  const initialSecond = await read(second);

  await click('[data-scheme=light]');
  await showScheme('light');
  assert.deepEqual(
    (await read(site)).matches,
    [false, true, true],
    'Light applies to the active tab',
  );
  assert.deepEqual(
    (await read(second)).matches,
    initialSecond.matches,
    'the other tab keeps System',
  );
  assert.equal(await badge(), 'L');

  await click('[data-scheme=dark]');
  await showScheme('dark');
  await until(
    () =>
      ui(
        '!document.querySelector("#diagnostic-values").hidden && ' +
          'document.getElementById("requested").textContent === "Dark"',
      ),
    'diagnostics after changing the theme',
  );
  const dark = await read(site);
  assert.equal(dark.start, initial.start, 'changing theme preserves the document');
  assert.deepEqual(dark.matches, [true, false, false]);
  assert.deepEqual(dark.colors.slice(0, 2), ['rgb(20, 21, 22)', 'rgb(30, 31, 32)']);
  assert.ok(
    dark.events.some(
      ([method, matches, rightTarget]) => method === 'listener' && matches && rightTarget,
    ),
  );
  assert.ok(dark.events.some(([method]) => method === 'legacy'));
  assert.ok(dark.events.some(([method]) => method === 'onchange'));
  const unaffected = await read(second);
  assert.equal(unaffected.start, initialSecond.start);
  assert.deepEqual(unaffected.matches, initialSecond.matches, 'Dark is isolated to one tab');
  assert.equal(await badge(), 'D');

  await browser.execute(
    site,
    "document.head.insertAdjacentHTML('beforeend', '<style>@media (prefers-color-scheme: dark) { #dynamic { color: rgb(40, 41, 42); } }</style>')",
  );
  await until(async () => (await read(site)).colors[2] === 'rgb(40, 41, 42)', 'dynamic stylesheet');

  await click('#refresh-diagnostics');
  await until(() => ui('!document.querySelector("#diagnostic-values").hidden'), 'page diagnostics');
  assert.equal(await ui('document.getElementById("requested").textContent'), 'Dark');
  assert.equal(await ui('document.getElementById("observed").textContent'), 'Dark');
  assert.ok(Number(await ui('document.getElementById("rewritten").textContent')) >= 4);
  assert.equal(await ui('document.getElementById("inaccessible").textContent'), '1');

  await browser.navigate(site, primary);
  await loaded(site, primary);
  await until(async () => {
    const state = await read(site);
    return state.start !== initial.start && state.matches[0] === true && (await badge()) === 'D';
  }, 'tab theme after reload');

  await browser.navigate(site, anotherHost);
  await loaded(site, anotherHost);
  await until(
    async () => (await read(site)).matches[0] === true && (await badge()) === 'D',
    'tab theme after navigation to another host',
  );

  await browser.navigate(popup, browser.popup);
  await showScheme('dark');
  await click('[data-scheme=system]');
  await showScheme('system');
  assert.deepEqual(
    (await read(site)).matches,
    initial.matches,
    'System restores the native media queries',
  );
  assert.deepEqual((await read(site)).colors, initial.colors);
  assert.equal(await badge(), '');

  const commandShortcut = () =>
    ui(`(async () => {
    const commands = await (globalThis.browser ?? globalThis.chrome).commands.getAll();
    return commands.find(({ name }) => name === 'toggle-preview')?.shortcut ?? null;
  })()`);
  const shortcut = await commandShortcut();
  assert.ok(typeof shortcut === 'string' && shortcut.length > 0, 'default shortcut is registered');
  await until(
    () => ui('!document.querySelector("#edit-shortcut").hidden'),
    'shortcut editing is available',
  );
  if (await ui('typeof (globalThis.browser ?? globalThis.chrome).commands.update === "function"')) {
    await click('#edit-shortcut');
    await ui('document.querySelector("#shortcut-input").value = "Alt+Shift+J"');
    await click('#shortcut-editor button');
    await until(
      () => ui('document.querySelector("#shortcut-status").textContent === "Shortcut updated."'),
      'saving a shortcut',
    );
    const updated = await commandShortcut();
    assert.ok(typeof updated === 'string' && updated.endsWith('+J'));
    await browser.navigate(popup, browser.popup);
    await until(
      () => ui('document.querySelector("#shortcut-key").textContent.endsWith("+J")'),
      'shortcut after reopening the popup',
    );
    await click('#edit-shortcut');
    await click('#shortcut-editor button');
    await until(
      () => ui('document.querySelector("#shortcut-key").textContent === "Not set"'),
      'disabling the shortcut',
    );
  }

  const storedThemes = async () =>
    record(
      record(await ui('(globalThis.browser ?? globalThis.chrome).storage.session.get("tabThemes")'))
        .tabThemes,
    );
  assert.deepEqual(await storedThemes(), {}, 'System clears the override');
  await click('[data-scheme=dark]');
  await showScheme('dark');

  await browser.activate(second);
  await browser.navigate(popup, browser.popup);
  await showScheme('system');
  await click('[data-scheme=light]');
  await showScheme('light');
  assert.deepEqual(
    (await read(site)).matches,
    [true, false, false],
    'the first tab keeps its own Dark override',
  );
  assert.deepEqual(
    (await read(second)).matches,
    [false, true, true],
    'the second tab can use Light independently',
  );
  const themes = Object.values(await storedThemes());
  assert.equal(themes.length, 2);
  assert.ok(themes.includes('dark') && themes.includes('light'));
  assert.deepEqual(
    await ui('(globalThis.browser ?? globalThis.chrome).storage.local.get(null)'),
    {},
    'tab themes do not write persistent preferences',
  );

  await browser.close(site);
  await until(async () => {
    const activeThemes = Object.values(await storedThemes());
    return activeThemes.length === 1 && activeThemes[0] === 'light';
  }, 'closing one tab removes only its override');
  if (browser.findTab) {
    const findTab = browser.findTab.bind(browser);
    await click('#edit-shortcut');
    const settingsTab = await until(
      () => findTab('chrome://extensions/shortcuts'),
      'the browser shortcut settings',
    );
    await browser.close(settingsTab);
  }
  await browser.close(second);
  await browser.close(popup);
}

const { server, port } = await startFixture();
if (selected.includes('--serve')) {
  console.log('SchemeSpoof test page at http://127.0.0.1:' + port + '/ (Ctrl+C to stop)');
}
try {
  for (const target of selected.includes('--serve') ? [] : targets) {
    if (target !== 'chrome' && target !== 'firefox')
      throw new Error('Unknown test browser: ' + target);
    const executable = executables[target].find((candidate) => candidate && existsSync(candidate));
    if (!executable) {
      throw new Error(
        'Browser unavailable for ' +
          target +
          '. Set SCHEMESPOOF_' +
          target.toUpperCase() +
          ' to its executable.',
      );
    }
    const profile = await mkdtemp(join(tmpdir(), 'schemespoof-smoke-'));
    try {
      await launch[target](executable, profile, (browser) => runScenario(browser, port));
      console.log(target + ' passed');
    } finally {
      await removeProfile(profile);
    }
  }
} finally {
  if (!selected.includes('--serve')) server.close();
}
