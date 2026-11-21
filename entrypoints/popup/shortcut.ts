import { browser } from 'wxt/browser';
import { toggleCommand } from '../../utils/scheme';
import { element } from './view';

export async function initializeShortcut() {
  const commands = browser.commands as typeof browser.commands & {
    update?: (details: { name: string; shortcut: string }) => Promise<void>;
  };
  if (typeof commands?.getAll !== 'function') return;

  const section = element('shortcut');
  const key = element('shortcut-key');
  const edit = element('edit-shortcut', HTMLButtonElement);
  const editor = element('shortcut-editor', HTMLFormElement);
  const input = element('shortcut-input', HTMLInputElement);
  const status = element('shortcut-status');

  async function refresh() {
    const command = (await commands.getAll()).find(({ name }) => name === toggleCommand);
    if (!command) return false;
    key.textContent = command.shortcut || 'Not set';
    section.hidden = false;
    return true;
  }

  if (!(await refresh().catch(() => false))) return;

  const update = commands.update?.bind(commands);
  if (update) {
    edit.hidden = false;
    edit.setAttribute('aria-controls', editor.id);
    edit.setAttribute('aria-expanded', 'false');
    edit.addEventListener('click', () => {
      editor.hidden = !editor.hidden;
      edit.setAttribute('aria-expanded', String(!editor.hidden));
      status.textContent = '';
      if (!editor.hidden) input.focus();
    });
    const saveShortcut = async () => {
      const shortcut = input.value
        .replace(/\s/g, '')
        .replace(/(^|\+)([a-z]|f\d{1,2})$/i, (token) => token.toUpperCase());
      const save = editor.querySelector<HTMLButtonElement>('button')!;
      save.disabled = true;
      try {
        await update({ name: toggleCommand, shortcut });
        await refresh();
        editor.reset();
        editor.hidden = true;
        edit.setAttribute('aria-expanded', 'false');
        edit.focus();
        status.textContent = 'Shortcut updated.';
      } catch {
        status.textContent = 'Try another shortcut, using a format like Alt+Shift+D.';
      } finally {
        save.disabled = false;
      }
    };
    editor.addEventListener('submit', (event) => {
      event.preventDefault();
      void saveShortcut();
    });
  } else if (import.meta.env.BROWSER === 'chrome' || import.meta.env.BROWSER === 'edge') {
    const edge = import.meta.env.BROWSER === 'edge' || navigator.userAgent.includes('Edg/');
    edit.hidden = false;
    async function openSettings() {
      const url = edge ? 'edge://extensions/shortcuts' : 'chrome://extensions/shortcuts';
      try {
        await browser.tabs.create({ url });
      } catch {
        status.textContent = 'Open ' + url + ' to change the shortcut.';
      }
    }
    edit.addEventListener('click', () => void openSettings());
  } else if (import.meta.env.BROWSER === 'safari') {
    status.textContent = 'On Safari 26 for Mac, edit shortcuts in Safari Settings → Extensions.';
  }
}
