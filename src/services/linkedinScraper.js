import { chromium } from 'playwright';
import crypto from 'crypto';
import { execSync } from 'child_process';

// ==================== CONFIGURAÇÕES E CONSTANTES ====================
const SELECTORS = {
  profileName: [
    'h1.text-heading-xlarge',
    '.pv-text-details__left-panel h1',
    '[data-anonymize="person-name"]',
    '.pv-top-card h1'
  ],
  headline: [
    '.text-body-medium.break-words',
    '[data-field="headline"]',
    '.pv-text-details__left-panel .text-body-medium',
    'div.text-body-medium:not(.t-black--light)'
  ],
  location: [
    '.text-body-small.inline.t-black--light.break-words',
    '[class*="location"]',
    '.pv-text-details__left-panel span.text-body-small',
    '.pv-top-card__location'
  ],
  connections: [
    '.t-bold.t-black--light',
    '[class*="num-connections"]',
    '.pv-top-card__connections',
    'span[data-field="connections"]'
  ],
  profileImage: [
    '.pv-top-card-profile-picture__image img',
    '.profile-photo-edit__preview',
    '.pv-top-card__photo img'
  ],
  about: {
    section: '#about',
    content: [
      '#about ~ div .inline-show-more-text span[aria-hidden="true"]',
      '#about ~ div .pv-shared-text-with-see-more span[aria-hidden="true"]',
      '#about ~ div',
      '.pv-about-section div.inline-show-more-text'
    ]
  },
  showMoreButtons: [
    '.pv-profile-section__see-more-inline',
    '.pv-entity__show-more-button',
    '.inline-show-more-text__button',
    'button[aria-label*="Show more"]',
    '.pvs-list__footer-wrapper button'
  ]
};

// ==================== GERENCIAMENTO DE TAXA DE REQUISIÇÃO ====================
class RateLimiter {
  constructor(maxRequests = 50, timeWindow = 86400000) {
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindow;
    this.requests = [];
  }
  async waitIfNeeded() {
    const now = Date.now();
    this.requests = this.requests.filter(t => t > now - this.timeWindow);
    if (this.requests.length >= this.maxRequests) {
      const oldest = Math.min(...this.requests);
      const waitTime = this.timeWindow - (now - oldest) + Math.random() * 180000;
      console.log(`Rate limit reached. Waiting ${Math.round(waitTime / 60000)} minutes...`);
      await this.sleep(waitTime);
    }
    this.requests.push(now);
    const randomDelay = 3000 + Math.random() * 5000;
    await this.sleep(randomDelay);
  }
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

const rateLimiter = new RateLimiter();

// ==================== CRIAÇÃO DE NAVEGADOR STEALTH ====================
export async function createStealthBrowser(options = {}) {
  const launchOptions = {
    headless: options.headless !== false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-web-security',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920,1080',
      '--start-maximized',
      '--disable-notifications',
      '--disable-popup-blocking'
    ]
  };
  try {
    return await chromium.launch(launchOptions);
  } catch (err) {
    if (/executable .*doesn\'t exist/i.test(err.message || '')) {
      try {
        execSync('npx playwright install chromium', { stdio: 'inherit' });
        return await chromium.launch(launchOptions);
      } catch (installErr) {
        console.error('Failed to install Playwright browsers:', installErr);
      }
    }
    throw err;
  }
}

// ==================== CONTEXTO STEALTH ====================
async function createStealthContext(browser, liAtCookie) {
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'America/New_York',
    permissions: ['notifications'],
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    }
  });

  const cookies = [
    {
      name: 'li_at',
      value: liAtCookie,
      domain: '.linkedin.com',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'None'
    },
    {
      name: 'lang',
      value: 'v=2&lang=en-us',
      domain: '.linkedin.com',
      path: '/'
    },
    {
      name: 'bcookie',
      value: `"v=2&${crypto.randomBytes(16).toString('hex')}"`,
      domain: '.linkedin.com',
      path: '/'
    }
  ];
  await context.addCookies(cookies);
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'userAgent', { get: () => navigator.userAgent.replace(/HeadlessChrome/, 'Chrome') });
    Object.defineProperty(navigator, 'plugins', { get: () => [
      { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
      { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
      { name: 'Native Client', filename: 'internal-nacl-plugin' }
    ]});
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = parameters => (
      parameters.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission })
        : originalQuery(parameters)
    );
  });
  return context;
}

