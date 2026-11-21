import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { writeFile } from 'node:fs/promises';
import { createConnection, createServer } from 'node:net';
import { join, resolve } from 'node:path';
import { Readable, Writable } from 'node:stream';
import { setTimeout as delay } from 'node:timers/promises';

export interface TestBrowser {
  site: string;
  popup: string;
  activate(id: string): Promise<void>;
  open(url: string): Promise<string>;
  findTab?(url: string): Promise<string | undefined>;
  navigate(id: string, url: string): Promise<void>;
  execute(id: string, expression: string): Promise<unknown>;
  close(id: string): Promise<void>;
}

type BrowserScenario = (browser: TestBrowser) => Promise<void>;

export async function until<T>(
  check: () => T | Promise<T>,
  description: string,
  timeoutMs = 10_000,
): Promise<NonNullable<T>> {
  const deadline = Date.now() + timeoutMs;
  do {
    const result = await check();
    if (result) return result;
    await new Promise((done) => setTimeout(done, 125));
  } while (Date.now() < deadline);
  throw new Error('Timed out waiting for ' + description);
}

function browserProcess(executable: string, args: string[], profile: string[], env = process.env) {
  const child = spawn(executable, [...args, ...profile], {
    stdio: ['ignore', 'inherit', 'inherit'],
    env,
    windowsHide: true,
  });
  child.on('error', (error) => console.error(error.message));
  return child;
}

async function stopBrowser(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit').catch(() => undefined);
  child.kill();
  await Promise.race([exited, delay(5_000, undefined, { ref: false })]);
}

export function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Expected an object from the browser');
  }
  // JSON object properties are unknown until checked by the caller.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return value as Record<string, unknown>;
}

function string(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Expected a string from the browser');
  return value;
}

export async function launchChromium(executable: string, profile: string, run: BrowserScenario) {
  const extension = resolve('.output/chrome-mv3');
  const child = spawn(
    executable,
    [
      '--headless=new',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--password-store=basic',
      '--remote-debugging-pipe',
      '--enable-unsafe-extension-debugging',
      '--user-data-dir=' + profile,
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'], windowsHide: true },
  );
  const [, , , input, output] = child.stdio;
  const pending = new Map<number, { resolve(result: unknown): void; reject(error: Error): void }>();
  let serial = 0;
  let buffer = '';
  let stderr = '';
  child.stderr?.setEncoding('utf8').on('data', (chunk: string) => {
    stderr = (stderr + chunk).slice(-4_000);
  });

  function fail(error: Error) {
    for (const request of pending.values()) request.reject(error);
    pending.clear();
  }
  child.on('error', fail);
  child.on('exit', () => fail(new Error('Chromium closed its debugging pipe')));
  if (!(input instanceof Writable) || !(output instanceof Readable)) {
    child.kill();
    throw new Error('Chromium debugging pipes are unavailable');
  }
  input.on('error', fail);
  output.on('error', fail);
  output.setEncoding('utf8');
  output.on('data', (chunk: string) => {
    const messages = (buffer + chunk).split('\0');
    buffer = messages.pop() ?? '';
    for (const message of messages) {
      const { id, result, error } = record(JSON.parse(message));
      if (typeof id !== 'number') continue;
      const request = pending.get(id);
      if (!request) continue;
      pending.delete(id);
      if (error) request.reject(new Error(string(record(error).message)));
      else request.resolve(result);
    }
  });

  const write = input.write.bind(input);
  async function send(method: string, params?: Record<string, unknown>, sessionId?: string) {
    const id = ++serial;
    const response = await new Promise<unknown>((complete, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(new Error('Chromium timed out on ' + method));
      }, 30_000);
      pending.set(id, {
        resolve(result) {
          clearTimeout(timeout);
          complete(result);
        },
        reject(error) {
          clearTimeout(timeout);
          reject(error);
        },
      });
      write(JSON.stringify({ id, method, params, sessionId }) + '\0');
    });
    return record(response);
  }

  async function inTab<T>(targetId: string, operation: (sessionId: string) => Promise<T>) {
    const sessionId = string(
      (await send('Target.attachToTarget', { targetId, flatten: true })).sessionId,
    );
    try {
      return await operation(sessionId);
    } finally {
      await send('Target.detachFromTarget', { sessionId });
    }
  }

  async function findPage(url?: string) {
    const { targetInfos } = await send('Target.getTargets');
    if (!Array.isArray(targetInfos)) throw new Error('Missing Chromium targets');
    for (const targetInfo of targetInfos) {
      const page = record(targetInfo);
      if (page.type === 'page' && (url === undefined || page.url === url))
        return string(page.targetId);
    }
    return undefined;
  }

  try {
    const extensionId = string((await send('Extensions.loadUnpacked', { path: extension })).id);
    const site = await findPage();
    if (!site) throw new Error('Chromium opened without a test tab');
    await run({
      site,
      popup: 'chrome-extension://' + extensionId + '/popup.html',
      async activate(id) {
        await send('Target.activateTarget', { targetId: id });
      },
      async open(url) {
        return string((await send('Target.createTarget', { url, background: true })).targetId);
      },
      findTab: findPage,
      async navigate(id, url) {
        return inTab(id, async (sessionId) => {
          const navigation = await send('Page.navigate', { url }, sessionId);
          if (typeof navigation.errorText === 'string')
            throw new Error('Navigation to ' + url + ' failed: ' + navigation.errorText);
        });
      },
      async execute(id, expression) {
        return inTab(id, async (sessionId) => {
          const { result, exceptionDetails } = await send(
            'Runtime.evaluate',
            { expression, returnByValue: true, awaitPromise: true },
            sessionId,
          );
          if (exceptionDetails) {
            const { exception, text } = record(exceptionDetails);
            throw new Error(string(exception ? (record(exception).description ?? text) : text));
          }
          return record(result).value;
        });
      },
      async close(id) {
        await send('Target.closeTarget', { targetId: id });
      },
    });
  } catch (error) {
    if (stderr) console.error(stderr.trimEnd());
    throw error;
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      await send('Browser.close').catch(() => undefined);
    }
    await stopBrowser(child);
  }
}

