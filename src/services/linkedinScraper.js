import { chromium } from 'playwright';
import logger from '../utils/logger.js';
import { CONFIG } from '../config/index.js';

/**
 * Launches a browser instance with modern anti-detection settings
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
      '--disable-renderer-backgrounding',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=TranslateUI',
      '--disable-ipc-flooding-protection',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-default-apps',
      '--disable-sync',
      '--disable-translate',
      '--hide-scrollbars',
      '--mute-audio',
      '--no-zygote',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-client-side-phishing-detection',
      '--disable-component-extensions-with-background-pages',
      '--disable-domain-reliability',
      '--disable-features=AudioServiceOutOfProcess',
      '--disable-hang-monitor',
      '--disable-ipc-flooding-protection',
      '--disable-prompt-on-repost',
      '--disable-renderer-backgrounding',
      '--disable-sync',
      '--force-color-profile=srgb',
      '--metrics-recording-only',
      '--no-first-run',
      '--password-store=basic',
      '--use-mock-keychain',
      '--disable-features=TranslateUI',
      '--disable-features=BlinkGenPropertyTrees',
      '--disable-features=VizDisplayCompositor'
    ]
  });
}

/**
 * Enhanced context creation with modern anti-detection
 */
async function createContext(browser, liAt = null) {
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1'
    }
  });

  // Add cookies if provided
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

  // Add stealth scripts
  await context.addInitScript(() => {
    // Remove webdriver property
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });

    // Override permissions
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) => (
      parameters.name === 'notifications' ?
        Promise.resolve({ state: Notification.permission }) :
        originalQuery(parameters)
    );

    // Override plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });

    // Override languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });

    // Override chrome
    window.chrome = {
      runtime: {},
    };
  });

  return context;
}

/**
 * Enhanced profile data extraction with multiple strategies
 */
