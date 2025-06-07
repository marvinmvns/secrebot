import { chromium } from 'playwright';

/**
 * Fetch raw text and HTML from a LinkedIn profile page.
 * Only minimal navigation is performed. Use a valid `li_at` cookie
 * if the profile requires authentication.
 *
 * @param {string} url - LinkedIn profile URL
 * @param {{liAt?: string, timeoutMs?: number}} [options]
 * @returns {Promise<object>} result with rawText, rawHtml and success flag
 */
export async function fetchProfileRaw(url, options = {}) {
  const { liAt, timeoutMs = 30000 } = options;
  const browser = await chromium.launch({ headless: true });
  let context;
  try {
    context = await browser.newContext();
    if (liAt) {
      await context.addCookies([
        {
          name: 'li_at',
          value: liAt,
          domain: '.linkedin.com',
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'None'
        }
      ]);
    }
    const page = await context.newPage();
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: timeoutMs
    });
    const rawHtml = await page.content();
    const rawText = await page.evaluate(() => document.body.innerText);
    await page.close();
    return {
      url,
      scrapedAt: new Date().toISOString(),
      success: true,
      rawText,
      rawHtml
    };
  } catch (err) {
    return {
      url,
      scrapedAt: new Date().toISOString(),
      success: false,
      error: err.message
    };
  } finally {
    if (context) await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

/**
 * Perform a basic login on LinkedIn and return the `li_at` cookie.
 * Returns null on failure.
 */
export async function loginAndGetLiAt(email, password, timeoutMs = 30000) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto('https://www.linkedin.com/login', {
      waitUntil: 'networkidle',
      timeout: timeoutMs
    });
    await page.fill('input[name="session_key"]', email);
    await page.fill('input[name="session_password"]', password);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: timeoutMs }),
      page.click('button[type="submit"]')
    ]);
    const cookies = await context.cookies();
    const liAt = cookies.find(c => c.name === 'li_at');
    return liAt ? liAt.value : null;
  } catch {
    return null;
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}