async function availablePort() {
  const server = createServer().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  server.close();
  await once(server, 'close');
  if (!address || typeof address === 'string') throw new Error('Missing Firefox TCP port');
  return address.port;
}

function connectToMarionette(port: number) {
  return new Promise<ReturnType<typeof createConnection>>((complete, reject) => {
    const socket = createConnection(port, '127.0.0.1');
    socket.once('connect', () => complete(socket));
    socket.once('error', reject);
  });
}

export async function launchFirefox(executable: string, profile: string, run: BrowserScenario) {
  const port = await availablePort();
  await writeFile(join(profile, 'user.js'), 'user_pref("marionette.port", ' + port + ');\n');
  const child = browserProcess(
    executable,
    ['-headless', '-no-remote', '-marionette'],
    ['-profile', profile],
    {
      ...process.env,
      MOZ_REMOTE_ALLOW_SYSTEM_ACCESS: '1',
    },
  );

  try {
    const socket = await until(
      () => {
        if (child.exitCode !== null || child.signalCode !== null) {
          throw new Error('Firefox exited before starting Marionette');
        }
        return connectToMarionette(port).catch(() => undefined);
      },
      'Firefox Marionette',
      30_000,
    );
    socket.setTimeout(20_000, () => socket.destroy(new Error('Firefox Marionette timed out')));
    const data = socket[Symbol.asyncIterator]();
    let buffer = Buffer.alloc(0);
    let serial = 0;
    async function receive() {
      while (true) {
        const colon = buffer.indexOf(':');
        const length = colon === -1 ? 0 : Number(buffer.toString('ascii', 0, colon));
        if (length && buffer.length > colon + length) {
          const packet: unknown = JSON.parse(
            buffer.toString('utf8', colon + 1, colon + 1 + length),
          );
          buffer = buffer.subarray(colon + 1 + length);
          return packet;
        }
        const next = await data.next();
        if (next.done) throw new Error('Firefox Marionette disconnected');
        const chunk: unknown = next.value;
        if (!Buffer.isBuffer(chunk)) throw new Error('Invalid Firefox Marionette chunk');
        buffer = Buffer.concat([buffer, chunk]);
      }
    }
    async function send(method: string, params: Record<string, unknown> = {}) {
      if (process.env.SCHEMESPOOF_TEST_TRACE) console.log('Firefox', method, params.url ?? '');
      const packet = JSON.stringify([0, ++serial, method, params]);
      socket.write(Buffer.byteLength(packet) + ':' + packet);
      const response = await receive();
      if (!Array.isArray(response)) throw new Error('Invalid Firefox Marionette response');
      const error: unknown = response[2];
      if (error) throw new Error(method + ': ' + string(record(error).message));
      const result: unknown = response[3];
      return result;
    }
    async function select(id: string) {
      await send('WebDriver:SwitchToWindow', { handle: id, focus: false });
    }
    async function evaluate(expression: string) {
      return record(
        await send('WebDriver:ExecuteScript', { script: 'return (' + expression + ')', args: [] }),
      ).value;
    }

    try {
      await receive();
      await send('WebDriver:NewSession', {
        capabilities: { alwaysMatch: { pageLoadStrategy: 'none' } },
      });
      try {
        await send('Addon:Install', { path: resolve('.output/firefox-mv3'), temporary: true });
        const site = string(record(await send('WebDriver:GetWindowHandle')).value);
        await send('Marionette:SetContext', { value: 'chrome' });
        const popup = string(
          await evaluate(
            'WebExtensionPolicy.getByID("schemespoof@extensions.invalid").getURL("popup.html")',
          ),
        );
        await send('Marionette:SetContext', { value: 'content' });
        await run({
          site,
          popup,
          async activate(id) {
            await send('WebDriver:SwitchToWindow', { handle: id, focus: true });
          },
          async open(url) {
            const handle = string(
              record(await send('WebDriver:NewWindow', { type: 'tab', focus: false })).handle,
            );
            await this.navigate(handle, url);
            return handle;
          },
          async navigate(id, url) {
            await select(id);
            await send('WebDriver:Navigate', { url });
          },
          async execute(id, expression) {
            await select(id);
            return evaluate(expression);
          },
          async close(id) {
            await select(id);
            await send('WebDriver:CloseWindow');
          },
        });
      } finally {
        await send('WebDriver:DeleteSession');
      }
    } finally {
      socket.destroy();
    }
  } finally {
    await stopBrowser(child);
  }
}
