#!/usr/bin/env node
/**
 * analyze-new-version.js
 *
 * V1: Metadata + command registration extraction only.
 *     No behavioral spec generation (that is done by analyze-command.md via claude -p).
 *
 * Usage:
 *   node analyze-new-version.js [--artifacts <path>] [--versions <path>] [--dry-run] [--version X.X.X]
 *
 * Reads: caludeCodeAVX2/artifacts/claude-{X.X.X}.js  (READ-ONLY)
 * Writes: cc-gnothi/versions/v{X.X.X}/_index.md + {feature}.md stubs
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

// ── Config ────────────────────────────────────────────────────────────────────

const SCRIPT_DIR = path.dirname(__filename);
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const DEFAULT_ARTIFACTS = path.resolve(REPO_ROOT, '..', 'caludeCodeAVX2', 'artifacts');
const DEFAULT_VERSIONS = path.join(REPO_ROOT, 'versions');
// Arbor binary path. `arbor` on PATH wins; otherwise the cargo-install
// default. Falls back gracefully (handler resolution is skipped, not
// fatal) when neither exists.
const ARBOR_BIN = process.env.ARBOR_BIN || 'arbor';

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
    const key = m[2];
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

// ── Arbor handler-resolution integration (G3-B) ───────────────────────────────

/**
 * Run the four-step handler-resolution pipeline against one bundle:
 *
 *   1. Stage the bundle in a fresh temp dir (Arbor indexes a directory).
 *   2. `arbor index <dir> --save`         → produces `.arbor/graph.json`.
 *   3. `extract-ast.js --build-index ...` → produces cc-gnothi's per-cmd
 *      byte-range registration index (Pass 3).
 *   4. `arbor-handler-lookup.js`          → joins the two and returns JSON.
 *
 * Returns the parsed handler-lookup JSON `{ totals, per_command,
 * unresolved, ... }` on success, or `null` if any step failed or
 * `arbor` isn't installed. **Always graceful**: a missing arbor must
 * NOT block the rest of the per-version analysis from completing.
 */
function runHandlerLookup(version, opts) {
  const bundlePath = path.join(opts.artifactsDir, `claude-${version}.js`);
  const versionDir = path.join(opts.versionsDir, `v${version}`);

  // Probe for `arbor`. Skip cleanly if absent — first-time contributors
  // shouldn't get errors on a missing dev tool.
  const probe = spawnSync(ARBOR_BIN, ['--version'], { stdio: 'pipe' });
  if (probe.status !== 0) {
    console.log(`  arbor handler-lookup: SKIP (${ARBOR_BIN} not on PATH)`);
    return null;
  }

  const arborDir = fs.mkdtempSync(path.join(os.tmpdir(), `cc-arbor-${version}-`));
  const stagedBundle = path.join(arborDir, 'bundle.js');
  try {
    fs.copyFileSync(bundlePath, stagedBundle);

    // 2. arbor index --save
    const idx = spawnSync(ARBOR_BIN, ['index', arborDir, '--save'], {
      stdio: 'pipe',
      encoding: 'utf8',
    });
    if (idx.status !== 0) {
      console.warn(`  arbor index failed (exit ${idx.status}); skipping handler resolution.`);
      if (idx.stderr) console.warn(`    stderr: ${idx.stderr.trim().slice(0, 200)}`);
      return null;
    }

    // 3. cc-gnothi build-index against the staged bundle.
    const buildIdx = spawnSync('node', [
      path.join(SCRIPT_DIR, 'extract-ast.js'),
      '--build-index',
      '--bundle', stagedBundle,
      '--version', version,
    ], { stdio: 'pipe', encoding: 'utf8' });
    if (buildIdx.status !== 0) {
      console.warn(`  extract-ast --build-index failed; skipping handler resolution.`);
      if (buildIdx.stderr) console.warn(`    stderr: ${buildIdx.stderr.trim().slice(0, 200)}`);
      return null;
    }

    // 4. arbor-handler-lookup (in-process; one Arbor graph load, all cmds).
    const lookup = spawnSync('node', [
      path.join(SCRIPT_DIR, 'arbor-handler-lookup.js'),
      '--bundle', stagedBundle,
      '--version', version,
    ], { stdio: 'pipe', encoding: 'utf8' });
    if (lookup.status !== 0) {
      console.warn(`  arbor-handler-lookup failed; skipping.`);
      if (lookup.stderr) console.warn(`    stderr: ${lookup.stderr.trim().slice(0, 200)}`);
      return null;
    }

    let json;
    try {
      json = JSON.parse(lookup.stdout);
    } catch (e) {
      console.warn(`  arbor-handler-lookup output not valid JSON: ${e.message}`);
      return null;
    }

    // 5. Persist alongside _index.md so reviewers / downstream tools can
    // open per-version handler detail without re-running the pipeline.
    const handlersPath = path.join(versionDir, '_handlers.json');
    if (!opts.dryRun) {
      if (!fs.existsSync(versionDir)) fs.mkdirSync(versionDir, { recursive: true });
      fs.writeFileSync(handlersPath, JSON.stringify(json, null, 2) + '\n');
      console.log(`  wrote: ${handlersPath}`);
    } else {
      console.log(`  (dry-run) would write: ${handlersPath}`);
    }
    return json;
  } finally {
    // Clean the staging dir (small, but accumulates over many versions).
    try { fs.rmSync(arborDir, { recursive: true, force: true }); }
    catch (_) { /* best-effort */ }
  }
}

