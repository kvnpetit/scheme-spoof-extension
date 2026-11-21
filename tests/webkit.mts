import assert from 'node:assert/strict';
import { webkit } from 'playwright';
import { schemeEvent } from '../utils/messages';
import type { Scheme } from '../utils/scheme';
import { startFixture } from './fixture.mts';

declare global {
  interface Window {
    probe: { queries: MediaQueryList[]; events: unknown[][] };
  }
}

const browser = await webkit.launch();
try {
  const { server, port } = await startFixture();
  try {
    const page = await browser.newPage({ colorScheme: 'light' });
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => pageErrors.push(error));
    await page.addInitScript({ path: '.output/safari-mv3/content-scripts/content.js' });
    await page.goto(`http://127.0.0.1:${port}/`);

    const matches = () => page.evaluate(() => window.probe.queries.map((query) => query.matches));
    const color = (selector: string) =>
      page.locator(selector).evaluate((element) => getComputedStyle(element).color);
    const apply = (next: Scheme) =>
      page.evaluate(
        ({ event, scheme }) => document.dispatchEvent(new CustomEvent(event, { detail: scheme })),
        { event: schemeEvent, scheme: next },
      );

    assert.deepEqual(await matches(), [false, true, true]);
    assert.equal(await color('#theme'), 'rgb(10, 11, 12)');
    const originalLinkedColor = await color('#linked');
    const originalDynamicColor = await color('#dynamic');

    await apply('dark');
    assert.deepEqual(await matches(), [true, false, false]);
    assert.equal(await color('#theme'), 'rgb(20, 21, 22)');
    assert.equal(await color('#linked'), 'rgb(30, 31, 32)');
    const events = await page.evaluate(() => window.probe.events);
    assert.deepEqual(events, [
      ['listener', true, true],
      ['legacy', false],
      ['onchange', false],
    ]);

    await page.evaluate(() => {
      const style = document.createElement('style');
      style.textContent =
        '@media (prefers-color-scheme: dark) { #dynamic { color: rgb(40, 41, 42) } }';
      document.head.append(style);
    });
    await page.waitForFunction(() => {
      const element = document.getElementById('dynamic');
      return element && getComputedStyle(element).color === 'rgb(40, 41, 42)';
    });

    await apply('light');
    assert.deepEqual(await matches(), [false, true, true]);
    assert.equal(await color('#theme'), 'rgb(10, 11, 12)');

    await apply('dark');
    await apply('system');
    assert.deepEqual(await matches(), [false, true, true]);
    assert.equal(await color('#theme'), 'rgb(10, 11, 12)');
    assert.equal(await color('#linked'), originalLinkedColor);
    assert.equal(await color('#dynamic'), originalDynamicColor);
    assert.deepEqual(pageErrors, []);
    console.log('webkit passed');
  } finally {
    server.close();
  }
} finally {
  await browser.close();
}
