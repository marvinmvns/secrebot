import { test } from 'node:test';
import assert from 'node:assert/strict';
import YouTubeService from '../src/services/youtubeService.js';

test('shouldUseYtDlp detects extraction errors', () => {
  assert.equal(YouTubeService.shouldUseYtDlp(new Error('Could not extract functions')),
    true);
  assert.equal(YouTubeService.shouldUseYtDlp(new Error('nsig extraction failed: throttle')),
    true);
  assert.equal(YouTubeService.shouldUseYtDlp(new Error('other error')), false);
});