/**
 * One-line summary of handler-lookup totals for `_index.md`.
 * Returns the markdown to splice in, or an empty string when arbor was
 * skipped — the doc just won't show that section in that case.
 */
function formatHandlerSummary(handlerResult) {
  if (!handlerResult || !handlerResult.totals) return '';
  const t = handlerResult.totals;
  const total = t.total ?? '?';
  const resolved = t.handler_resolved ?? 0;
  const pct = total ? Math.round((resolved / total) * 100) : 0;
  const direct = t.direct_hit ?? 0;
  const modid = t.via_module_id ?? 0;
  const loadid = t.via_load_ident ?? 0;
  const unresolved = t.no_resolution ?? 0;
  return `## Handler Resolution (G3-B integration)

| Metric | Value |
|---|---:|
| Total commands | ${total} |
| Handler resolved | **${resolved} / ${total} (${pct}%)** |
| via direct byte-range (path 1) | ${direct} |
| via module_id follow (path 2) | ${modid} |
| via load_ident direct (path 3) | ${loadid} |
| Unresolved | ${unresolved} |

Per-command detail: [\`_handlers.json\`](_handlers.json).
`;
}

function buildIndexMd(meta, commands, diff, prevVersion, handlerSection = '') {
  const today = new Date().toISOString().slice(0, 10);
  const prevStr = prevVersion || 'N/A';

  const commandTable = commands
    .map((c) => `| \`/${c.name}\` | ${c.description} |`)
    .join('\n');

  const addedRows = diff.added.length
    ? diff.added.map((c) => `| \`/${c.name}\` | ${c.description} | added |`).join('\n')
    : '| — | — | — |';
  const removedRows = diff.removed.length
    ? diff.removed.map((c) => `| \`/${c.name}\` | — | removed |`).join('\n')
    : '';

  const chapterProposals = diff.added
    .map((c) => `- [ ] \`/${c.name}\` — ${c.description}. Review: absorb into existing chapter or create new feature-spec.`)
    .join('\n');

  const docList = diff.added
    .map((c) => `- [${c.name}.md](${c.name}.md) — \`/${c.name}\`: ${c.description} (stub, analysis pending)`)
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

## Bundle Metadata

| Field | Value |
|---|---|
| BUILD_TIME | ${meta.buildTime} |
| GIT_SHA | \`${meta.gitSha}\` |
| Bundle size | ${meta.bundleSize} / ${meta.bundleLines} lines |
| Previous version | ${prevStr} |

## Command Changes (vs ${prevStr})

| Command | Description | Change |
|---|---|---|
${addedRows}
${removedRows || ''}

## All Slash Commands (v${meta.version})

| Command | Description |
|---|---|
${commandTable}

## Feature Spec Documents

<!-- Populated by automation. Add entries here when a feature-spec file is complete. -->
${docList || '<!-- No new commands this version -->'}

## Chapter Proposals

<!-- Populated by automation when new commands are detected. -->
${chapterProposals || '<!-- No new commands this version -->'}
${handlerSection ? '\n' + handlerSection : ''}`;
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
license: "AGPL-3.0-only"
---

# \`/${cmd.name}\`

> Analysis basis: CC v${meta.version} bundle.js (registration only; behavioral spec not yet analyzed)

## Registration

| Field | Value |
|---|---|
| name | \`${cmd.name}\` |
| type | \`${cmd.type}\` |
| description | ${cmd.description} |

## Behavioral Spec

<!-- TODO: requires bundle.js deep analysis -->
<!-- Target: complete control flow for /${cmd.name} (input parsing → execution → output) -->
<!-- Rule: pseudocode/Mermaid only. Never quote bundle code. -->

## Common Mistakes

<!-- TODO: fill after analysis -->

## See Also

- [_index.md](_index.md) — full command list for v${meta.version}
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

  // G3-B: run handler resolution against the bundle. Best-effort —
  // a missing arbor binary or transient indexing failure must NOT block
  // the rest of the per-version write. Result is spliced into _index.md
  // as a one-table summary; full per-command detail goes to _handlers.json.
  const handlerResult = runHandlerLookup(version, opts);
  const handlerSection = formatHandlerSummary(handlerResult);

  // Write _index.md (always regenerate)
  const indexPath = path.join(versionDir, '_index.md');
  const indexContent = buildIndexMd(meta, commands, diff, prevVersion, handlerSection);
  writeFile(indexPath, indexContent, opts.dryRun);

  // Write stub for each new command (skip if already exists with bundle_verified:true)
  for (const cmd of diff.added) {
    const stubPath = path.join(versionDir, `${cmd.name}.md`);
    if (fs.existsSync(stubPath)) {
      const existing = fs.readFileSync(stubPath, 'utf8');
      if (existing.includes('bundle_verified: true')) {
        console.log(`  skip (verified): ${stubPath}`);
        continue;
      }
    }
    const stubContent = buildFeatureStubMd(meta, cmd);
    writeFile(stubPath, stubContent, opts.dryRun);
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
    console.log('Use --version X.X.X to force-regenerate a specific version.');
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
    console.log('  1. Review _index.md for each version');
    console.log('  2. For each stub {command}.md: run claude -p with scripts/prompts/analyze-command.md');
    console.log('  3. Update bundle_verified: true in the feature-spec frontmatter after verification');
  }
}

main();
