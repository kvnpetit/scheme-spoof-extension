import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const versionTag = /^v(?:0|[1-9]\d{0,4})\.(?:0|[1-9]\d{0,4})\.(?:0|[1-9]\d{0,4})$/;
const conventionalSubject = /^([a-z][a-z0-9-]*)(?:\(([^)]+)\))?(!)?: (\S.*)$/i;
const breakingFooter = /^BREAKING(?: |-)CHANGE:[ \t]+([^\r\n]+)/m;

function git(...args: string[]) {
  return execFileSync('git', args, { encoding: 'utf8' });
}

function releaseTags(...args: string[]) {
  return git('tag', '--sort=-version:refname', ...args)
    .split(/\r?\n/)
    .filter((ref) => versionTag.test(ref));
}

function releaseNotes(tag?: string) {
  const target = git('rev-parse', '--verify', tag ? `refs/tags/${tag}^{commit}` : 'HEAD').trim();
  const tags = releaseTags('--merged', target);
  const previousTag = tags[tag ? tags.indexOf(tag) + 1 : 0];
  const range = previousTag ? `refs/tags/${previousTag}..${target}` : target;
  const commits = git(
    'log',
    '--no-merges',
    '--no-show-signature',
    '-z',
    '--format=%h%x00%s%x00%b',
    range,
    '--',
  ).split('\0');

  const breakingChanges = { title: 'Breaking changes', entries: [] as string[] };
  const otherChanges = { title: 'Other changes', entries: [] as string[] };
  const sections = new Map<string, { title: string; entries: string[] }>([
    ['feat', { title: 'Features', entries: [] }],
    ['fix', { title: 'Fixes', entries: [] }],
    ['perf', { title: 'Performance', entries: [] }],
    ['revert', { title: 'Reverts', entries: [] }],
    ['docs', { title: 'Documentation', entries: [] }],
    ['test', { title: 'Tests', entries: [] }],
    ['ci', { title: 'Continuous integration', entries: [] }],
  ]);

  for (let index = 0; index + 2 < commits.length; index += 3) {
    const hash = commits[index]!;
    const subject = commits[index + 1]!;
    const body = commits[index + 2]!;
    const match = conventionalSubject.exec(subject);
    if (!match) continue;

    const [, , scope, breaking, description] = match;
    const kind = match[1]!.toLowerCase();
    const detail = breakingFooter.exec(body)?.[1];
    if (kind === 'chore' && scope?.toLowerCase() === 'release' && !breaking && !detail) continue;

    const section = breaking || detail ? breakingChanges : (sections.get(kind) ?? otherChanges);
    const label = scope ? `**${scope}** — ` : '';
    const explanation = detail && detail !== description ? `\n  ${detail}` : '';
    section.entries.push(`- ${label}${description} (${hash})${explanation}`);
  }

  const notes = [breakingChanges, ...sections.values(), otherChanges]
    .filter(({ entries }) => entries.length)
    .map(({ title, entries }) => `### ${title}\n\n${entries.join('\n')}`);
  return notes.join('\n\n') || 'No Conventional Commits in this range.';
}

const [argument, ...extraArgs] = process.argv.slice(2);
const writeHistory = argument === '--write';
if (extraArgs.length || (argument && !writeHistory && !versionTag.test(argument))) {
  throw new Error('Usage: bun run changelog [vMAJOR.MINOR.PATCH | --write]');
}
if (git('rev-parse', '--is-shallow-repository').trim() === 'true') {
  throw new Error('Fetch the full Git history and tags before generating release notes.');
}

if (writeHistory) {
  const releases = releaseTags().map((tag) => `## ${tag}\n\n${releaseNotes(tag)}`);
  const history = releases.join('\n\n') || 'No release tags found.';
  writeFileSync('CHANGELOG.md', `# Changelog\n\n${history}\n`);
} else {
  console.log(`## Changes\n\n${releaseNotes(argument)}`);
}
