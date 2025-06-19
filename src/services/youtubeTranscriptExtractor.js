import axios from 'axios';
import puppeteer from 'puppeteer';
import { fetchTranscript, InMemoryCache, FsCache } from 'youtube-transcript-plus';

class YouTubeTranscriptExtractor {
  constructor(options = {}) {
    this.options = {
      maxRetries: 3,
      retryDelay: 1000,
      useProxy: false,
      proxies: [],
      cacheEnabled: true,
      cacheTTL: 86400000,
      cacheDir: './transcript-cache',
      headless: true,
      ...options
    };

    if (this.options.cacheEnabled) {
      this.cache = new FsCache(this.options.cacheDir, this.options.cacheTTL);
    }

    this.headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    };

    this.extractionMethods = [
      { name: 'youtube-transcript-plus', func: this.extractWithLibrary.bind(this) },
      { name: 'innertube-api', func: this.extractViaInnerTube.bind(this) },
      { name: 'direct-scraping', func: this.extractDirectScraping.bind(this) },
      { name: 'puppeteer', func: this.extractWithPuppeteer.bind(this) }
    ];
  }

  async extract(input) {
    try {
      const videoId = this.extractVideoId(input);
      if (!videoId) {
        throw new Error('URL do YouTube inválida ou ID do vídeo não encontrado');
      }

      console.log(`Extraindo transcrição para vídeo: ${videoId}`);

      if (this.options.cacheEnabled) {
        const cached = await this.checkCache(videoId);
        if (cached) {
          console.log('Transcrição encontrada no cache');
          return cached;
        }
      }

      let lastError;
      for (const method of this.extractionMethods) {
        console.log(`Tentando método: ${method.name}`);
        for (let attempt = 1; attempt <= this.options.maxRetries; attempt++) {
          try {
            const result = await method.func(videoId);
            if (result && result.length > 0) {
              console.log(`Sucesso com método: ${method.name}`);
              if (this.options.cacheEnabled) {
                await this.saveToCache(videoId, result);
              }
              return this.formatOutput(result, videoId, method.name);
            }
          } catch (error) {
            lastError = error;
            console.warn(`${method.name} falhou (tentativa ${attempt}/${this.options.maxRetries}):`, error.message);
            if (attempt < this.options.maxRetries) {
              const delay = this.options.retryDelay * Math.pow(2, attempt - 1);
              await this.sleep(delay);
            }
          }
        }
      }

      throw new Error(`Todos os métodos falharam. Último erro: ${lastError?.message}`);
    } catch (error) {
      console.error('Erro na extração:', error);
      throw error;
    }
  }

  extractVideoId(input) {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/
    ];
    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match) {
        return match[1];
      }
    }
    return null;
  }

  async extractWithLibrary(videoId) {
    try {
      const options = {};
      if (this.options.useProxy && this.options.proxies.length > 0) {
        const proxy = this.getRandomProxy();
        options.videoFetch = async ({ url }) => {
          return axios.get(url, {
            proxy: this.parseProxy(proxy),
            headers: this.headers
          });
        };
      }
      const transcript = await fetchTranscript(videoId, options);
      return transcript.map(item => ({
        text: item.text,
        start: item.offset,
        duration: item.duration
      }));
    } catch (error) {
      if (error.message.includes('disabled')) {
        throw new Error('Transcrições desabilitadas para este vídeo');
      }
      throw error;
    }
  }

  async extractViaInnerTube(videoId) {
    try {
      const pageUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const pageResponse = await axios.get(pageUrl, {
        headers: this.headers,
        ...(this.options.useProxy && { proxy: this.parseProxy(this.getRandomProxy()) })
      });
      const apiKeyMatch = pageResponse.data.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
      if (!apiKeyMatch) {
        throw new Error('Não foi possível extrair API key do InnerTube');
      }
      const apiKey = apiKeyMatch[1];
      const contextMatch = pageResponse.data.match(/"INNERTUBE_CONTEXT":\s*({[^}]+})/);
      const context = contextMatch ? JSON.parse(contextMatch[1]) : {
        client: { clientName: 'WEB', clientVersion: '2.20240619.00.00' }
      };
      const innerTubeResponse = await axios.post(
        `https://www.youtube.com/youtubei/v1/player?key=${apiKey}`,
        {
          context: context,
          videoId: videoId
        },
        {
          headers: { ...this.headers, 'Content-Type': 'application/json' },
          ...(this.options.useProxy && { proxy: this.parseProxy(this.getRandomProxy()) })
        }
      );
      const captions = innerTubeResponse.data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (!captions || captions.length === 0) {
        throw new Error('Nenhuma legenda disponível via InnerTube');
      }
      const captionUrl = captions[0].baseUrl;
      const transcriptResponse = await axios.get(captionUrl, {
        headers: this.headers,
        ...(this.options.useProxy && { proxy: this.parseProxy(this.getRandomProxy()) })
      });
      return this.parseTranscriptXML(transcriptResponse.data);
    } catch (error) {
      throw new Error(`InnerTube API falhou: ${error.message}`);
    }
  }

  async extractDirectScraping(videoId) {
    try {
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      const response = await axios.get(url, {
        headers: this.headers,
        ...(this.options.useProxy && { proxy: this.parseProxy(this.getRandomProxy()) })
      });
      const ytInitialDataMatch = response.data.match(/window\["ytInitialData"\]\s*=\s*({.+?});/);
      if (!ytInitialDataMatch) {
        throw new Error('Não foi possível extrair ytInitialData');
      }
      const ytInitialData = JSON.parse(ytInitialDataMatch[1]);
      const engagementPanels = ytInitialData?.contents?.twoColumnWatchNextResults?.results?.results?.contents;
      for (const panel of engagementPanels || []) {
        if (panel?.videoPrimaryInfoRenderer?.videoActions?.menuRenderer?.topLevelButtons) {
          const buttons = panel.videoPrimaryInfoRenderer.videoActions.menuRenderer.topLevelButtons;
          for (const button of buttons) {
            if (button?.buttonRenderer?.serviceEndpoint?.signalServiceEndpoint?.actions) {
              const actions = button.buttonRenderer.serviceEndpoint.signalServiceEndpoint.actions;
              for (const action of actions) {
                if (action?.openTranscriptAction) {
                  const transcriptData = action.openTranscriptAction;
                  return this.processTranscriptData(transcriptData);
                }
              }
            }
          }
        }
      }
      throw new Error('Dados de transcrição não encontrados no HTML');
    } catch (error) {
      throw new Error(`Scraping direto falhou: ${error.message}`);
    }
  }

  async extractWithPuppeteer(videoId) {
    let browser;
    try {
      const launchOptions = {
        headless: this.options.headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      };
      if (this.options.useProxy && this.options.proxies.length > 0) {
        const proxy = this.getRandomProxy();
        launchOptions.args.push(`--proxy-server=${proxy}`);
      }
      browser = await puppeteer.launch(launchOptions);
      const page = await browser.newPage();
      await page.setUserAgent(this.headers['User-Agent']);
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      await page.goto(url, { waitUntil: 'networkidle2' });
      try { await page.click('button[aria-label*="Accept"]', { timeout: 3000 }); } catch {}
      await page.waitForSelector('video', { timeout: 10000 });
      await page.click('button[aria-label*="More actions"]');
      await this.sleep(1000);
      const transcriptButton = await page.$x("//yt-formatted-string[contains(text(),'Show transcript')]");
      if (!transcriptButton.length) {
        throw new Error('Botão de transcrição não encontrado');
      }
      await transcriptButton[0].click();
      await page.waitForSelector('ytd-transcript-segment-list-renderer', { timeout: 5000 });
      const transcript = await page.evaluate(() => {
        const segments = document.querySelectorAll('.ytd-transcript-segment-renderer');
        return Array.from(segments).map(segment => {
          const textElement = segment.querySelector('.segment-text');
          const timestampElement = segment.querySelector('.segment-timestamp');
          const timestampText = timestampElement?.textContent || '0:00';
          const parts = timestampText.split(':').map(Number);
          const seconds = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
          return { text: textElement?.textContent?.trim() || '', start: seconds, duration: 0 };
        });
      });
      return transcript;
    } catch (error) {
      throw new Error(`Puppeteer falhou: ${error.message}`);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  parseTranscriptXML(xml) {
    const regex = /<text start="([\d.]+)" dur="([\d.]+)"[^>]*>([^<]*)<\/text>/g;
    const transcript = [];
    let match;
    while ((match = regex.exec(xml)) !== null) {
      transcript.push({
        text: this.decodeHTMLEntities(match[3]),
        start: parseFloat(match[1]),
        duration: parseFloat(match[2])
      });
    }
    return transcript;
  }

  decodeHTMLEntities(text) {
    const entities = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&#x2F;': '/',
      '&#92;': '\\',
      '&#96;': '`'
    };
    return text.replace(/&[#\w]+;/g, entity => entities[entity] || entity);
  }

  getRandomProxy() {
    if (!this.options.proxies || this.options.proxies.length === 0) {
      return null;
    }
    return this.options.proxies[Math.floor(Math.random() * this.options.proxies.length)];
  }

  parseProxy(proxyString) {
    if (!proxyString) return null;
    const [host, port] = proxyString.split(':');
    return { host: host, port: parseInt(port) };
  }

  formatOutput(transcript, videoId, method) {
    return {
      videoId: videoId,
      extractionMethod: method,
      timestamp: new Date().toISOString(),
      transcriptData: transcript,
      metadata: {
        totalSegments: transcript.length,
        totalDuration: transcript.reduce((acc, seg) => acc + (seg.duration || 0), 0),
        language: 'auto-detected'
      }
    };
  }

  async checkCache(videoId) {
    try {
      if (!this.cache) return null;
      const cacheKey = `transcript_${videoId}`;
      return await this.cache.get(cacheKey);
    } catch {
      return null;
    }
  }

  async saveToCache(videoId, data) {
    try {
      if (!this.cache) return;
      const cacheKey = `transcript_${videoId}`;
      await this.cache.set(cacheKey, data);
    } catch (error) {
      console.warn('Erro ao salvar no cache:', error);
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default YouTubeTranscriptExtractor;

if (import.meta.url === `file://${process.argv[1]}`) {
  async function exemploDeUso() {
    const extractor = new YouTubeTranscriptExtractor({ maxRetries: 3, cacheEnabled: true, headless: true });
    const urls = [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
      'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
      'dQw4w9WgXcQ'
    ];

    console.log('=== YouTube Transcript Extractor - Demonstração ===\n');

    for (const url of urls) {
      console.log(`\nTestando URL: ${url}`);
      console.log('-'.repeat(50));
      try {
        const result = await extractor.extract(url);
        console.log('✓ Sucesso!');
        console.log(`  Método usado: ${result.extractionMethod}`);
        console.log(`  Total de segmentos: ${result.metadata.totalSegments}`);
        console.log('  Primeiros 3 segmentos:');
        result.transcriptData.slice(0, 3).forEach((seg, i) => {
          console.log(`    ${i + 1}. [${seg.start}s] ${seg.text.substring(0, 50)}...`);
        });
        const fs = await import('fs');
        const filename = `transcript_${result.videoId}_${Date.now()}.json`;
        fs.writeFileSync(filename, JSON.stringify(result, null, 2));
        console.log(`  Salvo em: ${filename}`);
      } catch (error) {
        console.log(`✗ Erro: ${error.message}`);
      }
    }
  }
  exemploDeUso().catch(console.error);
}
