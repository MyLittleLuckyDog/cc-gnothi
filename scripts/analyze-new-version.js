#!/usr/bin/env node
/**
 * analyze-new-version.js
 *
 * V1: Metadata + command registration extraction only.
 *     No behavioral spec generation (V2 after manual validation).
 *
 * Usage:
 *   node analyze-new-version.js [--artifacts <path>] [--versions <path>] [--dry-run]
 *
 * Reads: caludeCodeAVX2/artifacts/claude-{X.X.X}.js  (READ-ONLY)
 * Writes: cc-gnothi/versions/v{X.X.X}/_index.md + {feature}.md stubs
 */

const fs = require('fs');
const path = require('path');

// ── Config ────────────────────────────────────────────────────────────────────

const SCRIPT_DIR = path.dirname(__filename);
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const DEFAULT_ARTIFACTS = path.resolve(REPO_ROOT, '..', 'caludeCodeAVX2', 'artifacts');
const DEFAULT_VERSIONS = path.join(REPO_ROOT, 'versions');

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    artifactsDir: DEFAULT_ARTIFACTS,
    versionsDir: DEFAULT_VERSIONS,
    dryRun: false,
    targetVersion: null,
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--artifacts' && args[i + 1]) opts.artifactsDir = args[++i];
    else if (args[i] === '--versions' && args[i + 1]) opts.versionsDir = args[++i];
    else if (args[i] === '--dry-run') opts.dryRun = true;
    else if (args[i] === '--version' && args[i + 1]) opts.targetVersion = args[++i];
  }
  return opts;
}

// ── Bundle analysis ───────────────────────────────────────────────────────────

function extractMeta(content, filePath) {
  const get = (pat) => { const m = content.match(pat); return m ? m[1] : null; };
  const lines = content.split('\n').length;
  const sizeMB = (Buffer.byteLength(content, 'utf8') / 1024 / 1024).toFixed(2);
  return {
    version: get(/VERSION:"([^"]+)"/),
    buildTime: get(/BUILD_TIME:"([^"]+)"/),
    gitSha: get(/GIT_SHA:"([^"]+)"/),
    bundleLines: lines,
    bundleSize: `${sizeMB} MB`,
    filePath,
  };
}