// ==================== LOGIN PARA OBTER LI_AT ====================
export async function loginAndGetLiAt(email, password, options = {}) {
  const browser = await createStealthBrowser(options);
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await rateLimiter.waitIfNeeded();
    await page.goto('https://www.linkedin.com/login', { waitUntil: 'networkidle', timeout: options.timeoutMs || 30000 });
    await page.fill('input[name="session_key"]', email, { delay: 50 });
    await page.waitForTimeout(500 + Math.random() * 1000);
    await page.fill('input[name="session_password"]', password, { delay: 50 });
    await page.waitForTimeout(500 + Math.random() * 1000);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: options.timeoutMs || 30000 }),
      page.click('button[type="submit"]')
    ]);
    if (await page.isVisible('[data-test-id="challenge-form"]')) {
      console.warn('Security challenge detected. Manual intervention required.');
      await page.waitForNavigation({ timeout: 300000 });
    }
    const cookies = await context.cookies();
    const liAt = cookies.find(c => c.name === 'li_at');
    if (!liAt) {
      throw new Error('Failed to obtain li_at cookie. Login may have failed.');
    }
    return liAt.value;
  } finally {
    await context.close();
    await browser.close();
  }
}

// ==================== EXTRAÇÃO ROBUSTA ====================
async function robustExtract(page, selectorArray, options = {}) {
  for (const selector of selectorArray) {
    try {
      const element = await page.locator(selector).first();
      if (await element.isVisible({ timeout: options.timeout || 1000 })) {
        const text = await element.textContent();
        return text ? text.trim() : null;
      }
    } catch (e) {
      continue;
    }
  }
  return options.defaultValue || null;
}

// ==================== EXTRAÇÃO ROBUSTA DE ATRIBUTOS ====================
async function robustExtractAttr(page, selectorArray, attr, options = {}) {
  for (const selector of selectorArray) {
    try {
      const element = await page.locator(selector).first();
      if (await element.isVisible({ timeout: options.timeout || 1000 })) {
        const value = await element.getAttribute(attr);
        if (value) return value;
      }
    } catch {
      continue;
    }
  }
  return options.defaultValue || null;
}

// ==================== EXTRAÇÃO DE MÚLTIPLOS ELEMENTOS ====================
async function extractMultiple(page, selector, limit = 100) {
  try {
    const elements = await page.locator(selector).all();
    const results = [];
    for (let i = 0; i < Math.min(elements.length, limit); i++) {
      const text = await elements[i].textContent();
      if (text) results.push(text.trim());
    }
    return results;
  } catch {
    return [];
  }
}

