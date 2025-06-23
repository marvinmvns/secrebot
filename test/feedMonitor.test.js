import { test } from 'node:test';
import assert from 'node:assert/strict';
import FeedMonitor from '../src/services/feedMonitor.js';

// simple parseFeed test using sample xml
const sampleXML = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015">
  <entry>
    <yt:videoId>abc123</yt:videoId>
    <published>2024-01-01T00:00:00+00:00</published>
  </entry>
  <entry>
    <yt:videoId>def456</yt:videoId>
  </entry>
</feed>`;

// Create instance with dummy params
test('parseFeed extracts video ids', () => {
  const monitor = new FeedMonitor({ collection: ()=>({}) }, {}, {});
  const entries = monitor.parseFeed(sampleXML);
  assert.deepEqual(entries[0].videoId, 'abc123');
  assert.equal(entries.length, 2);
});
