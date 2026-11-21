import { rewriteMediaQuery } from '../../utils/media-query';
import type { Scheme } from '../../utils/scheme';

type TrackedQuery = {
  original: MediaQueryList;
  facade: MediaQueryList;
  effective: MediaQueryList;
  matches: boolean;
  onChange: () => void;
};

export function installMediaQueries() {
  const nativeMatchMedia = window.matchMedia;
  const tracked = new Set<TrackedQuery>();
  let scheme: Scheme = 'system';

  function updateMatch(query: TrackedQuery) {
    const matches = query.effective.matches;
    if (query.matches === matches) return;
    query.matches = matches;
    query.facade.dispatchEvent(
      new MediaQueryListEvent('change', {
        matches,
        media: query.original.media,
      }),
    );
  }

  function effectiveQuery(original: MediaQueryList): MediaQueryList {
    const rewritten = rewriteMediaQuery(original.media, scheme);
    return rewritten === original.media ? original : nativeMatchMedia.call(window, rewritten);
  }

  window.matchMedia = function matchMedia(this: Window, ...args: [media: string]): MediaQueryList {
    const original = nativeMatchMedia.apply(this, args);
    if (rewriteMediaQuery(original.media, 'dark') === original.media) return original;

    // An inert native list provides the standard EventTarget and legacy listener methods.
    const facade = nativeMatchMedia.call(window, 'not all');
    const effective = effectiveQuery(original);
    const query: TrackedQuery = {
      original,
      effective,
      facade,
      matches: effective.matches,
      onChange: () => updateMatch(query),
    };
    Object.defineProperties(facade, {
      media: { get: () => original.media },
      matches: { get: () => query.effective.matches },
    });

    tracked.add(query);
    effective.addEventListener('change', query.onChange);
    return facade;
  };

  function setScheme(next: Scheme) {
    scheme = next;
    for (const query of tracked) {
      query.effective.removeEventListener('change', query.onChange);
      query.effective = effectiveQuery(query.original);
      query.effective.addEventListener('change', query.onChange);
    }
  }

  function notifyChanges() {
    for (const query of tracked) updateMatch(query);
  }

  return { setScheme, notifyChanges };
}