async function extractProfileData(page) {
  return await page.evaluate(() => {
    const data = {
      profile: {},
      experience: [],
      education: [],
      skills: [],
      certifications: [],
      publications: [],
      honors: [],
      languages: [],
      volunteering: [],
      about: '',
      location: '',
      connections: '',
      headline: '',
      name: '',
      profilePictureUrl: '',
      bannerUrl: '',
      contactInfo: {},
      recommendations: [],
      projects: [],
      courses: [],
      patents: [],
      testScores: [],
      interests: []
    };

    const getText = (node, selector) => {
      const element = node?.querySelector(selector);
      return element?.textContent?.trim() || '';
    };

    const getAttribute = (node, selector, attribute) => {
      const element = node?.querySelector(selector);
      return element?.getAttribute(attribute) || '';
    };

    const extractFromMultipleSelectors = (selectors, extractor) => {
      for (const selector of selectors) {
        const result = extractor(selector);
        if (result) return result;
      }
      return null;
    };

    const extractListItems = (containerSelectors, itemSelectors) => {
      for (const containerSelector of containerSelectors) {
        const container = document.querySelector(containerSelector);
        if (container) {
          const items = container.querySelectorAll(itemSelectors);
          if (items.length > 0) {
            return Array.from(items);
          }
        }
      }
      return [];
    };

    try {
      // Profile Picture - Multiple strategies
      const pictureSelectors = [
        'img.pv-top-card-profile-picture__image',
        'img.presence-entity__image',
        '.profile-picture img',
        '.pv-top-card__photo img',
        'img[alt*="profile"]',
        '.profile-picture-container img'
      ];
      data.profilePictureUrl = extractFromMultipleSelectors(pictureSelectors, 
        selector => getAttribute(document, selector, 'src'));

      // Banner Image
      const bannerSelectors = [
        '.profile-banner__image-container img',
        '.profile-banner img',
        '.banner-image img',
        '.profile-header img'
      ];
      data.bannerUrl = extractFromMultipleSelectors(bannerSelectors,
        selector => getAttribute(document, selector, 'src'));

      // Name - Enhanced extraction
      const nameSelectors = [
        'h1.text-heading-xlarge',
        'h1[data-generated-suggestion-target]',
        '.pv-text-details__left-panel h1',
        '.pv-top-card-section__name',
        '.profile-name',
        'h1',
        '[data-section="name"] h1',
        '.pv-top-card__name',
        '.profile-header h1',
        '.name-container h1'
      ];
      data.name = extractFromMultipleSelectors(nameSelectors,
        selector => getText(document, selector));

      // Headline - Enhanced extraction
      const headlineSelectors = [
        '.text-body-medium.break-words',
        '.pv-text-details__left-panel .text-body-medium',
        '.pv-top-card-section__headline',
        '.profile-headline',
        '[data-section="headline"] .text-body-medium',
        '.pv-top-card__headline',
        '.profile-header .headline',
        '.headline-text'
      ];
      data.headline = extractFromMultipleSelectors(headlineSelectors,
        selector => getText(document, selector));

      // Location - Enhanced extraction
      const locationSelectors = [
        '.text-body-small.inline.t-black--light.break-words',
        '.pv-text-details__left-panel .text-body-small',
        '.pv-top-card-section__location',
        '.profile-location',
        '[data-section="location"] .text-body-small',
        '.location-text',
        '.profile-location-text'
      ];
      data.location = extractFromMultipleSelectors(locationSelectors,
        selector => getText(document, selector));

      // Connections - Enhanced extraction
      const connectionsSelectors = [
        'span.t-black--light.t-normal',
        '.pv-text-details__left-panel .hoverable-link-text span',
        '.pv-top-card-section__connections',
        '.profile-connections',
        '.connections-count',
        '.network-info'
      ];
      data.connections = extractFromMultipleSelectors(connectionsSelectors,
        selector => getText(document, selector));

      // About/Summary - Multiple strategies
      const aboutSelectors = [
        '#about ~ .pvs-list__container .pvs-entity span[aria-hidden="true"]',
        '[data-generated-suggestion-target="about"] ~ .pvs-list__container .pvs-entity span[aria-hidden="true"]',
        '.pv-shared-text-with-see-more .visually-hidden',
        '.pv-shared-text-with-see-more span[aria-hidden="true"]',
        '.display-flex .t-14',
        '.about-section .text-body-medium',
        '.summary-text',
        '.about-content',
        '[data-section="about"] .text-body-medium',
        '.pv-shared-text-with-see-more .visually-hidden'
      ];
      data.about = extractFromMultipleSelectors(aboutSelectors,
        selector => getText(document, selector));

      // Experience - Enhanced extraction with multiple strategies
      const experienceContainers = [
        '#experience ~ .pvs-list__container',
        '#experience ~ * .pvs-list__container',
        '.experience-section .pvs-list__container',
        '[data-section="experience"] .pvs-list__container',
        '.experience-container',
        '.work-experience-section'
      ];

      const experienceItems = extractListItems(experienceContainers, '.pvs-entity');
      
      experienceItems.forEach(item => {
        const titleSelectors = [
          '.t-14.t-bold span[aria-hidden="true"]',
          '.job-title',
          '.experience-title',
          '.t-bold span[aria-hidden="true"]',
          '.entity-title'
        ];
        
        const companySelectors = [
          '.t-14.t-normal span[aria-hidden="true"]',
          '.company-name',
          '.experience-company',
          '.entity-subtitle'
        ];
        
        const durationSelectors = [
          '.t-12.t-normal.t-black--light span[aria-hidden="true"]',
          '.job-duration',
          '.experience-duration',
          '.entity-date'
        ];

        const title = extractFromMultipleSelectors(titleSelectors, selector => getText(item, selector));
        const company = extractFromMultipleSelectors(companySelectors, selector => getText(item, selector));
        const duration = extractFromMultipleSelectors(durationSelectors, selector => getText(item, selector));
        
        if (title || company) {
          data.experience.push({
            title: title,
            company: company,
            duration: duration
          });
        }
      });

      // Education - Enhanced extraction
      const educationContainers = [
        '#education ~ .pvs-list__container',
        '#education ~ * .pvs-list__container',
        '.education-section .pvs-list__container',
        '[data-section="education"] .pvs-list__container',
        '.education-container'
      ];

      const educationItems = extractListItems(educationContainers, '.pvs-entity');
      
      educationItems.forEach(item => {
        const schoolSelectors = [
          '.t-14.t-normal span[aria-hidden="true"]',
          '.school-name',
          '.education-school',
          '.entity-subtitle'
        ];
        
        const degreeSelectors = [
          '.t-14.t-bold span[aria-hidden="true"]',
          '.degree-name',
          '.education-degree',
          '.entity-title'
        ];
        
        const yearsSelectors = [
          '.t-12.t-normal.t-black--light span[aria-hidden="true"]',
          '.education-years',
          '.entity-date'
        ];

        const school = extractFromMultipleSelectors(schoolSelectors, selector => getText(item, selector));
        const degree = extractFromMultipleSelectors(degreeSelectors, selector => getText(item, selector));
        const years = extractFromMultipleSelectors(yearsSelectors, selector => getText(item, selector));
        
        if (school || degree) {
          data.education.push({
            degree: degree,
            school: school,
            years: years
          });
        }
      });

      // Skills - Enhanced extraction with multiple strategies
      const skillsContainers = [
        '#skills ~ .pvs-list__container',
        '#skills ~ * .pvs-list__container',
        '.skills-section .pvs-list__container',
        '[data-section="skills"] .pvs-list__container',
        '.skills-container'
      ];

      const skillsItems = extractListItems(skillsContainers, '.pvs-entity');
      
      skillsItems.forEach(item => {
        const skillSelectors = [
          'span[aria-hidden="true"]',
          '.skill-name',
          '.entity-title',
          '.t-bold span[aria-hidden="true"]'
        ];
        
        const skillName = extractFromMultipleSelectors(skillSelectors, selector => getText(item, selector));
        if (skillName && !data.skills.includes(skillName) && skillName.length < 50) {
          data.skills.push(skillName);
        }
      });

      // Certifications - Enhanced extraction
      const certificationContainers = [
        '#certifications ~ .pvs-list__container',
        '[data-section="certifications"] .pvs-list__container',
        '.certifications-container'
      ];

      const certificationItems = extractListItems(certificationContainers, '.pvs-entity');
      
      certificationItems.forEach(item => {
        const nameSelectors = ['.t-bold span[aria-hidden="true"]', '.certification-name'];
        const issuerSelectors = ['.t-14.t-normal span[aria-hidden="true"]', '.certification-issuer'];
        const dateSelectors = ['.t-14.t-normal.t-black--light span[aria-hidden="true"]', '.certification-date'];

        const name = extractFromMultipleSelectors(nameSelectors, selector => getText(item, selector));
        const issuer = extractFromMultipleSelectors(issuerSelectors, selector => getText(item, selector));
        const issuedDate = extractFromMultipleSelectors(dateSelectors, selector => getText(item, selector));

        if (name) {
          data.certifications.push({
            name: name,
            issuer: issuer,
            issuedDate: issuedDate
          });
        }
      });

      // Publications - Enhanced extraction
      const publicationContainers = [
        '#publications ~ .pvs-list__container',
        '[data-section="publications"] .pvs-list__container',
        '.publications-container'
      ];

      const publicationItems = extractListItems(publicationContainers, '.pvs-entity');
      
      publicationItems.forEach(item => {
        const titleSelectors = ['.t-bold span[aria-hidden="true"]', '.publication-title'];
        const publisherSelectors = ['.t-14.t-normal span[aria-hidden="true"]', '.publication-publisher'];
        const dateSelectors = ['.t-14.t-normal.t-black--light span[aria-hidden="true"]', '.publication-date'];

        const title = extractFromMultipleSelectors(titleSelectors, selector => getText(item, selector));
        const publisher = extractFromMultipleSelectors(publisherSelectors, selector => getText(item, selector));
        const date = extractFromMultipleSelectors(dateSelectors, selector => getText(item, selector));

        if (title) {
          data.publications.push({
            title: title,
            publisher: publisher,
            date: date
          });
        }
      });

      // Honors and Awards - Enhanced extraction
      const honorsContainers = [
        '#honors_and_awards ~ .pvs-list__container',
        '[data-section="honors_and_awards"] .pvs-list__container',
        '.honors-container'
      ];

      const honorsItems = extractListItems(honorsContainers, '.pvs-entity');
      
      honorsItems.forEach(item => {
        const titleSelectors = ['.t-bold span[aria-hidden="true"]', '.honor-title'];
        const issuerSelectors = ['.t-14.t-normal span[aria-hidden="true"]', '.honor-issuer'];
        const dateSelectors = ['.t-14.t-normal.t-black--light span[aria-hidden="true"]', '.honor-date'];

        const title = extractFromMultipleSelectors(titleSelectors, selector => getText(item, selector));
        const issuer = extractFromMultipleSelectors(issuerSelectors, selector => getText(item, selector));
        const date = extractFromMultipleSelectors(dateSelectors, selector => getText(item, selector));

        if (title) {
          data.honors.push({
            title: title,
            issuer: issuer,
            date: date
          });
        }
      });

      // Languages - Enhanced extraction
      const languageContainers = [
        '#languages ~ .pvs-list__container',
        '[data-section="languages"] .pvs-list__container',
        '.languages-container'
      ];

      const languageItems = extractListItems(languageContainers, '.pvs-entity');
      
      languageItems.forEach(item => {
        const languageSelectors = ['.t-bold span[aria-hidden="true"]', '.language-name'];
        const proficiencySelectors = ['.t-14.t-normal span[aria-hidden="true"]', '.language-proficiency'];

        const language = extractFromMultipleSelectors(languageSelectors, selector => getText(item, selector));
        const proficiency = extractFromMultipleSelectors(proficiencySelectors, selector => getText(item, selector));

        if (language) {
          data.languages.push({
            language: language,
            proficiency: proficiency
          });
        }
      });

      // Volunteering - Enhanced extraction
      const volunteeringContainers = [
        '#volunteering_experience ~ .pvs-list__container',
        '[data-section="volunteering_experience"] .pvs-list__container',
        '.volunteering-container'
      ];

      const volunteeringItems = extractListItems(volunteeringContainers, '.pvs-entity');
      
      volunteeringItems.forEach(item => {
        const roleSelectors = ['.t-bold span[aria-hidden="true"]', '.volunteer-role'];
        const organizationSelectors = ['.t-14.t-normal span[aria-hidden="true"]', '.volunteer-organization'];
        const durationSelectors = ['.t-14.t-normal.t-black--light span[aria-hidden="true"]', '.volunteer-duration'];

        const role = extractFromMultipleSelectors(roleSelectors, selector => getText(item, selector));
        const organization = extractFromMultipleSelectors(organizationSelectors, selector => getText(item, selector));
        const duration = extractFromMultipleSelectors(durationSelectors, selector => getText(item, selector));

        if (role || organization) {
          data.volunteering.push({
            role: role,
            organization: organization,
            duration: duration
          });
        }
      });

      // Projects - New extraction
      const projectContainers = [
        '#projects ~ .pvs-list__container',
        '[data-section="projects"] .pvs-list__container',
        '.projects-container'
      ];

      const projectItems = extractListItems(projectContainers, '.pvs-entity');
      
      projectItems.forEach(item => {
        const titleSelectors = ['.t-bold span[aria-hidden="true"]', '.project-title'];
        const descriptionSelectors = ['.t-14.t-normal span[aria-hidden="true"]', '.project-description'];
        const dateSelectors = ['.t-14.t-normal.t-black--light span[aria-hidden="true"]', '.project-date'];

        const title = extractFromMultipleSelectors(titleSelectors, selector => getText(item, selector));
        const description = extractFromMultipleSelectors(descriptionSelectors, selector => getText(item, selector));
        const date = extractFromMultipleSelectors(dateSelectors, selector => getText(item, selector));

        if (title) {
          data.projects.push({
            title: title,
            description: description,
            date: date
          });
        }
      });

      // Courses - New extraction
      const courseContainers = [
        '#courses ~ .pvs-list__container',
        '[data-section="courses"] .pvs-list__container',
        '.courses-container'
      ];

      const courseItems = extractListItems(courseContainers, '.pvs-entity');
      
      courseItems.forEach(item => {
        const nameSelectors = ['.t-bold span[aria-hidden="true"]', '.course-name'];
        const institutionSelectors = ['.t-14.t-normal span[aria-hidden="true"]', '.course-institution'];
        const dateSelectors = ['.t-14.t-normal.t-black--light span[aria-hidden="true"]', '.course-date'];

        const name = extractFromMultipleSelectors(nameSelectors, selector => getText(item, selector));
        const institution = extractFromMultipleSelectors(institutionSelectors, selector => getText(item, selector));
        const date = extractFromMultipleSelectors(dateSelectors, selector => getText(item, selector));

        if (name) {
          data.courses.push({
            name: name,
            institution: institution,
            date: date
          });
        }
      });

      // Contact Info - New extraction
      const contactSelectors = [
        '.contact-info',
        '.contact-details',
        '.profile-contact'
      ];

      for (const selector of contactSelectors) {
        const contactElement = document.querySelector(selector);
        if (contactElement) {
          const email = getText(contactElement, '.email') || getText(contactElement, '[data-section="email"]');
          const phone = getText(contactElement, '.phone') || getText(contactElement, '[data-section="phone"]');
          const website = getAttribute(contactElement, '.website', 'href') || getAttribute(contactElement, '[data-section="website"]', 'href');
          
          if (email || phone || website) {
            data.contactInfo = { email, phone, website };
            break;
          }
        }
      }

      // Recommendations - New extraction
      const recommendationContainers = [
        '#recommendations ~ .pvs-list__container',
        '[data-section="recommendations"] .pvs-list__container',
        '.recommendations-container'
      ];

      const recommendationItems = extractListItems(recommendationContainers, '.pvs-entity');
      
      recommendationItems.forEach(item => {
        const recommenderSelectors = ['.t-bold span[aria-hidden="true"]', '.recommender-name'];
        const relationshipSelectors = ['.t-14.t-normal span[aria-hidden="true"]', '.recommendation-relationship'];
        const textSelectors = ['.t-14.t-normal.t-black--light span[aria-hidden="true"]', '.recommendation-text'];

        const recommender = extractFromMultipleSelectors(recommenderSelectors, selector => getText(item, selector));
        const relationship = extractFromMultipleSelectors(relationshipSelectors, selector => getText(item, selector));
        const text = extractFromMultipleSelectors(textSelectors, selector => getText(item, selector));

        if (recommender) {
          data.recommendations.push({
            recommender: recommender,
            relationship: relationship,
            text: text
          });
        }
      });

      // Interests - New extraction
      const interestContainers = [
        '#interests ~ .pvs-list__container',
        '[data-section="interests"] .pvs-list__container',
        '.interests-container'
      ];

      const interestItems = extractListItems(interestContainers, '.pvs-entity');
      
      interestItems.forEach(item => {
        const interestName = getText(item, 'span[aria-hidden="true"]') || getText(item, '.interest-name');
        if (interestName && !data.interests.includes(interestName)) {
          data.interests.push(interestName);
        }
      });

      // Compile profile summary
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
    context = await createContext(browser, liAt);
    const page = await context.newPage();
    
    // Intercept and block unnecessary resources
    await page.route('**/*', (route) => {
      const resourceType = route.request().resourceType();
      if (['image', 'media', 'font', 'stylesheet'].includes(resourceType)) {
        route.abort();
      } else {
        route.continue();
      }
    });
    
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
 * Enhanced LinkedIn profile scraper with modern 2024/2025 techniques
 * Captures comprehensive profile information with multiple fallback strategies
 *
 * @param {string} url - LinkedIn profile URL
 * @param {{liAt?: string, timeoutMs?: number, retries?: number}} [options]
 * @returns {Promise<object>} structured profile data with summary
 */
export async function fetchProfileStructured(url, options = {}) {
  const { liAt, timeoutMs = CONFIG.linkedin.structuredTimeoutMs, retries = 3 } = options;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    const browser = await launchBrowser({ timeout: timeoutMs });
    let context;
    
    try {
      context = await createContext(browser, liAt);
      const page = await context.newPage();
      
      // Enhanced resource blocking for better performance
      await page.route('**/*', (route) => {
        const resourceType = route.request().resourceType();
        const url = route.request().url();
        
        // Block analytics, ads, and unnecessary resources
        if (['image', 'media', 'font', 'stylesheet'].includes(resourceType) ||
            url.includes('google-analytics') ||
            url.includes('doubleclick') ||
            url.includes('facebook') ||
            url.includes('googletagmanager')) {
          route.abort();
        } else {
          route.continue();
        }
      });
      
      // Enhanced navigation with better error handling
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: timeoutMs
      });

      const currentUrl = page.url();
      if (currentUrl.includes('/login') || currentUrl.includes('/checkpoint/challenge')) {
        return { success: false, error: 'INVALID_COOKIE', url, scrapedAt: new Date().toISOString() };
      }

      // Enhanced waiting strategy
      await page.waitForTimeout(2000);
      
      // Scroll strategy to load lazy content
      await page.evaluate(async () => {
        const scrollHeight = document.body.scrollHeight;
        const viewportHeight = window.innerHeight;
        const scrollSteps = Math.ceil(scrollHeight / viewportHeight);
        
        for (let i = 0; i < Math.min(scrollSteps, 5); i++) {
          window.scrollTo(0, (i + 1) * viewportHeight);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Scroll back to top
        window.scrollTo(0, 0);
        await new Promise(resolve => setTimeout(resolve, 500));
      });
      
      // Extract comprehensive profile data
      const profileData = await extractProfileData(page);
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
      
      // Enhanced error handling
      if (err.message.includes('net::ERR_TOO_MANY_REDIRECTS')) {
        return { success: false, error: 'REDIRECT_LOOP', url, scrapedAt: new Date().toISOString() };
      }
      
      if (err.message.includes('net::ERR_CONNECTION_TIMED_OUT')) {
        return { success: false, error: 'CONNECTION_TIMEOUT', url, scrapedAt: new Date().toISOString() };
      }
      
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
      
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, 2000 * Math.pow(2, attempt - 1)));
      
    } finally {
      if (context) await context.close().catch(() => {});
      await browser.close().catch(() => {});
    }
  }
}

