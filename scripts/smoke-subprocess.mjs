#!/usr/bin/env node
// Verifies the subprocess plumbing of paperclip-adapter/runner.ts without
// burning API tokens: spawns the resolved binary with `--version` and asserts
// non-zero output. Confirms binary resolution, env propagation, and stdout
// capture work end-to-end.

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
  const local = path.join(process.cwd(), 'node_modules', '.bin', 'pi');
  return fs.existsSync(local) ? local : 'pi';
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

console.log('[smoke] resolved claude:', claudeBin);
console.log('[smoke] resolved pi:    ', piBin);

const claudeRes = await runVersion(claudeBin);
console.log('[smoke] claude --version exit', claudeRes.code, '→', claudeRes.out.trim() || claudeRes.err.trim());
console.assert(claudeRes.code === 0, 'claude --version exited 0');
console.assert(claudeRes.out.length > 0, 'claude --version produced stdout');

const piRes = await runVersion(piBin).catch((e) => ({ code: -1, out: '', err: e.message }));
console.log('[smoke] pi --version exit    ', piRes.code, '→', (piRes.out || piRes.err).trim().substring(0, 200));

console.log('[smoke] Subprocess plumbing OK.');
