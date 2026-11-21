# SchemeSpoof

SchemeSpoof is a Manifest V3 extension for Chromium browsers, Firefox, and Safari. It lets developers test the color scheme a page sees in the current tab without changing the theme of the browser or operating system.

[Installation](#install-locally-without-a-store) · [Browsers](#browser-compatibility) · [Usage](#choose-a-theme) · [Diagnostics](#page-diagnostics) · [Development](#develop-and-package) · [Releases](#publish-a-github-release) · [License](LICENSE)

## Install locally without a store

### Download a ready-to-use build

On the project's GitHub **Releases** page, open the latest release and download the browser ZIP under **Assets**. Use `-chrome.zip` for Chrome, Edge, and other Chromium browsers, `-firefox.zip` for Firefox, or `-safari.zip` for Safari. Extract it to a folder you plan to keep, then follow the browser instructions below using that folder. The extracted folder contains `manifest.json` and is ready to load without Bun.

The browser ZIPs are listed separately from GitHub's **Source code** archives. Each release also includes `SHA256SUMS.txt`.

To verify the downloads on Linux or macOS, put the ZIPs and `SHA256SUMS.txt` in the same folder and run `shasum -a 256 -c SHA256SUMS.txt`. If you downloaded a single ZIP, run `shasum -a 256 schemespoof-v0.1.0-chrome.zip` with its actual filename and compare it with the matching line. On Windows, use `Get-FileHash -Algorithm SHA256 schemespoof-v0.1.0-chrome.zip` in PowerShell with the filename you downloaded.

### Browser compatibility

| Engine           | Browsers                                                                                | Release ZIP    |
| ---------------- | --------------------------------------------------------------------------------------- | -------------- |
| Blink / Chromium | Google Chrome, Chromium, Microsoft Edge, Brave, Vivaldi, Opera, and Opera GX on desktop | `-chrome.zip`  |
| Gecko            | Firefox 128+ on desktop                                                                 | `-firefox.zip` |
| WebKit           | Safari 18.4+ on macOS, iPhone, and iPad                                                 | `-safari.zip`  |

Chrome and Firefox run the installed extension in CI. Brave, Vivaldi, Opera, and Opera GX share the Chromium build and are outside the automated test suite. Playwright tests the Safari page script in WebKit. Installing the extension in Safari still requires Safari on an Apple device. [Brave extension support](https://brave.com/learn/using-chrome-extensions-in-brave/) · [Vivaldi extensions](https://help.vivaldi.com/desktop/appearance-customization/extensions/) · [Opera extensions](https://help.opera.com/en/extensions/basics/) · [Safari installation](https://developer.apple.com/documentation/safariservices/running-your-safari-web-extension)

Firefox derivatives such as LibreWolf, Waterfox, and Zen support Firefox add-ons. The Gecko build is the starting point if your browser offers temporary add-on loading. SchemeSpoof has no browser-specific test coverage for these forks. Orion’s Chrome and Firefox extension support is experimental. [LibreWolf add-ons](https://librewolf.net/docs/addons/) · [Waterfox add-ons](https://www.waterfox.com/support/addons-help/) · [Zen extensions](https://docs.zen-browser.app/user-manual/extensions) · [Orion extension support](https://help.kagi.com/orion/support-and-community/troubleshooting/troubleshooting-extension-issues.html)

### Build locally if needed

From a fresh checkout, install [Bun](https://bun.sh/docs/installation), then run `bun install --frozen-lockfile` in the project directory. GitHub Actions uses Bun 1.4.5. Then run the command for your browser.

| Browser                                   | Build command            | Output folder         |
| ----------------------------------------- | ------------------------ | --------------------- |
| Chrome, Edge, or another Chromium browser | `bun run build:chromium` | `.output/chrome-mv3`  |
| Firefox 128+                              | `bun run build:gecko`    | `.output/firefox-mv3` |
| Safari 18.4+                              | `bun run build:webkit`   | `.output/safari-mv3`  |

### Chromium browsers

1. Open the extensions page for your browser.

   | Browser            | Extensions page        |
   | ------------------ | ---------------------- |
   | Chrome or Chromium | `chrome://extensions`  |
   | Microsoft Edge     | `edge://extensions`    |
   | Brave              | `brave://extensions`   |
   | Vivaldi            | `vivaldi://extensions` |
   | Opera or Opera GX  | `opera://extensions`   |

2. Enable **Developer mode**, then click **Load unpacked**.
3. Select the extracted folder that contains `manifest.json`. For a local build, select `.output/chrome-mv3`.
4. Open a website, then use the browser’s **Extensions** menu to open or pin **SchemeSpoof**.

Keep the selected folder at the same path. To update, extract the new ZIP or rebuild into the same folder, click **Reload** on the SchemeSpoof card, then refresh any page that was already open. [Chrome local installation](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world) · [Edge local installation](https://learn.microsoft.com/en-us/microsoft-edge/extensions/getting-started/extension-sideloading) · [Opera local installation](https://help.opera.com/en/extensions/testing/)

### Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on**.
3. Select `manifest.json` inside the extracted folder. For a local build, select `.output/firefox-mv3/manifest.json`.
4. Open a website and click **SchemeSpoof** in the extensions menu.

Repeat the loading step after restarting Firefox. While Firefox is open, you can rebuild and use **Reload** on the add-on’s card. [Firefox temporary installation](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/)

For an installation that survives restarts in standard Firefox, Mozilla signing is required. You can request an **unlisted** signature and install the resulting signed `.xpi` from `about:addons` using **Install Add-on From File**. An unlisted signature keeps the extension off the public add-on catalog. [Mozilla signing and distribution](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/) · [Install from file](https://extensionworkshop.com/documentation/publish/install-self-distributed/)

### Safari on macOS

1. Open **Safari > Settings > Advanced** and enable **Show features for web developers**.
2. Open the **Developer** settings tab and click **Add Temporary Extension…**.
3. Select the extracted folder or the local `.output/safari-mv3` build. Confirm the prompt and grant SchemeSpoof access when Safari asks about the current website.

Safari removes temporary extensions after 24 hours or when you quit Safari. On iPhone and iPad, install through a containing app built with Xcode as described below. [Apple’s Safari installation guide](https://developer.apple.com/documentation/safariservices/running-your-safari-web-extension)

### Package for Safari on macOS, iPhone, and iPad

On a Mac with Xcode, run the packager after building the Safari target.

```sh
xcrun safari-web-extension-packager .output/safari-mv3
```

Use the generated Xcode project to run or sign the containing app. For iPhone or iPad, choose the iOS app target, install it on a device or simulator, then enable the extension in Safari. Website access is controlled in Safari Settings. The popup works independently of keyboard shortcuts, whose availability depends on the platform.

[Apple’s packaging guide](https://developer.apple.com/documentation/safariservices/packaging-a-web-extension-for-safari) · [Running Safari extensions](https://developer.apple.com/documentation/safariservices/running-your-safari-web-extension)

## Choose a theme

Open the popup and choose **System**, **Light**, or **Dark** under **Theme for this tab**. **System** follows the color scheme reported by the browser. **Light** and **Dark** apply immediately and show an **L** or **D** badge.

Every new tab starts on **System**. An override follows its tab through reloads and navigation, even to another website. Select **System** or close the tab to clear it. Restarting the browser clears all tab overrides. Updating from an older version removes the saved site and global preferences.

Use **Alt+Shift+D** to switch the current tab between Light and Dark. The popup shows the shortcut currently assigned by the browser.

- **Firefox** — Select **Edit shortcut** in the popup, enter a combination such as `Alt+Shift+D`, and save it. Save an empty field to disable it.
- **Chrome and Edge** — Select **Edit shortcut** to open the browser's extension shortcuts page and change the binding there.
- **Safari 26 or newer on Mac** — Open **Safari → Settings → Extensions** to change extension shortcuts.

## Page diagnostics

**Page diagnostics** is always visible in the toolbar popup. It checks the current tab when you open the popup and after you change a setting. Select **Refresh diagnostics** to check again after the page loads more styles.

| Field                          | What it shows                                                                                                                                                                                                                                                              |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Requested theme**            | The setting for the current tab.                                                                                                                                                                                                                                           |
| **`matchMedia`**               | What the page's JavaScript receives when SchemeSpoof checks the light and dark `prefers-color-scheme` queries. **Unknown** means the two checks did not identify a single scheme. In **System** mode, this normally reports the system's current Light or Dark preference. |
| **Rewritten media conditions** | The number of media conditions currently rewritten on accessible stylesheets, including `@media` rules and stylesheet-level media conditions. **System** normally shows zero.                                                                                              |
| **Unreadable stylesheets**     | The number of stylesheets whose rules the browser prevents the script from reading, often because they come from another origin without CSSOM access. The count does not show whether those sheets contain color-scheme rules.                                             |

For example, if **Requested theme** and **`matchMedia`** both show **Dark** but the page still looks light, the page may use its own theme setting or rely on CSS in an unreadable stylesheet. The panel checks the JavaScript preference and media conditions. It cannot tell which colors the page ultimately renders. If diagnostics are unavailable, check that the browser allows SchemeSpoof to run on that page.

## Develop and package

Run `bun install --frozen-lockfile` once before starting. The project’s [Bun configuration](bunfig.toml) runs the toolchain with Bun, including CLIs that declare Node.js in their shebang.

### Development by engine

Run the command for the engine you want to work on, then load its output in a compatible browser. WXT watches the project and builds the extension without opening a browser.

| Engine           | Command                | Development output        |
| ---------------- | ---------------------- | ------------------------- |
| Blink / Chromium | `bun run dev:chromium` | `.output/chrome-mv3-dev`  |
| Gecko            | `bun run dev:gecko`    | `.output/firefox-mv3-dev` |
| WebKit           | `bun run dev:webkit`   | `.output/safari-mv3-dev`  |

`bun run dev` defaults to Chromium. Load the development folder using the [installation steps](#install-locally-without-a-store). For WebKit, load the temporary extension manually in Safari on macOS. If you restart the dev server, reload the extension to reconnect live updates. [WXT browser startup](https://wxt.dev/guide/essentials/config/browser-startup.html)

### Production builds and archives

| Engine           | Build                    | Build and ZIP          | Test                    |
| ---------------- | ------------------------ | ---------------------- | ----------------------- |
| Blink / Chromium | `bun run build:chromium` | `bun run zip:chromium` | `bun run test:chromium` |
| Gecko            | `bun run build:gecko`    | `bun run zip:gecko`    | `bun run test:gecko`    |
| WebKit           | `bun run build:webkit`   | `bun run zip:webkit`   | `bun run test:webkit`   |

`bun run build`, `bun run zip`, and `bun run test` run the corresponding command for all three engines in order. The ZIP commands rebuild their targets and write WXT archives to `.output/` with the suffixes `-chrome.zip`, `-firefox.zip`, and `-safari.zip`. Gecko packaging also produces a source archive. The release workflow packages the already tested builds with tag-based names and SHA-256 checksums.

### Quality checks

| Command                | Scope                                                                                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run format`       | Applies the repository's [Oxfmt settings](.oxfmtrc.json) to source, styles, markup, configuration, and documentation.                                                           |
| `bun run format:check` | Runs the same formatter check without rewriting files. Generated files and `bun.lock` are excluded.                                                                             |
| `bun run lint`         | Runs [Oxlint](.oxlintrc.json) with type information. It fails on warnings, errors, and unused lint-disable directives.                                                          |
| `bun run typecheck`    | Runs the Rust TypeScript checker against [tsconfig.json](tsconfig.json), covering the extension, WXT config, and browser tests with strict types and exact optional properties. |
| `bun run check`        | Runs the format check, lint, and typecheck in that order. Any failure stops the command with a nonzero exit code.                                                               |

`bun install --frozen-lockfile` installs the locked dependencies and runs `wxt prepare` to generate the project types in `.wxt/`. Oxlint and the whole-project typecheck use the pinned `tsrs` backend. The `--noEmit` option keeps the typecheck from writing JavaScript, source maps, or declaration files. WXT writes the extension build. `skipLibCheck` skips validating declaration files supplied by WXT and dependencies. Project source and test code are still checked against those types. [tsrs documentation](https://github.com/oxc-project/tsrs) · [TypeScript’s noEmit option](https://www.typescriptlang.org/tsconfig/noEmit.html)

### Dependency policy

Bun pins new direct dependencies to exact versions. Its 24-hour minimum release age applies when resolving new direct and transitive npm versions. Installations with the checked-in lockfile use the versions already recorded there. CI audits that lockfile for high and critical advisories before installing dependencies. Run `bun audit --audit-level=high` to perform the same check locally. [Bun’s minimum release age](https://bun.com/docs/pm/cli/install#minimum-release-age) · [Bun audit](https://bun.com/docs/pm/cli/audit)

## Continuous integration

The [Build and release workflow](.github/workflows/build-release.yml) runs both jobs on **Ubuntu 24.04**. It uses **Bun 1.4.5** for the dependency audit, installation, quality checks, builds, and browser tests.

| Event                                   | What runs                                                                                                                             |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Pull request or push to `main`          | Audit and install the checked-in lockfile, run `bun run check`, build Chromium, Firefox, and Safari, then run the engine smoke tests. |
| Push a release tag `vMAJOR.MINOR.PATCH` | Validate the tag, use its version in each manifest, run the same checks and builds, and publish the verified release files.           |

The CI tests one representative of each engine. Chrome (Chromium/Blink) and Firefox (Gecko) run the installed extension in temporary profiles. Playwright WebKit runs the Safari build’s page script on a test page and checks its JavaScript and CSS behavior. Safari installation, permissions, the toolbar popup, and the extension APIs still need the [manual Safari check on macOS](#run-the-browser-checks). [Playwright browsers](https://playwright.dev/docs/browsers) · [Apple’s Safari installation guide](https://developer.apple.com/documentation/safariservices/running-your-safari-web-extension)

### Release artifacts and retries

1. The build job checks all three manifests for Manifest V3 and the tag-derived version and verifies that each build contains the project license. It creates `schemespoof-vMAJOR.MINOR.PATCH-<browser>.zip` for each target with `manifest.json` and `LICENSE` at the ZIP root. It writes `SHA256SUMS.txt` and uploads the files as the `schemespoof-release` workflow artifact.
2. After the build job succeeds, the release job downloads the artifact, checks the SHA-256 sums and the three expected ZIP files, and publishes them with installation notes under **Releases**. It uses the built-in GitHub token with `contents: write` in the release job.
3. On retry, the workflow leaves its already published release in place. It updates its own draft and publishes it if needed. If the tag has a release created outside the workflow, it stops so that release can be reviewed.

## Publish a GitHub release

Push the commit you want to release to GitHub, then create and push a new tag for that commit. Use `vMAJOR.MINOR.PATCH` with plain integer components from 0 to 65535. Tags with leading zeroes, prerelease suffixes, or version `0.0.0` fail validation. Use a new tag each time.

```sh
git tag -a v0.1.0 -m "SchemeSpoof v0.1.0"
git push origin v0.1.0
```

Follow the run in the repository's **Actions** tab. When **Publish GitHub Release** succeeds, open the tag under **Releases** and check the three ZIPs and `SHA256SUMS.txt` under **Assets**. Public downloads require a public GitHub repository. The [installation guide](#install-locally-without-a-store) covers unsigned Firefox builds and Safari packaging.

## Run the browser checks

Run `bun run playwright install webkit` once, then run `bun run build` followed by `bun run test` for all three engines. To check a single engine, build and test it using the commands in the [table above](#production-builds-and-archives).

The Chromium and Gecko tests discover standard Chrome and Firefox installations on Windows, Linux, and macOS. Set `SCHEMESPOOF_CHROME` or `SCHEMESPOOF_FIREFOX` to override an executable. GitHub Actions uses the browsers bundled with its Ubuntu image. The tests use temporary profiles and [an HTTP test page](tests/fixture.html) to check independent tab themes, reloads, navigation, tab closure, restoration of System mode, live CSS and JavaScript changes, and diagnostics.

The WebKit test runs the compiled Safari page script before the fixture's own JavaScript and checks `matchMedia`, change events, linked and dynamic stylesheets, and restoration of System mode. Ubuntu CI uses `playwright install --with-deps webkit` to download the browser and install the required system libraries.

To check Safari manually, start the same test page with `bun run test:serve`. Open the printed URL in two Safari tabs. Select **Dark** in one tab and **Light** in the other. Reload the first tab and verify that `matchMedia` still reports **Dark** in **Page diagnostics**. Select **System** in the first tab and confirm that the second tab still reports **Light**.

## How it works

- The [MAIN-world entrypoint](entrypoints/content/index.ts) starts at `document_start`. Its media query and stylesheet modules handle JavaScript events and CSS updates. It exposes the selected preference through `window.matchMedia`, including live `change` events, and updates color-scheme queries in readable stylesheets. It restores the site's original conditions in System mode.
- The [background](entrypoints/background/index.ts) stores overrides in memory with `storage.session`, keyed by tab ID. It sends the tab theme to the isolated content script and updates the badge. The isolated script relays the theme and diagnostics between the extension and the page.
- Both content scripts match HTTP and HTTPS pages so a tab override can be applied when a page loads. The `scripting` and `activeTab` permissions support applying a choice from the popup to an already-open tab. SchemeSpoof sends no preferences or browsing data to external services.
- The [popup](entrypoints/popup/main.ts) handles the theme selector and refreshes the diagnostics for the current tab.

## Limits

- SchemeSpoof affects the top-level page. Embedded documents and browser UI keep their own preferences.
- Browser-internal pages, extension stores, and other protected pages can block injection. Cross-origin stylesheets whose rules are unreadable through the CSSOM keep their internal media queries. A stylesheet served with CORS and loaded in CORS mode can expose its rules.
- Tab overrides load asynchronously. A page that reads the theme once before storage finishes or ignores change events can show its initial appearance. Websites must use `prefers-color-scheme` for the extension to affect their theme.

## License

SchemeSpoof is released under the [MIT License](LICENSE). Every browser build includes a copy.
