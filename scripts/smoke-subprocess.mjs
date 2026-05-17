#!/usr/bin/env node
// Verifies Paperclip CLI backend binary resolution without burning API tokens:
// spawns each supported CLI with `--version` and checks availability.

import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const HOME = process.env.HOME || '';

function resolveBinaryPath(backend) {
  if (backend === 'claude') {
    const candidates = [
      process.env.PAPERCLIP_CLAUDE_BIN,
      path.join(HOME, '.local', 'bin', 'claude'),
      '/usr/local/bin/claude',
      '/opt/homebrew/bin/claude',
    ].filter(Boolean);
    for (const c of candidates) if (fs.existsSync(c)) return c;
    return 'claude';
  }
  if (backend === 'codex') {
    return process.env.PAPERCLIP_CODEX_BIN || 'codex';
  }
  const candidates = [
    process.env.PAPERCLIP_PI_BIN,
    path.join(process.cwd(), 'node_modules', '.bin', 'pi'),
  ].filter(Boolean);
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return 'pi';
}

function runVersion(bin) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, ['--version'], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (c) => (out += c.toString()));
    child.stderr.on('data', (c) => (err += c.toString()));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, out, err }));
  });
}

const claudeBin = resolveBinaryPath('claude');
const piBin = resolveBinaryPath('pi');
const codexBin = resolveBinaryPath('codex');

console.log('[smoke] resolved claude:', claudeBin);
console.log('[smoke] resolved pi:    ', piBin);
console.log('[smoke] resolved codex: ', codexBin);

const claudeRes = await runVersion(claudeBin);
console.log('[smoke] claude --version exit', claudeRes.code, '→', claudeRes.out.trim() || claudeRes.err.trim());
console.assert(claudeRes.code === 0, 'claude --version exited 0');
console.assert(claudeRes.out.length > 0, 'claude --version produced stdout');

const piRes = await runVersion(piBin).catch((e) => ({ code: -1, out: '', err: e.message }));
console.log('[smoke] pi --version exit    ', piRes.code, '→', (piRes.out || piRes.err).trim().substring(0, 200));
console.assert(piRes.code === 0, 'pi --version exited 0');

const codexRes = await runVersion(codexBin).catch((e) => ({ code: -1, out: '', err: e.message }));
console.log('[smoke] codex --version exit ', codexRes.code, '→', (codexRes.out || codexRes.err).trim().substring(0, 200));
if (codexRes.code !== 0) {
  console.warn('[smoke] codex backend unavailable; UI should hide CLI codex unless configured.');
}

console.log('[smoke] Subprocess plumbing OK.');
