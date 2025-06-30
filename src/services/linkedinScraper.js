import { chromium } from 'playwright';
import logger from '../utils/logger.js';

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
 * Resilient LinkedIn profile scraper with structured data extraction
 * Captures detailed profile information without API dependencies
 *
 * @param {string} url - LinkedIn profile URL
 * @param {{liAt?: string, timeoutMs?: number, retries?: number}} [options]
 * @returns {Promise<object>} structured profile data with summary
 */
export async function fetchProfileStructured(url, options = {}) {
  const { liAt, timeoutMs = 45000, retries = 3 } = options;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    const browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    let context;
    
    try {
      context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'en-US'
      });

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
        waitUntil: 'domcontentloaded',
        timeout: timeoutMs
      });

      await page.waitForTimeout(2000);
      
      const profileData = await page.evaluate(() => {
        const data = {
          profile: {},
          experience: [],
          education: [],
          skills: [],
          about: '',
          location: '',
          connections: '',
          headline: '',
          name: ''
        };

        try {
          const nameElement = document.querySelector('h1.text-heading-xlarge') || 
                             document.querySelector('h1[data-generated-suggestion-target]') ||
                             document.querySelector('.pv-text-details__left-panel h1');
          data.name = nameElement?.textContent?.trim() || '';

          const headlineElement = document.querySelector('.text-body-medium.break-words') ||
                                 document.querySelector('.pv-text-details__left-panel .text-body-medium');
          data.headline = headlineElement?.textContent?.trim() || '';

          const locationElement = document.querySelector('.text-body-small.inline.t-black--light.break-words') ||
                                 document.querySelector('.pv-text-details__left-panel .text-body-small');
          data.location = locationElement?.textContent?.trim() || '';

          const connectionsElement = document.querySelector('span.t-black--light.t-normal') ||
                                   document.querySelector('.pv-text-details__left-panel .hoverable-link-text span');
          data.connections = connectionsElement?.textContent?.trim() || '';

          const aboutSection = document.querySelector('#about') || document.querySelector('[data-generated-suggestion-target="about"]');
          if (aboutSection) {
            const aboutText = aboutSection.closest('section')?.querySelector('.pv-shared-text-with-see-more .visually-hidden') ||
                             aboutSection.closest('section')?.querySelector('.pv-shared-text-with-see-more span[aria-hidden="true"]') ||
                             aboutSection.closest('section')?.querySelector('.display-flex .t-14');
            data.about = aboutText?.textContent?.trim() || '';
          }

          const experienceItems = document.querySelectorAll('#experience ~ .pvs-list__container .pvs-entity, #experience ~ * .pvs-entity');
          experienceItems.forEach(item => {
            const company = item.querySelector('.t-14.t-normal span[aria-hidden="true"]')?.textContent?.trim() || '';
            const title = item.querySelector('.t-14.t-bold span[aria-hidden="true"]')?.textContent?.trim() || '';
            const duration = item.querySelector('.t-12.t-normal.t-black--light span[aria-hidden="true"]')?.textContent?.trim() || '';
            
            if (company || title) {
              data.experience.push({
                title: title,
                company: company,
                duration: duration
              });
            }
          });

          const educationItems = document.querySelectorAll('#education ~ .pvs-list__container .pvs-entity, #education ~ * .pvs-entity');
          educationItems.forEach(item => {
            const school = item.querySelector('.t-14.t-normal span[aria-hidden="true"]')?.textContent?.trim() || '';
            const degree = item.querySelector('.t-14.t-bold span[aria-hidden="true"]')?.textContent?.trim() || '';
            const years = item.querySelector('.t-12.t-normal.t-black--light span[aria-hidden="true"]')?.textContent?.trim() || '';
            
            if (school || degree) {
              data.education.push({
                degree: degree,
                school: school,
                years: years
              });
            }
          });

          const skillsSection = document.querySelectorAll('#skills ~ .pvs-list__container .pvs-entity span[aria-hidden="true"], #skills ~ * .pvs-entity span[aria-hidden="true"]');
          skillsSection.forEach(skill => {
            const skillName = skill.textContent?.trim();
            if (skillName && !data.skills.includes(skillName) && skillName.length < 50) {
              data.skills.push(skillName);
            }
          });

          data.profile = {
            name: data.name,
            headline: data.headline,
            location: data.location,
            connections: data.connections,
            profileUrl: window.location.href
          };

        } catch (error) {
          logger.error('Error extracting profile data', error);
        }

        return data;
      });

      const rawText = await page.evaluate(() => document.body.innerText);
      
      await page.close();

      return {
        url,
        scrapedAt: new Date().toISOString(),
        success: true,
        attempt,
        data: profileData,
        rawText,
        dataQuality: calculateDataQuality(profileData)
      };

    } catch (err) {
      logger.error(`Attempt ${attempt} failed`, { message: err.message });
      
      if (attempt === retries) {
        return {
          url,
          scrapedAt: new Date().toISOString(),
          success: false,
          attempts: retries,
          error: err.message,
          data: null
        };
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      
    } finally {
      if (context) await context.close().catch(() => {});
      await browser.close().catch(() => {});
    }
  }
}

function calculateDataQuality(data) {
  let score = 0;
  let maxScore = 8;
  
  if (data.name) score++;
  if (data.headline) score++;
  if (data.location) score++;
  if (data.about && data.about.length > 50) score++;
  if (data.experience && data.experience.length > 0) score++;
  if (data.education && data.education.length > 0) score++;
  if (data.skills && data.skills.length > 3) score++;
  if (data.connections) score++;
  
  return {
    score,
    maxScore,
    percentage: Math.round((score / maxScore) * 100),
    quality: score >= 6 ? 'high' : score >= 4 ? 'medium' : 'low'
  };
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
