import * as fs from 'fs';
import * as path from 'path';

export function collectNewFiles(outputDirAbs: string, sinceMs: number): string[] {
  if (!fs.existsSync(outputDirAbs)) return [];
  const results: string[] = [];
  const walk = (dir: string) => {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      try {
        const st = fs.statSync(full);
        if (ent.isDirectory()) {
          walk(full);
        } else if (st.mtimeMs >= sinceMs) {
          results.push(full);
        }
      } catch {
        // Ignore files removed during traversal.
      }
    }
  };
  walk(outputDirAbs);
  return results;
}
