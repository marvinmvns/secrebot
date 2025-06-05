import { chromium } from 'playwright';

export async function scrapeProfile(url) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    const name = await page.$eval('h1', el => el.textContent.trim());
    const headline = await page.$eval('[data-field="headline"], .text-body-medium', el => el.textContent.trim()).catch(() => null);
    const about = await page.$eval('#about ~ div p', el => el.textContent.trim()).catch(() => null);
    const experiences = await page.$$eval('#experience ~ ul li, section[id*=experience] li', els => els.map(e => e.innerText.trim()));
    const education = await page.$$eval('#education ~ ul li, section[id*=education] li', els => els.map(e => e.innerText.trim()));
    return { url, name, headline, about, experiences, education };
  } catch (err) {
    throw new Error(`Scraping failed: ${err.message}`);
  } finally {
    await browser.close();
  }
}
