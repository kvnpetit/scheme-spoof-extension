import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';

export async function startFixture() {
  const fixture = await readFile(new URL('./fixture.html', import.meta.url));
  const server = createServer((request, response) => {
    if (request.url === '/dark.css' || request.url === '/cross-origin.css') {
      response.writeHead(200, { 'Content-Type': 'text/css' });
      response.end(
        request.url === '/dark.css'
          ? '#linked { color: rgb(30, 31, 32); }'
          : '@media (prefers-color-scheme: light) { body { --cross-origin: 1; } }',
      );
      return;
    }
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(fixture);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing test HTTP port');
  return { server, port: address.port };
}
