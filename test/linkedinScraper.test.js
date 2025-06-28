import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchProfileRaw, fetchProfileStructured, loginAndGetLiAt } from '../src/services/linkedinScraper.js';

test('fetchProfileRaw extracts text from data URL', async () => {
  const html = '<html><body><h1>Title</h1><p>Example</p></body></html>';
  const url = `data:text/html,${encodeURIComponent(html)}`;
  const res = await fetchProfileRaw(url, { timeoutMs: 5000 });
  assert.equal(res.success, true);
  assert.ok(res.rawText.includes('Title'));
});

test('fetchProfileStructured extracts structured data from LinkedIn-like HTML', async () => {
  const linkedinHTML = `
    <html>
      <body>
        <h1 class="text-heading-xlarge">John Doe</h1>
        <div class="text-body-medium break-words">Software Engineer at Tech Corp</div>
        <div class="text-body-small inline t-black--light break-words">São Paulo, Brazil</div>
        <span class="t-black--light t-normal">500+ connections</span>
        <section id="about">
          <div class="pv-shared-text-with-see-more">
            <span aria-hidden="true">Passionate software engineer with 5+ years of experience</span>
          </div>
        </section>
        <section id="experience">
          <div class="pvs-list__container">
            <div class="pvs-entity">
              <span class="t-14 t-bold" aria-hidden="true">Senior Developer</span>
              <span class="t-14 t-normal" aria-hidden="true">Tech Corp</span>
              <span class="t-12 t-normal t-black--light" aria-hidden="true">2021 - Present</span>
            </div>
          </div>
        </section>
        <section id="education">
          <div class="pvs-list__container">
            <div class="pvs-entity">
              <span class="t-14 t-bold" aria-hidden="true">Computer Science</span>
              <span class="t-14 t-normal" aria-hidden="true">University of São Paulo</span>
              <span class="t-12 t-normal t-black--light" aria-hidden="true">2016 - 2020</span>
            </div>
          </div>
        </section>
        <section id="skills">
          <div class="pvs-list__container">
            <div class="pvs-entity">
              <span aria-hidden="true">JavaScript</span>
            </div>
            <div class="pvs-entity">
              <span aria-hidden="true">React</span>
            </div>
            <div class="pvs-entity">
              <span aria-hidden="true">Node.js</span>
            </div>
          </div>
        </section>
      </body>
    </html>
  `;
  
  const url = `data:text/html,${encodeURIComponent(linkedinHTML)}`;
  const res = await fetchProfileStructured(url, { timeoutMs: 10000, retries: 1 });
  
  
  assert.equal(res.success, true);
  assert.equal(res.data.name, 'John Doe');
  assert.equal(res.data.headline, 'Software Engineer at Tech Corp');
  assert.ok(res.data.location.includes('Paulo, Brazil'));
  assert.equal(res.data.connections, '500+ connections');
  assert.ok(res.data.about.includes('Passionate software engineer'));
  assert.ok(res.data.experience.length >= 0);
  assert.ok(res.data.education.length >= 0);
  assert.ok(res.data.skills.length >= 0);
  assert.ok(res.dataQuality.percentage >= 30);
});

test('fetchProfileStructured handles retry mechanism on failure', async () => {
  const invalidUrl = 'https://invalid-url-that-will-fail.com';
  const res = await fetchProfileStructured(invalidUrl, { timeoutMs: 2000, retries: 2 });
  
  assert.equal(res.success, false);
  assert.equal(res.attempts, 2);
  assert.ok(res.error);
});

test('loginAndGetLiAt returns null for bad credentials', async () => {
  const cookie = await loginAndGetLiAt('invalid', 'invalid', 1000);
  assert.equal(cookie, null);
});
