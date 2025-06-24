import { spawn } from 'child_process';
import { access } from 'fs/promises';

/**
 * Execute yt-dlp with verbose output and return stdout as string.
 * Logs executed command and any stderr output for easier debugging.
 * @param {string} url - Video URL to query.
 * @param {string} [binaryPath='/usr/bin/yt-dlp'] - Path to the yt-dlp executable.
 */
export async function debugGetVideoInfo(url, binaryPath = '/usr/bin/yt-dlp') {
  try {
    await access(binaryPath);
  } catch {
    console.error(`[debug] yt-dlp binary not found: ${binaryPath}`);
    throw new Error('yt-dlp not found');
  }

  return new Promise((resolve, reject) => {
    const args = [url, '--dump-json', '--verbose'];
    console.log(`[debug] Executing: ${binaryPath} ${args.join(' ')}`);

    const proc = spawn(binaryPath, args);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      const str = data.toString();
      stdout += str;
      process.stdout.write(`[debug:stdout] ${str}`);
    });

    proc.stderr.on('data', (data) => {
      const str = data.toString();
      stderr += str;
      process.stderr.write(`[debug:stderr] ${str}`);
    });

    proc.on('error', (err) => {
      console.error('[debug] Failed to start yt-dlp:', err.message);
      reject(err);
    });

    proc.on('close', (code) => {
      if (code === 0) {
        try {
          const info = JSON.parse(stdout);
          resolve(info);
        } catch (e) {
          reject(e);
        }
      } else {
        const err = new Error(`yt-dlp exited with code ${code}`);
        err.stderr = stderr;
        reject(err);
      }
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [url, binary] = process.argv.slice(2);
  if (!url) {
    console.error('Usage: node debugYtdlp.js <url> [yt-dlp path]');
    process.exit(1);
  }
  debugGetVideoInfo(url, binary).then(
    (info) => {
      console.log('\n[debug] Title:', info.title);
    },
    (err) => {
      console.error('[debug] Error:', err);
      process.exit(1);
    },
  );
}