function extractCommands(content) {
  // Matches: {type:"local[-jsx]",name:"...",description:"..."}
  const pattern = /\{type:"(local(?:-jsx)?)",name:"([^"]+)",description:"([^"]+)"/g;
  const seen = new Set();
  const commands = [];
  let m;
  while ((m = pattern.exec(content)) !== null) {
    const key = m[2]; // name is unique enough for dedup
    if (!seen.has(key)) {
      seen.add(key);
      commands.push({ type: m[1], name: m[2], description: m[3] });
    }
  }
  return commands.sort((a, b) => a.name.localeCompare(b.name));
}

function diffCommands(prev, curr) {
  const prevNames = new Set(prev.map((c) => c.name));
  const currNames = new Set(curr.map((c) => c.name));
  const added = curr.filter((c) => !prevNames.has(c.name));
  const removed = prev.filter((c) => !currNames.has(c.name));
  return { added, removed };
}

// ── Version discovery ─────────────────────────────────────────────────────────

function semverCompare(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

function listArtifactVersions(artifactsDir) {
  return fs.readdirSync(artifactsDir)
    .filter((f) => /^claude-[\d.]+\.js$/.test(f))
    .map((f) => f.replace(/^claude-/, '').replace(/\.js$/, ''))
    .sort(semverCompare);
}

function listDocumentedVersions(versionsDir) {
  if (!fs.existsSync(versionsDir)) return [];
  return fs.readdirSync(versionsDir)
    .filter((d) => /^v[\d.]+$/.test(d) && fs.existsSync(path.join(versionsDir, d, '_index.md')))
    .map((d) => d.slice(1))
    .sort(semverCompare);
}

function findPrevVersion(allVersions, targetVersion) {
  const idx = allVersions.indexOf(targetVersion);
  return idx > 0 ? allVersions[idx - 1] : null;
}

// ── Document generation ───────────────────────────────────────────────────────

function buildIndexMd(meta, commands, diff, prevVersion) {
  const today = new Date().toISOString().slice(0, 10);
  const prevStr = prevVersion ? prevVersion : 'N/A';

  const commandTable = commands
    .map((c) => `| \`/${c.name}\` | ${c.description} |`)
    .join('\n');

  const addedRows = diff.added.length
    ? diff.added.map((c) => `| \`/${c.name}\` | ${c.description} | 추가 |`).join('\n')
    : '| — | — | — |';
  const removedRows = diff.removed.length
    ? diff.removed.map((c) => `| \`/${c.name}\` | — | 제거 |`).join('\n')
    : '';

  const chapterProposals = diff.added
    .map((c) => `- [ ] \`/${c.name}\` — ${c.description}. 기존 챕터 흡수 또는 신규 feature-spec 검토.`)
    .join('\n');

  return `---
cc_version: "${meta.version}"
build_time: "${meta.buildTime}"
git_sha: "${meta.gitSha}"
bundle_lines: ${meta.bundleLines}
bundle_size: "${meta.bundleSize}"
prev_version: "${prevStr}"
generated: "${today}"
---

# CC v${meta.version}

## 번들 메타
| 항목 | 값 |
|---|---|
| BUILD_TIME | ${meta.buildTime} |
| GIT_SHA | \`${meta.gitSha}\` |
| 번들 크기 | ${meta.bundleSize} / ${meta.bundleLines} lines |
| 이전 버전 | ${prevStr} |

## 커맨드 변경 (vs ${prevStr})
| 커맨드 | 설명 | 변경 |
|---|---|---|
${addedRows}
${removedRows || ''}

## 슬래시 커맨드 전체 목록 (v${meta.version})
| 커맨드 | 설명 |
|---|---|
${commandTable}

## 분석 문서
<!-- 자동화가 채움. 새 feature-spec 파일 작성 시 여기에 추가. -->
${diff.added.map((c) => `- [${c.name}.md](${c.name}.md) — /${c.name}: ${c.description} (stub, 분석 필요)`).join('\n')}

## 챕터 제안
<!-- 자동화가 채움. 신규 기능 감지 시 자동 추가. -->
${chapterProposals || '<!-- 이번 버전 신규 커맨드 없음 -->'}
`;
}

function buildFeatureStubMd(meta, cmd) {
  const today = new Date().toISOString().slice(0, 10);
  return `---
type: feature-spec
feature: "${cmd.name}"
cc_version: "${meta.version}"
updated: "${today}"
tags: ["${cmd.name}", "commands", "slash-commands"]
source: "bundle-registration-only"
bundle_verified: false
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "CC BY-NC-SA 4.0"
---

# \`/${cmd.name}\`

> 분석 기준: CC v${meta.version} bundle.js (등록 정보만 추출; 동작 명세 미분석)

## 등록 정보
| 항목 | 값 |
|---|---|
| name | \`${cmd.name}\` |
| type | \`${cmd.type}\` |
| description | ${cmd.description} |

## 동작 명세
<!-- TODO: bundle.js 심층 분석 필요 -->
<!-- 분석 대상: /${cmd.name} 처리 로직 전체 (입력 파싱 → 실행 → 출력) -->
<!-- 작성 규칙: 의사코드/Mermaid 전용. 번들 코드 인용 절대 금지. -->

## 자주 하는 실수
<!-- TODO: 분석 후 작성 -->

## 참고
- [commands.md](commands.md) — 전체 커맨드 목록
`;
}

// ── Writer ────────────────────────────────────────────────────────────────────

function writeFile(filePath, content, dryRun) {
  if (dryRun) {
    console.log(`[DRY-RUN] Would write: ${filePath} (${content.length} chars)`);
    return;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`  wrote: ${filePath}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

function processVersion(version, opts, allArtifactVersions) {
  const artifactPath = path.join(opts.artifactsDir, `claude-${version}.js`);
  const versionDir = path.join(opts.versionsDir, `v${version}`);

  console.log(`\n── Processing v${version} ──`);

  const content = fs.readFileSync(artifactPath, 'utf8');
  const meta = extractMeta(content, artifactPath);

  if (!meta.version || meta.version !== version) {
    console.warn(`  WARN: VERSION in bundle (${meta.version}) != filename (${version})`);
  }

  const commands = extractCommands(content);
  console.log(`  Commands found: ${commands.length}`);

  // Load prev version commands for diff
  const prevVersion = findPrevVersion(allArtifactVersions, version);
  let prevCommands = [];
  if (prevVersion) {
    const prevPath = path.join(opts.artifactsDir, `claude-${prevVersion}.js`);
    if (fs.existsSync(prevPath)) {
      const prevContent = fs.readFileSync(prevPath, 'utf8');
      prevCommands = extractCommands(prevContent);
      console.log(`  Prev version: ${prevVersion} (${prevCommands.length} commands)`);
    }
  }

  const diff = diffCommands(prevCommands, commands);
  console.log(`  Added: ${diff.added.map((c) => c.name).join(', ') || 'none'}`);
  console.log(`  Removed: ${diff.removed.map((c) => c.name).join(', ') || 'none'}`);

  // Write _index.md
  const indexPath = path.join(versionDir, '_index.md');
  const indexContent = buildIndexMd(meta, commands, diff, prevVersion);
  writeFile(indexPath, indexContent, opts.dryRun);

  // Write stub feature-spec for each newly added command
  for (const cmd of diff.added) {
    const stubPath = path.join(versionDir, `${cmd.name}.md`);
    if (!fs.existsSync(stubPath)) {
      const stubContent = buildFeatureStubMd(meta, cmd);
      writeFile(stubPath, stubContent, opts.dryRun);
    } else {
      console.log(`  skip (exists): ${stubPath}`);
    }
  }

  return { version, meta, commands, diff };
}

function main() {
  const opts = parseArgs();

  console.log('analyze-new-version.js V1');
  console.log(`  artifacts: ${opts.artifactsDir}`);
  console.log(`  versions:  ${opts.versionsDir}`);
  console.log(`  dry-run:   ${opts.dryRun}`);

  if (!fs.existsSync(opts.artifactsDir)) {
    console.error(`ERROR: artifacts dir not found: ${opts.artifactsDir}`);
    process.exit(1);
  }

  const allArtifact = listArtifactVersions(opts.artifactsDir);
  const documented = listDocumentedVersions(opts.versionsDir);

  console.log(`\nArtifacts:   ${allArtifact.join(', ')}`);
  console.log(`Documented:  ${documented.join(', ')}`);

  let targets;
  if (opts.targetVersion) {
    targets = [opts.targetVersion];
  } else {
    targets = allArtifact.filter((v) => !documented.includes(v));
  }

  if (targets.length === 0) {
    console.log('\nAll artifact versions are already documented. Nothing to do.');
    return;
  }

  console.log(`\nTo process: ${targets.join(', ')}`);

  const results = [];
  for (const v of targets) {
    const artifactPath = path.join(opts.artifactsDir, `claude-${v}.js`);
    if (!fs.existsSync(artifactPath)) {
      console.warn(`  SKIP: artifact not found: ${artifactPath}`);
      continue;
    }
    results.push(processVersion(v, opts, allArtifact));
  }

  console.log(`\n── Done. Processed ${results.length} version(s). ──`);
  if (!opts.dryRun && results.length > 0) {
    console.log('\nNext steps:');
    console.log('  1. Review _index.md for each new version');
    console.log('  2. For each stub {feature}.md: analyze bundle.js and replace TODO with verified behavioral spec');
    console.log('  3. Update "분석 문서" section in _index.md after spec is complete');
    console.log('  4. Review "챕터 제안" section — decide: absorb into existing chapter or keep as feature-spec');
  }
}

main();
