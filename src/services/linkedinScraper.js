import { chromium } from 'playwright';
import logger from '../utils/logger.js';
import { CONFIG } from '../config/index.js';

/**
 * Launches a browser instance with specified options.
 */
async function launchBrowser(options = {}) {
  const { headless = true, timeout = 60000 } = options;
  return chromium.launch({
    headless,
    timeout,
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox', 
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--disable-extensions',
      '--disable-plugins',
      '--disable-images',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'
    ]
  });
}

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
  const { liAt, timeoutMs = CONFIG.linkedin.rawTimeoutMs } = options;
  const browser = await launchBrowser({ timeout: timeoutMs });
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

    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('/checkpoint/challenge')) {
      return { success: false, error: 'INVALID_COOKIE', url, scrapedAt: new Date().toISOString() };
    }

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
  const { liAt, timeoutMs = CONFIG.linkedin.structuredTimeoutMs, retries = 2 } = options;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    const browser = await launchBrowser({ timeout: timeoutMs });
    let context;
    
    try {
      context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'en-US',
        extraHTTPHeaders: {
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
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
      
      // Interceptar requisições para melhorar performance
      await page.route('**/*', (route) => {
        const resourceType = route.request().resourceType();
        if (['image', 'media', 'font', 'stylesheet'].includes(resourceType)) {
          route.abort();
        } else {
          route.continue();
        }
      });
      
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: timeoutMs
      });

      const currentUrl = page.url();
      if (currentUrl.includes('/login') || currentUrl.includes('/checkpoint/challenge')) {
        return { success: false, error: 'INVALID_COOKIE', url, scrapedAt: new Date().toISOString() };
      }

      // Aguardar carregamento dinâmico
      await page.waitForTimeout(3000);
      
      // Scroll para carregar conteúdo lazy
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
        return new Promise(resolve => setTimeout(resolve, 2000));
      });
      
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
            // Múltiplos seletores para nome
            const nameSelectors = [
              'h1.text-heading-xlarge',
              'h1[data-generated-suggestion-target]',
              '.pv-text-details__left-panel h1',
              '.pv-top-card-section__name',
              '.profile-name',
              'h1',
              '[data-section="name"] h1'
            ];
            
            for (const selector of nameSelectors) {
              const element = document.querySelector(selector);
              if (element && element.textContent.trim()) {
                data.name = element.textContent.trim();
                break;
              }
            }

            // Múltiplos seletores para headline
            const headlineSelectors = [
              '.text-body-medium.break-words',
              '.pv-text-details__left-panel .text-body-medium',
              '.pv-top-card-section__headline',
              '.profile-headline',
              '[data-section="headline"] .text-body-medium'
            ];
            
            for (const selector of headlineSelectors) {
              const element = document.querySelector(selector);
              if (element && element.textContent.trim()) {
                data.headline = element.textContent.trim();
                break;
              }
            }

            // Múltiplos seletores para localização
            const locationSelectors = [
              '.text-body-small.inline.t-black--light.break-words',
              '.pv-text-details__left-panel .text-body-small',
              '.pv-top-card-section__location',
              '.profile-location',
              '[data-section="location"] .text-body-small'
            ];
            
            for (const selector of locationSelectors) {
              const element = document.querySelector(selector);
              if (element && element.textContent.trim()) {
                data.location = element.textContent.trim();
                break;
              }
            }

            // Múltiplos seletores para conexões
            const connectionsSelectors = [
              'span.t-black--light.t-normal',
              '.pv-text-details__left-panel .hoverable-link-text span',
              '.pv-top-card-section__connections',
              '.profile-connections'
            ];
            
            for (const selector of connectionsSelectors) {
              const element = document.querySelector(selector);
              if (element && element.textContent.trim()) {
                data.connections = element.textContent.trim();
                break;
              }
            }

            // Sobre - múltiplas estratégias
            const aboutSelectors = [
              '#about ~ .pvs-list__container .pvs-entity span[aria-hidden="true"]',
              '[data-generated-suggestion-target="about"] ~ .pvs-list__container .pvs-entity span[aria-hidden="true"]',
              '.pv-shared-text-with-see-more .visually-hidden',
              '.pv-shared-text-with-see-more span[aria-hidden="true"]',
              '.display-flex .t-14',
              '.about-section .text-body-medium'
            ];
            
            for (const selector of aboutSelectors) {
              const element = document.querySelector(selector);
              if (element && element.textContent.trim()) {
                data.about = element.textContent.trim();
                break;
              }
            }

            // Experiência - múltiplas estratégias
            const experienceSelectors = [
              '#experience ~ .pvs-list__container .pvs-entity',
              '#experience ~ * .pvs-entity',
              '.experience-section .pvs-entity',
              '[data-section="experience"] .pvs-entity'
            ];
            
            for (const selector of experienceSelectors) {
              const items = document.querySelectorAll(selector);
              if (items.length > 0) {
                items.forEach(item => {
                  const company = item.querySelector('.t-14.t-normal span[aria-hidden="true"]')?.textContent?.trim() || 
                                item.querySelector('.company-name')?.textContent?.trim() || '';
                  const title = item.querySelector('.t-14.t-bold span[aria-hidden="true"]')?.textContent?.trim() || 
                               item.querySelector('.job-title')?.textContent?.trim() || '';
                  const duration = item.querySelector('.t-12.t-normal.t-black--light span[aria-hidden="true"]')?.textContent?.trim() || 
                                  item.querySelector('.job-duration')?.textContent?.trim() || '';
                  
                  if (company || title) {
                    data.experience.push({
                      title: title,
                      company: company,
                      duration: duration
                    });
                  }
                });
                break;
              }
            }

            // Educação - múltiplas estratégias
            const educationSelectors = [
              '#education ~ .pvs-list__container .pvs-entity',
              '#education ~ * .pvs-entity',
              '.education-section .pvs-entity',
              '[data-section="education"] .pvs-entity'
            ];
            
            for (const selector of educationSelectors) {
              const items = document.querySelectorAll(selector);
              if (items.length > 0) {
                items.forEach(item => {
                  const school = item.querySelector('.t-14.t-normal span[aria-hidden="true"]')?.textContent?.trim() || 
                               item.querySelector('.school-name')?.textContent?.trim() || '';
                  const degree = item.querySelector('.t-14.t-bold span[aria-hidden="true"]')?.textContent?.trim() || 
                                item.querySelector('.degree-name')?.textContent?.trim() || '';
                  const years = item.querySelector('.t-12.t-normal.t-black--light span[aria-hidden="true"]')?.textContent?.trim() || 
                               item.querySelector('.education-years')?.textContent?.trim() || '';
                  
                  if (school || degree) {
                    data.education.push({
                      degree: degree,
                      school: school,
                      years: years
                    });
                  }
                });
                break;
              }
            }

            // Skills - múltiplas estratégias
            const skillsSelectors = [
              '#skills ~ .pvs-list__container .pvs-entity span[aria-hidden="true"]',
              '#skills ~ * .pvs-entity span[aria-hidden="true"]',
              '.skills-section .pvs-entity span[aria-hidden="true"]',
              '[data-section="skills"] .pvs-entity span[aria-hidden="true"]',
              '.skill-item',
              '.endorsed-skill'
            ];
            
            for (const selector of skillsSelectors) {
              const skills = document.querySelectorAll(selector);
              if (skills.length > 0) {
                skills.forEach(skill => {
                  const skillName = skill.textContent?.trim();
                  if (skillName && !data.skills.includes(skillName) && skillName.length < 50) {
                    data.skills.push(skillName);
                  }
                });
                break;
              }
            }

            data.profile = {
              name: data.name,
              headline: data.headline,
              location: data.location,
              connections: data.connections,
              profileUrl: window.location.href
            };

          } catch (error) {
            console.error('Error extracting profile data:', error);
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
export async function loginAndGetLiAt(email, password, timeoutMs = CONFIG.linkedin.timeoutMs) {
  const browser = await launchBrowser({ timeout: timeoutMs });
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto('https://www.linkedin.com/login', {
      waitUntil: 'networkidle',
      timeout: timeoutMs
    });
    await page.fill('input[name="session_key"]', email);
    await page.fill('input[name="session_password"]', password);
    
    await page.click('button[type="submit"]');

    try {
      await page.waitForNavigation({ waitUntil: 'networkidle', timeout: timeoutMs });
    } catch (e) {
      logger.warn(`A navegação falhou após a tentativa de login, o que pode ser esperado. Verificando o resultado...`);
    }

    const cookies = await context.cookies();
    const liAtCookie = cookies.find(c => c.name === 'li_at');

    if (liAtCookie) {
      return liAtCookie.value;
    }

    // Se o cookie não foi encontrado, o login falhou. Vamos descobrir o porquê.
    const errorSelector = '#error-for-password, #error-for-username';
    try {
      const errorElement = await page.waitForSelector(errorSelector, { timeout: 5000 });
      if (errorElement) {
        const errorMessage = await errorElement.textContent();
        throw new Error(`Credenciais inválidas: ${errorMessage.trim()}`);
      }
    } catch (e) {
      // O seletor de erro não foi encontrado, verificar outros problemas.
    }

    // Verificar outros problemas comuns, como verificações de segurança/CAPTCHA
    const pageTitle = await page.title();
    if (pageTitle.includes('Security Verification') || pageTitle.includes('Verificação de segurança')) {
      throw new Error('O LinkedIn está exigindo uma verificação de segurança (CAPTCHA). Tente fazer login manualmente no navegador para resolver.');
    }

    const pageContent = await page.content();
    if (pageContent.includes('checkpoint/challenge')) {
      throw new Error('O LinkedIn apresentou um desafio de segurança. Tente fazer login manualmente no navegador.');
    }

    throw new Error('Falha no login. O cookie li_at não foi encontrado e nenhuma mensagem de erro específica foi detectada.');

  } catch (err) {
    logger.error('Erro detalhado no loginAndGetLiAt:', err);
    // Re-lançar o erro específico para ser capturado pelo bot
    throw err;
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

class LinkedInScraper {
  constructor(options = {}) {
    this.liAt = options.liAt || CONFIG.linkedin.liAt;
    this.timeoutMs = options.timeoutMs || CONFIG.linkedin.timeoutMs;
  }

  async analyzeProfile(url) {
    const result = await fetchProfileStructured(url, {
      liAt: this.liAt,
      timeoutMs: this.timeoutMs,
      retries: 3
    });

    if (!result.success || !result.data) {
      logger.error('LinkedIn profile scrape failed', {
        url,
        error: result.error
      });
      return null;
    }

    const data = result.data;
    const profile = data.profile || {};
    const firstExp = Array.isArray(data.experience) ? data.experience[0] || {} : {};

    return {
      name: profile.name || '',
      title: profile.headline || firstExp.title || '',
      company: firstExp.company || '',
      location: profile.location || '',
      summary: data.about || '',
      skills: Array.isArray(data.skills) ? data.skills : []
    };
  }
}

export default LinkedInScraper;
