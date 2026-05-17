/**
 * @module main/paperclip-adapter
 *
 * Public entrypoint for the Paperclip HTTP adapter. Called from the Electron
 * main process after `app.whenReady()`. Reads PAPERCLIP_ADAPTER_PORT
 * (default 3200) and ENABLE_PAPERCLIP_ADAPTER (default 'true').
 *
 * The server is bound to 127.0.0.1 by default. Set PAPERCLIP_ADAPTER_HOST=0.0.0.0
 * to expose to the LAN (only when Paperclip runs in Docker / on another machine).
 */

import type { Server } from 'http';
import { createAdapterServer } from './server';

let activeServer: Server | null = null;

export interface StartAdapterOptions {
  workspaceRoot: string;
  port?: number;
  host?: string;
}

export function startPaperclipAdapter(options: StartAdapterOptions): Server | null {
  if (process.env.ENABLE_PAPERCLIP_ADAPTER === 'false') {
    console.log('[PaperclipAdapter] Disabled via ENABLE_PAPERCLIP_ADAPTER=false');
    return null;
  }

  if (activeServer) {
    console.log('[PaperclipAdapter] Already running — skipping start');
    return activeServer;
  }

  const port = options.port ?? parseInt(process.env.PAPERCLIP_ADAPTER_PORT || '3200', 10);
  const host = options.host ?? process.env.PAPERCLIP_ADAPTER_HOST ?? '127.0.0.1';

  try {
    const server = createAdapterServer(options.workspaceRoot);
    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`[PaperclipAdapter] Port ${port} already in use — adapter not started`);
      } else {
        console.error('[PaperclipAdapter] Server error:', err);
      }
    });
    server.listen(port, host, () => {
      console.log(`[PaperclipAdapter] Listening on ${host}:${port}`);
      console.log(`[PaperclipAdapter] Workspace: ${options.workspaceRoot}`);
      console.log(`[PaperclipAdapter] Endpoints:`);
      console.log(`  GET  http://${host}:${port}/agents`);
      console.log(`  GET  http://${host}:${port}/agent/<id>/health`);
      console.log(`  POST http://${host}:${port}/agent/<id>/heartbeat`);
    });
    activeServer = server;
    return server;
  } catch (err) {
    console.error('[PaperclipAdapter] Failed to start:', err);
    return null;
  }
}

export function stopPaperclipAdapter(): Promise<void> {
  return new Promise((resolve) => {
    if (!activeServer) return resolve();
    const s = activeServer;
    activeServer = null;
    s.close((err) => {
      if (err) console.error('[PaperclipAdapter] Error during shutdown:', err);
      else console.log('[PaperclipAdapter] Stopped');
      resolve();
    });
  });
}

export function isPaperclipAdapterRunning(): boolean {
  return activeServer !== null;
}