/**
 * Enhanced data quality calculation with more comprehensive metrics
 */
function calculateDataQuality(data) {
  let score = 0;
  let maxScore = 20; // Increased from 12 to 20 for more comprehensive scoring
  
  // Basic profile information (5 points)
  if (data.name) score++;
  if (data.headline) score++;
  if (data.location) score++;
  if (data.connections) score++;
  if (data.profilePictureUrl) score++;
  
  // Detailed information (5 points)
  if (data.about && data.about.length > 50) score++;
  if (data.experience && data.experience.length > 0) score++;
  if (data.education && data.education.length > 0) score++;
  if (data.skills && data.skills.length > 3) score++;
  if (data.certifications && data.certifications.length > 0) score++;
  
  // Additional sections (5 points)
  if (data.publications && data.publications.length > 0) score++;
  if (data.languages && data.languages.length > 0) score++;
  if (data.volunteering && data.volunteering.length > 0) score++;
  if (data.honors && data.honors.length > 0) score++;
  if (data.projects && data.projects.length > 0) score++;
  
  // Extended information (5 points)
  if (data.courses && data.courses.length > 0) score++;
  if (data.recommendations && data.recommendations.length > 0) score++;
  if (data.interests && data.interests.length > 0) score++;
  if (data.contactInfo && Object.values(data.contactInfo).some(v => v)) score++;
  if (data.bannerUrl) score++;
  
  return {
    score,
    maxScore,
    percentage: Math.round((score / maxScore) * 100),
    quality: score >= 15 ? 'excellent' : score >= 10 ? 'high' : score >= 6 ? 'medium' : 'low',
    details: {
      basicInfo: [data.name, data.headline, data.location, data.connections, data.profilePictureUrl].filter(Boolean).length,
      detailedInfo: [data.about, data.experience.length, data.education.length, data.skills.length, data.certifications.length].filter(v => v > 0).length,
      additionalSections: [data.publications.length, data.languages.length, data.volunteering.length, data.honors.length, data.projects.length].filter(v => v > 0).length,
      extendedInfo: [data.courses.length, data.recommendations.length, data.interests.length, data.contactInfo, data.bannerUrl].filter(v => v && (typeof v === 'string' || v.length > 0 || Object.values(v).some(val => val))).length
    }
  };
}

