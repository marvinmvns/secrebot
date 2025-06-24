import { execFile } from 'child_process';
import { access } from 'fs/promises';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/**
 * Retrieve video metadata using the yt-dlp CLI.
 * @param {string} url Video URL
 * @param {string} [binaryPath='/usr/bin/yt-dlp'] Path to yt-dlp
 * @returns {Promise<object>} Parsed JSON metadata
 */
export async function getVideoInfoCli(url, binaryPath = '/usr/bin/yt-dlp') {
  try {
    await access(binaryPath);
  } catch {
    throw new Error('yt-dlp not found');
  }

  const maxBufferMb = parseInt(process.env.YTDLP_MAX_BUFFER_MB || '10', 10);
  const { stdout } = await execFileAsync(binaryPath, [url, '--dump-json'], {
    maxBuffer: maxBufferMb * 1024 * 1024
  });
  return JSON.parse(stdout);
}
