import { resolve } from 'node:path';
import { defineConfig } from 'wxt';
import { toggleCommand, webMatches } from './utils/scheme';

const releaseVersion = process.env.SCHEMESPOOF_RELEASE_VERSION;

export default defineConfig({
  manifestVersion: 3,
  webExt: { disabled: true },
  hooks: {
    'build:publicAssets': ({ config }, files) => {
      files.push({ absoluteSrc: resolve(config.root, 'LICENSE'), relativeDest: 'LICENSE' });
    },
  },
  manifest: ({ browser }) => ({
    name: 'SchemeSpoof',
    ...(releaseVersion && { version: releaseVersion }),
    permissions: ['storage', 'activeTab', 'scripting'],
    host_permissions: webMatches,
    commands: {
      [toggleCommand]: {
        suggested_key: { default: 'Alt+Shift+D' },
        description: 'Toggle light and dark in the current tab',
      },
    },
    ...(browser === 'safari' && {
      browser_specific_settings: {
        safari: { strict_min_version: '18.4' },
      },
    }),
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          id: 'schemespoof@extensions.invalid',
          strict_min_version: '128.0',
          data_collection_permissions: { required: ['none'] },
        },
      },
    }),
  }),
});
