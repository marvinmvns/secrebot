import { chromium } from 'playwright';

export async function loginAndGetLiAt(user, pass, timeoutMs = 30000) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto('https://www.linkedin.com/login', { timeout: timeoutMs });
    await page.fill('input[name="session_key"]', user);
    await page.fill('input[name="session_password"]', pass);
    await Promise.all([
      page.waitForNavigation({ timeout: timeoutMs }),
      page.click('button[type="submit"]')
    ]);
    const cookies = await context.cookies();
    const liAt = cookies.find(c => c.name === 'li_at');
    return liAt ? liAt.value : null;
  } finally {
    await context.close();
    await browser.close();
  }
}

export async function scrapeProfile(url, { liAt, timeoutMs = 30000 } = {}) {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process'
    ]
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  if (liAt) {
    await context.addCookies([{ name: 'li_at', value: liAt, domain: '.linkedin.com', path: '/', httpOnly: true, secure: true }]);
  }

  const page = await context.newPage();

  try {
    let attempts = 0;
    while (attempts < 3) {
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: timeoutMs });
        break;
      } catch (err) {
        if (err.name === 'TimeoutError') {
          attempts++;
          if (attempts >= 3) throw err;
        } else {
          throw err;
        }
      }
    }

    await page.waitForTimeout(3000);
    await autoScroll(page);

    const profileData = await page.evaluate(() => {
      const getText = (selector) => {
        const element = document.querySelector(selector);
        return element ? element.textContent.trim() : null;
      };

      const getMultipleTexts = (selector) => {
        const elements = document.querySelectorAll(selector);
        return Array.from(elements).map(el => el.textContent.trim()).filter(t => t);
      };

      const name = getText('h1.text-heading-xlarge') ||
                   getText('h1') ||
                   getText('[class*="profile-name"]') ||
                   getText('.pv-text-details__left-panel h1');

      const headline = getText('.text-body-medium.break-words') ||
                       getText('[data-field="headline"]') ||
                       getText('.pv-text-details__left-panel .text-body-medium') ||
                       getText('div.text-body-medium:not(.t-black--light)');

      const location = getText('.text-body-small.inline.t-black--light.break-words') ||
                       getText('[class*="location"]') ||
                       getText('.pv-text-details__left-panel span.text-body-small');

      const aboutSection = document.querySelector('#about')?.parentElement;
      const about = aboutSection ?
                   getText('#about ~ div .inline-show-more-text span[aria-hidden="true"]') ||
                   getText('#about ~ div .pv-shared-text-with-see-more span[aria-hidden="true"]') ||
                   getText('#about ~ div') ||
                   aboutSection.querySelector('.pv-shared-text-with-see-more')?.textContent.trim() :
                   null;

      const experienceItems = [];
      const expSection = document.querySelector('#experience')?.parentElement;
      if (expSection) {
        const expCards = expSection.querySelectorAll('.pvs-entity, li.pvs-list__paged-list-item');
        expCards.forEach(card => {
          const role = card.querySelector('.t-bold span[aria-hidden="true"]')?.textContent.trim() ||
                       card.querySelector('[data-field="job_title"]')?.textContent.trim();
          const company = card.querySelector('.t-normal span[aria-hidden="true"]')?.textContent.trim() ||
                          card.querySelector('[data-field="company_name"]')?.textContent.trim();
          const duration = card.querySelector('.pvs-entity__caption-wrapper')?.textContent.trim() ||
                           card.querySelector('.t-black--light span[aria-hidden="true"]')?.textContent.trim();
          const description = card.querySelector('.pvs-list__outer-container .inline-show-more-text')?.textContent.trim();

          if (role || company) {
            experienceItems.push({
              role: role || 'N/A',
              company: company || 'N/A',
              duration: duration || 'N/A',
              description: description || null
            });
          }
        });
      }

      const educationItems = [];
      const eduSection = document.querySelector('#education')?.parentElement;
      if (eduSection) {
        const eduCards = eduSection.querySelectorAll('.pvs-entity, li.pvs-list__paged-list-item');
        eduCards.forEach(card => {
          const school = card.querySelector('.t-bold span[aria-hidden="true"]')?.textContent.trim() ||
                         card.querySelector('[data-field="school_name"]')?.textContent.trim();
          const degree = card.querySelector('.t-normal span[aria-hidden="true"]')?.textContent.trim() ||
                         card.querySelector('[data-field="degree_name"]')?.textContent.trim();
          const duration = card.querySelector('.pvs-entity__caption-wrapper')?.textContent.trim() ||
                           card.querySelector('.t-black--light span[aria-hidden="true"]')?.textContent.trim();

          if (school) {
            educationItems.push({
              school: school || 'N/A',
              degree: degree || 'N/A',
              duration: duration || 'N/A'
            });
          }
        });
      }

      const skills = getMultipleTexts('#skills ~ div .t-bold span[aria-hidden="true"]') ||
                    getMultipleTexts('[data-field="skill_name"]') ||
                    getMultipleTexts('.pv-skill-category-entity__name');

      const connections = getText('.t-bold.t-black--light') ||
                         getText('[class*="num-connections"]') ||
                         getText('.pv-top-card__connections');

      return {
        name,
        headline,
        location,
        about,
        connections,
        experiences: experienceItems,
        education: educationItems,
        skills: skills.slice(0, 10)
      };
    });

    return {
      url,
      scrapedAt: new Date().toISOString(),
      ...profileData,
      success: true
    };

  } catch (err) {
    return {
      url,
      scrapedAt: new Date().toISOString(),
      success: false,
      error: err.message,
      name: null,
      headline: null,
      location: null,
      about: null,
      connections: null,
      experiences: [],
      education: [],
      skills: []
    };

  } finally {
    await context.close();
    await browser.close();
  }
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
      setTimeout(() => {
        clearInterval(timer);
        resolve();
      }, 10000);
    });
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1000);
}