/**
 * Enhanced login function with better error detection and handling
 */
export async function loginAndGetLiAt(email, password, timeoutMs = CONFIG.linkedin.timeoutMs) {
  const browser = await launchBrowser({ timeout: timeoutMs });
  const context = await createContext(browser);
  const page = await context.newPage();
  
  try {
    await page.goto('https://www.linkedin.com/login', {
      waitUntil: 'networkidle',
      timeout: timeoutMs
    });
    
    // Enhanced form filling with better selectors
    await page.fill('input[name="session_key"]', email);
    await page.fill('input[name="session_password"]', password);
    
    await page.click('button[type="submit"]');

    try {
      await page.waitForNavigation({ waitUntil: 'networkidle', timeout: timeoutMs });
    } catch (e) {
      logger.warn(`Navigation failed after login attempt, which may be expected. Checking result...`);
    }

    const cookies = await context.cookies();
    const liAtCookie = cookies.find(c => c.name === 'li_at');

    if (liAtCookie) {
      return liAtCookie.value;
    }

    // Enhanced error detection
    const errorSelectors = [
      '#error-for-password',
      '#error-for-username', 
      '.alert-error',
      '.error-message',
      '[data-test-id="error-message"]'
    ];
    
    for (const selector of errorSelectors) {
      try {
        const errorElement = await page.waitForSelector(selector, { timeout: 3000 });
        if (errorElement) {
          const errorMessage = await errorElement.textContent();
          throw new Error(`Credenciais inválidas: ${errorMessage.trim()}`);
        }
      } catch (e) {
        // Continue checking other selectors
      }
    }

    // Enhanced security challenge detection
    const pageTitle = await page.title();
    const pageContent = await page.content();
    
    if (pageTitle.includes('Security Verification') || pageTitle.includes('Verificação de segurança')) {
      throw new Error('O LinkedIn está exigindo uma verificação de segurança (CAPTCHA). Tente fazer login manualmente no navegador para resolver.');
    }

    if (pageContent.includes('checkpoint/challenge')) {
      throw new Error('O LinkedIn apresentou um desafio de segurança. Tente fazer login manualmente no navegador.');
    }

    if (pageContent.includes('unusual activity') || pageContent.includes('atividade incomum')) {
      throw new Error('O LinkedIn detectou atividade incomum. Tente fazer login manualmente no navegador.');
    }

    throw new Error('Falha no login. O cookie li_at não foi encontrado e nenhuma mensagem de erro específica foi detectada.');

  } catch (err) {
    logger.error('Erro detalhado no loginAndGetLiAt:', err);
    throw err;
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

/**
 * Enhanced LinkedIn Scraper class with modern capabilities
 */
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
      skills: Array.isArray(data.skills) ? data.skills : [],
      // Enhanced return with more comprehensive data
      experience: data.experience || [],
      education: data.education || [],
      certifications: data.certifications || [],
      publications: data.publications || [],
      languages: data.languages || [],
      volunteering: data.volunteering || [],
      projects: data.projects || [],
      courses: data.courses || [],
      recommendations: data.recommendations || [],
      interests: data.interests || [],
      contactInfo: data.contactInfo || {},
      dataQuality: result.dataQuality
    };
  }
}

export default LinkedInScraper;
