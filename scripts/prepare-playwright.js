/**
 * Bundles Playwright MCP + Chromium browser into resources/ for offline use.
 *
 * Output layout:
 *   resources/playwright-mcp/<platform>-<arch>/
 *     node_modules/    (with @playwright/mcp installed flat)
 *     entry.js         (small wrapper that requires @playwright/mcp/cli.js)
 *   resources/playwright-browsers/<platform>-<arch>/
 *     chromium-X/      (Playwright browser layout)
 *
 * At runtime, agent-runner sets PLAYWRIGHT_BROWSERS_PATH to the bundled
 * browsers dir and invokes entry.js via the bundled Node binary. End users
 * never need network access or `npx`.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const PROJECT_ROOT = path.join(__dirname, '..');
const PLAYWRIGHT_MCP_VERSION = require(path.join(PROJECT_ROOT, 'package.json')).dependencies[
  '@playwright/mcp'
];

function detectTargets() {
  const arg = process.argv.includes('--all');
  if (arg) {
    return [
      { platform: 'darwin', arch: 'arm64' },
      { platform: 'darwin', arch: 'x64' },
      { platform: 'win32', arch: 'x64' },
      { platform: 'linux', arch: 'x64' },
    ];
  }
  const platform = process.platform;
  const arch = process.arch;
  return [{ platform, arch }];
}

function copyNodeModule(srcModule, destNodeModules) {
  const moduleName = path.basename(srcModule);
  const dest = path.join(destNodeModules, moduleName);
  fs.cpSync(srcModule, dest, { recursive: true, dereference: false });
}

function bundleMcp(target) {
  const tag = `${target.platform}-${target.arch}`;
  const outDir = path.join(PROJECT_ROOT, 'resources', 'playwright-mcp', tag);
  const nodeModulesDir = path.join(outDir, 'node_modules');

  console.log(`[playwright-mcp] Bundling for ${tag}`);
  fs.mkdirSync(nodeModulesDir, { recursive: true });

  const rootNm = path.join(PROJECT_ROOT, 'node_modules');
  // Copy @playwright/mcp + dependencies (playwright, playwright-core, etc.)
  const required = [
    path.join(rootNm, '@playwright'),
    path.join(rootNm, 'playwright'),
    path.join(rootNm, 'playwright-core'),
    path.join(rootNm, 'commander'),
    path.join(rootNm, 'yaml'),
    path.join(rootNm, 'mime'),
    path.join(rootNm, 'ws'),
    path.join(rootNm, 'zod-to-json-schema'),
    path.join(rootNm, 'debug'),
    path.join(rootNm, 'ms'),
    path.join(rootNm, '@modelcontextprotocol'),
    path.join(rootNm, 'cross-spawn'),
    path.join(rootNm, 'path-key'),
    path.join(rootNm, 'shebang-command'),
    path.join(rootNm, 'shebang-regex'),
    path.join(rootNm, 'which'),
    path.join(rootNm, 'isexe'),
    path.join(rootNm, 'eventsource'),
    path.join(rootNm, 'eventsource-parser'),
    path.join(rootNm, 'pkce-challenge'),
    path.join(rootNm, 'content-type'),
    path.join(rootNm, 'raw-body'),
    path.join(rootNm, 'http-errors'),
    path.join(rootNm, 'depd'),
    path.join(rootNm, 'inherits'),
    path.join(rootNm, 'setprototypeof'),
    path.join(rootNm, 'statuses'),
    path.join(rootNm, 'toidentifier'),
    path.join(rootNm, 'unpipe'),
    path.join(rootNm, 'iconv-lite'),
    path.join(rootNm, 'safer-buffer'),
    path.join(rootNm, 'bytes'),
    path.join(rootNm, 'media-typer'),
    path.join(rootNm, 'on-finished'),
    path.join(rootNm, 'ee-first'),
    path.join(rootNm, 'express'),
    path.join(rootNm, 'cors'),
  ];

  for (const mod of required) {
    if (!fs.existsSync(mod)) {
      console.warn(`[playwright-mcp] skip (missing): ${path.relative(rootNm, mod)}`);
      continue;
    }
    copyNodeModule(mod, nodeModulesDir);
  }

  // Entry wrapper
  const entryPath = path.join(outDir, 'entry.js');
  fs.writeFileSync(
    entryPath,
    `#!/usr/bin/env node\n` +
      `// Bundled Playwright MCP entry — invokes the CLI directly without npx.\n` +
      `require('@playwright/mcp/cli.js');\n`
  );
  console.log(`[playwright-mcp] entry: ${entryPath}`);
}

function installChromium(target) {
  const tag = `${target.platform}-${target.arch}`;
  const browsersDir = path.join(PROJECT_ROOT, 'resources', 'playwright-browsers', tag);

  if (
    fs.existsSync(browsersDir) &&
    fs.readdirSync(browsersDir).some((f) => f.startsWith('chromium'))
  ) {
    console.log(`[playwright-browsers] already present for ${tag}, skip download`);
    return;
  }

  console.log(`[playwright-browsers] Downloading Chromium for ${tag} → ${browsersDir}`);
  fs.mkdirSync(browsersDir, { recursive: true });

  // Use the playwright CLI from our node_modules with PLAYWRIGHT_BROWSERS_PATH override
  const env = {
    ...process.env,
    PLAYWRIGHT_BROWSERS_PATH: browsersDir,
  };

  // Cross-platform browser downloads only work for the HOST platform by default.
  // For now: just download for the current platform. Cross-platform CI builds
  // will run this script on their respective runners.
  if (target.platform !== process.platform || target.arch !== process.arch) {
    console.log(
      `[playwright-browsers] Skipping ${tag} (not host); CI runner downloads in its own job`
    );
    return;
  }

  try {
    execSync(`npx --prefix "${PROJECT_ROOT}" playwright install chromium`, {
      env,
      stdio: 'inherit',
      cwd: PROJECT_ROOT,
    });
  } catch (err) {
    console.error(`[playwright-browsers] Failed: ${err.message}`);
    throw err;
  }
}

function main() {
  const targets = detectTargets();
  for (const target of targets) {
    bundleMcp(target);
    installChromium(target);
  }
  console.log('[playwright] ✓ done');
}

main();
