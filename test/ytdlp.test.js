import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getVideoInfoCli } from '../src/utils/ytdlp.js';
import fs from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';

// Test handling of large stdout from yt-dlp

test('getVideoInfoCli handles large stdout', async () => {
  const scriptPath = path.join(tmpdir(), `dummy_ytdlp_${Date.now()}.js`);
  const script = `#!/usr/bin/env node\n` +
    `const info = { url: process.argv[2], arg: process.argv[3], data: 'a'.repeat(300000) };\n` +
    `process.stdout.write(JSON.stringify(info));\n`;
  await fs.writeFile(scriptPath, script);
  await fs.chmod(scriptPath, 0o755);
  try {
    const info = await getVideoInfoCli('http://example.com', scriptPath);
    assert.equal(info.url, 'http://example.com');
    assert.equal(info.arg, '--dump-json');
    assert.equal(info.data.length, 300000);
  } finally {
    await fs.unlink(scriptPath);
  }
});
