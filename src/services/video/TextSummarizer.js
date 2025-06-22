import { SummarizerManager } from 'node-summarizer';

export default class TextSummarizer {
  constructor(options = {}) {
    this.defaultSentences = options.defaultSentences || 3;
    this.algorithm = options.algorithm || 'frequency';
  }

  async summarize(text, sentences = this.defaultSentences) {
    if (!text || text.length < 100) {
      throw new Error('Texto muito curto para resumir');
    }
    let summaryText = '';
    switch (this.algorithm) {
      case 'frequency':
        summaryText = await this.summarizeByFrequency(text, sentences);
        break;
      case 'rank':
        summaryText = await this.summarizeByRank(text, sentences);
        break;
      case 'hybrid':
        summaryText = await this.summarizeHybrid(text, sentences);
        break;
      default:
        summaryText = await this.summarizeByFrequency(text, sentences);
    }
    return {
      text: summaryText,
      sentences,
      algorithm: this.algorithm,
      originalLength: text.length,
      summaryLength: summaryText.length
    };
  }

  async summarizeByFrequency(text, sentences) {
    const summarizer = new SummarizerManager(text, sentences);
    const result = summarizer.getSummaryByFrequency();
    return result.summary;
  }

  async summarizeByRank(text, sentences) {
    const summarizer = new SummarizerManager(text, sentences);
    const result = await summarizer.getSummaryByRank();
    return result.summary;
  }

  async summarizeHybrid(text, sentences) {
    const freq = await this.summarizeByFrequency(text, sentences);
    const rank = await this.summarizeByRank(text, sentences);
    const freqSent = freq.split(/[.!?]+/).filter((s) => s.trim());
    const rankSent = rank.split(/[.!?]+/).filter((s) => s.trim());
    const combined = [...new Set([...freqSent, ...rankSent])];
    return combined.slice(0, sentences).join('. ') + '.';
  }

}
