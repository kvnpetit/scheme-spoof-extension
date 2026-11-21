import type { Scheme } from './scheme';

// Match a color-scheme feature without touching quoted strings or CSS comments.
const schemeFeature =
  /\/\*[\s\S]*?\*\/|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|\(\s*prefers-color-scheme\s*(?::\s*([-a-z]+)\s*)?\)/gi;

export function rewriteMediaQuery(query: string, scheme: Scheme): string {
  if (scheme === 'system') return query;

  return query.replace(schemeFeature, (token: string, value?: string) => {
    if (!token.startsWith('(')) return token;
    // The boolean form is true for both known color schemes.
    const matches = value === undefined || value.toLowerCase() === scheme;
    return matches ? '(min-width: 0px)' : '(width < 0px)';
  });
}