// ==================== SCROLL INTELIGENTE ====================
async function intelligentScroll(page) {
  await page.evaluate(async () => {
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    let previousHeight = 0;
    let scrollAttempts = 0;
    const maxScrollAttempts = 20;
    while (scrollAttempts < maxScrollAttempts) {
      window.scrollBy({ top: 800 + Math.random() * 400, behavior: 'smooth' });
      await delay(2000 + Math.random() * 1000);
      const showMoreButtons = document.querySelectorAll('.pv-profile-section__see-more-inline, .pv-entity__show-more-button, .inline-show-more-text__button, button[aria-label*="Show more"], .pvs-list__footer-wrapper button');
      for (const button of showMoreButtons) {
        if (button.offsetParent !== null) {
          button.click();
          await delay(500);
        }
      }
      const currentHeight = document.documentElement.scrollHeight;
      if (currentHeight === previousHeight) break;
      previousHeight = currentHeight;
      scrollAttempts++;
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1000);
}

// ==================== DADOS DE CONTATO ====================
async function extractContactInfo(page) {
  try {
    const contactLink = await page.locator('a[id*="contact-info"], .pv-top-card__contact-info').first();
    if (await contactLink.isVisible()) {
      await contactLink.click();
      await page.waitForTimeout(2000);
      const contactInfo = {
        email: await robustExtract(page, ['.ci-email .pv-contact-info__contact-link', 'a[href^="mailto:"]']),
        phone: await robustExtract(page, ['.ci-phone .pv-contact-info__contact-link', '.ci-phone span']),
        websites: await extractMultiple(page, '.ci-websites .pv-contact-info__contact-link'),
        twitter: await robustExtract(page, ['.ci-twitter .pv-contact-info__contact-link']),
        birthday: await robustExtract(page, ['.ci-birthday .pv-contact-info__contact-item']),
        address: await robustExtract(page, ['.ci-address .pv-contact-info__contact-link'])
      };
      const closeButton = await page.locator('button[aria-label*="Dismiss"], .artdeco-modal__dismiss').first();
      if (await closeButton.isVisible()) {
        await closeButton.click();
        await page.waitForTimeout(500);
      }
      return contactInfo;
    }
  } catch (e) {
    console.log('Could not extract contact info:', e.message);
  }
  return {};
}

// ==================== EXPERIÊNCIAS ====================
async function extractExperiences(page) {
  const experiences = [];
  try {
    const expSection = await page.locator('#experience').first();
    if (!await expSection.isVisible()) return experiences;
    const expCards = await page.locator('#experience ~ div .pvs-entity, #experience ~ div li.pvs-list__paged-list-item').all();
    for (const card of expCards) {
      try {
        const experience = {
          role: await card.locator('.t-bold span[aria-hidden="true"], [data-field="job_title"]').first().textContent() || '',
          company: await card.locator('.t-normal span[aria-hidden="true"], [data-field="company_name"]').first().textContent() || '',
          duration: await card.locator('.pvs-entity__caption-wrapper, .t-black--light span').first().textContent() || '',
          location: await card.locator('.t-black--light.t-normal span').nth(1).textContent().catch(() => ''),
          description: await card.locator('.pvs-list__outer-container .inline-show-more-text').textContent().catch(() => ''),
          logo: await card.locator('img').getAttribute('src').catch(() => ''),
          skills: []
        };
        const skillElements = await card.locator('.pv-entity__extra-details span').all();
        for (const skill of skillElements) {
          const text = await skill.textContent();
          if (text && !text.includes('·')) experience.skills.push(text.trim());
        }
        if (experience.role || experience.company) {
          experiences.push(experience);
        }
      } catch {
        continue;
      }
    }
  } catch (e) {
    console.log('Error extracting experiences:', e.message);
  }
  return experiences;
}

// ==================== EDUCAÇÃO ====================
async function extractEducation(page) {
  const education = [];
  try {
    const eduSection = await page.locator('#education').first();
    if (!await eduSection.isVisible()) return education;
    const eduCards = await page.locator('#education ~ div .pvs-entity, #education ~ div li.pvs-list__paged-list-item').all();
    for (const card of eduCards) {
      try {
        const edu = {
          school: await card.locator('.t-bold span[aria-hidden="true"], [data-field="school_name"]').first().textContent() || '',
          degree: await card.locator('.t-normal span[aria-hidden="true"], [data-field="degree_name"]').first().textContent() || '',
          fieldOfStudy: await card.locator('.t-normal span').nth(1).textContent().catch(() => ''),
          duration: await card.locator('.pvs-entity__caption-wrapper, .t-black--light span').first().textContent() || '',
          grade: await card.locator('.pv-entity__grade span').textContent().catch(() => ''),
          activities: await card.locator('.pv-entity__extra-details').textContent().catch(() => ''),
          logo: await card.locator('img').getAttribute('src').catch(() => '')
        };
        if (edu.school) education.push(edu);
      } catch {
        continue;
      }
    }
  } catch (e) {
    console.log('Error extracting education:', e.message);
  }
  return education;
}

// ==================== CERTIFICAÇÕES ====================
async function extractCertifications(page) {
  const certifications = [];
  try {
    const certSection = await page.locator('#licenses_and_certifications').first();
    if (!await certSection.isVisible()) return certifications;
    const certCards = await page.locator('#licenses_and_certifications ~ div .pvs-entity, #licenses_and_certifications ~ div li').all();
    for (const card of certCards) {
      try {
        const cert = {
          name: await card.locator('.t-bold span').first().textContent() || '',
          issuer: await card.locator('.t-normal span').first().textContent() || '',
          date: await card.locator('.pvs-entity__caption-wrapper span').first().textContent() || '',
          credentialId: await card.locator('.pv-certifications__credential-id').textContent().catch(() => ''),
          logo: await card.locator('img').getAttribute('src').catch(() => '')
        };
        if (cert.name) certifications.push(cert);
      } catch {
        continue;
      }
    }
  } catch (e) {
    console.log('Error extracting certifications:', e.message);
  }
  return certifications;
}

// ==================== SKILLS ====================
async function extractSkills(page) {
  const skills = [];
  try {
    const skillsSection = await page.locator('#skills').first();
    if (!await skillsSection.isVisible()) return skills;
    const skillCards = await page.locator('#skills ~ div .pvs-entity, .pv-skill-category-entity').all();
    for (const card of skillCards) {
      try {
        const skill = {
          name: await card.locator('.t-bold span, .pv-skill-category-entity__name').first().textContent() || '',
          endorsements: 0,
          endorsers: []
        };
        const endorsementText = await card.locator('.pv-skill-category-entity__endorsement-count').textContent().catch(() => '');
        if (endorsementText) {
          const match = endorsementText.match(/\d+/);
          if (match) skill.endorsements = parseInt(match[0]);
        }
        if (skill.name) skills.push(skill);
      } catch {
        continue;
      }
    }
  } catch (e) {
    console.log('Error extracting skills:', e.message);
  }
  return skills;
}

// ==================== IDIOMAS ====================
async function extractLanguages(page) {
  const languages = [];
  try {
    const langSection = await page.locator('#languages').first();
    if (!await langSection.isVisible()) return languages;
    const langCards = await page.locator('#languages ~ div .pvs-entity').all();
    for (const card of langCards) {
      try {
        const language = {
          name: await card.locator('.t-bold span').first().textContent() || '',
          proficiency: await card.locator('.t-normal span').first().textContent() || ''
        };
        if (language.name) languages.push(language);
      } catch {
        continue;
      }
    }
  } catch (e) {
    console.log('Error extracting languages:', e.message);
  }
  return languages;
}

// ==================== JSON-LD ====================
async function extractJsonLdData(page) {
  try {
    return await page.evaluate(() => {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      const data = [];
      scripts.forEach(script => {
        try {
          const parsed = JSON.parse(script.textContent);
          data.push(parsed);
        } catch {}
      });
      return data;
    });
  } catch {
    return [];
  }
}

// ==================== SCRAPING DE PERFIL ====================
export async function scrapeProfile(url, options = {}) {
  const { liAt, timeoutMs = 60000, maxRetries = 3 } = options;
  if (!liAt) throw new Error('li_at cookie is required for scraping');
  let browser, context, page;
  let attempts = 0;
  while (attempts < maxRetries) {
    try {
      await rateLimiter.waitIfNeeded();
      browser = await createStealthBrowser(options);
      context = await createStealthContext(browser, liAt);
      page = await context.newPage();
      await page.route('**/*', route => {
        const type = route.request().resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(type)) {
          route.abort();
        } else {
          route.continue();
        }
      });
      await page.goto(url, { waitUntil: 'networkidle', timeout: timeoutMs });
      if (await page.isVisible('[data-test-id="challenge-form"]')) throw new Error('Security challenge detected');
      if (await page.isVisible('.rate-limit-warning')) {
        const waitTime = 300000 + Math.random() * 180000;
        console.log(`Rate limit detected. Waiting ${Math.round(waitTime / 60000)} minutes...`);
        await page.waitForTimeout(waitTime);
        attempts++;
        continue;
      }
      await page.waitForSelector('h1', { timeout: 10000 });
      await intelligentScroll(page);
      const profileData = {
        url,
        scrapedAt: new Date().toISOString(),
        basic_info: {
          name: await robustExtract(page, SELECTORS.profileName),
          headline: await robustExtract(page, SELECTORS.headline),
          location: await robustExtract(page, SELECTORS.location),
          connections: await robustExtract(page, SELECTORS.connections),
          profileImage: await robustExtractAttr(page, SELECTORS.profileImage, 'src')
        },
        about: await robustExtract(page, SELECTORS.about.content),
        contact_info: await extractContactInfo(page),
        experiences: await extractExperiences(page),
        education: await extractEducation(page),
        skills: await extractSkills(page),
        certifications: await extractCertifications(page),
        languages: await extractLanguages(page),
        jsonLdData: await extractJsonLdData(page),
        success: true
      };
      const additionalSections = [
        { id: 'volunteering_experience', key: 'volunteering' },
        { id: 'honors_and_awards', key: 'awards' },
        { id: 'projects', key: 'projects' },
        { id: 'publications', key: 'publications' },
        { id: 'courses', key: 'courses' },
        { id: 'organizations', key: 'organizations' }
      ];
      for (const section of additionalSections) {
        const sectionElement = await page.locator(`#${section.id}`).first();
        if (await sectionElement.isVisible()) {
          profileData[section.key] = await page.locator(`#${section.id} ~ div .pvs-entity .t-bold span`).allTextContents();
        }
      }
      return profileData;
    } catch (error) {
      console.error(`Attempt ${attempts + 1} failed:`, error.message);
      attempts++;
      if (attempts >= maxRetries) {
        return {
          url,
          scrapedAt: new Date().toISOString(),
          success: false,
          error: error.message,
          basic_info: {},
          experiences: [],
          education: [],
          skills: [],
          certifications: [],
          languages: []
        };
      }
      const waitTime = Math.pow(2, attempts) * 60000 + Math.random() * 60000;
      console.log(`Waiting ${Math.round(waitTime / 60000)} minutes before retry...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    } finally {
      if (page) await page.close().catch(() => {});
      if (context) await context.close().catch(() => {});
      if (browser) await browser.close().catch(() => {});
    }
  }
}

// ==================== SCRAPING EM LOTE ====================
export async function scrapeMultipleProfiles(profileUrls, options = {}) {
  const { concurrency = 2, ...scrapeOptions } = options;
  const results = [];
  for (let i = 0; i < profileUrls.length; i += concurrency) {
    const batch = profileUrls.slice(i, i + concurrency);
    const batchPromises = batch.map(url => scrapeProfile(url, scrapeOptions).catch(error => ({ url, success: false, error: error.message })));
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    if (i + concurrency < profileUrls.length) {
      const delay = 30000 + Math.random() * 30000;
      console.log(`Waiting ${Math.round(delay / 1000)} seconds before next batch...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  return results;
}

// ==================== UTILIDADES ====================
export function saveToJson(data, filename = 'linkedin_profiles.json') {
  const fs = require('fs').promises;
  return fs.writeFile(filename, JSON.stringify(data, null, 2));
}

export function convertToCSV(profiles) {
  const headers = [
    'Name', 'Headline', 'Location', 'Email', 'Phone',
    'Current Company', 'Current Role', 'Skills Count',
    'Education', 'Certifications Count', 'Languages'
  ];
  const rows = profiles.map(profile => {
    const currentJob = profile.experiences?.[0] || {};
    return [
      profile.basic_info?.name || '',
      profile.basic_info?.headline || '',
      profile.basic_info?.location || '',
      profile.contact_info?.email || '',
      profile.contact_info?.phone || '',
      currentJob.company || '',
      currentJob.role || '',
      profile.skills?.length || 0,
      profile.education?.[0]?.school || '',
      profile.certifications?.length || 0,
      profile.languages?.map(l => l.name).join(', ') || ''
    ];
  });
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
  return csvContent;
}

// ==================== SCRAPING COM AUTO LOGIN ====================
export async function scrapeProfileWithAutoLogin(
  url,
  options = {}
) {
  const {
    liAt,
    user,
    pass,
    timeoutMs = 60000,
    scrapeFn = scrapeProfile,
    loginFn = loginAndGetLiAt
  } = options;
  if (!liAt && !(user && pass)) {
    throw new Error('li_at or credentials are required');
  }
  let result = await scrapeFn(url, { liAt, timeoutMs });
  const needsLogin =
    !result.success &&
    result.error &&
    /too many (redirect|request)/i.test(result.error);
  if (needsLogin && user && pass) {
    try {
      const newLiAt = await loginFn(user, pass, { timeoutMs });
      result = await scrapeFn(url, { liAt: newLiAt, timeoutMs });
      result.newLiAt = newLiAt;
    } catch (err) {
      // ignore login errors and return original result
    }
  }
  return result;
}
