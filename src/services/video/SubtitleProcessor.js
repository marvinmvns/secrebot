import { parseSync, stringifySync } from 'subtitle';

export default class SubtitleProcessor {
  extractTextFromSubtitles(subtitleContent) {
    try {
      const parsed = parseSync(subtitleContent);
      return parsed
        .filter((node) => node.type === 'cue')
        .map((node) => node.data.text)
        .join(' ')
        .replace(/\n/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    } catch (err) {
      throw new Error(`Erro ao processar legendas: ${err.message}`);
    }
  }

  convertFormat(subtitleContent, fromFormat, toFormat) {
    try {
      const parsed = parseSync(subtitleContent);
      return stringifySync(parsed, { format: toFormat });
    } catch (err) {
      throw new Error(`Erro na convers\u00e3o de ${fromFormat} para ${toFormat}: ${err.message}`);
    }
  }

  filterByTime(subtitleContent, startTime, endTime) {
    try {
      const parsed = parseSync(subtitleContent);
      const filtered = parsed.filter((node) => {
        if (node.type !== 'cue') return false;
        return node.data.start >= startTime && node.data.end <= endTime;
      });
      return stringifySync(filtered);
    } catch (err) {
      throw new Error(`Erro ao filtrar legendas: ${err.message}`);
    }
  }

  getStats(subtitleContent) {
    try {
      const parsed = parseSync(subtitleContent);
      const cues = parsed.filter((node) => node.type === 'cue');
      const totalDuration = cues.reduce((acc, cue) => acc + (cue.data.end - cue.data.start), 0);
      const wordCount = cues.reduce((acc, cue) => acc + cue.data.text.split(/\s+/).length, 0);
      return {
        totalCues: cues.length,
        totalDuration: totalDuration / 1000,
        wordCount,
        averageWordsPerCue: Math.round(wordCount / cues.length),
        wordsPerSecond: Math.round(wordCount / (totalDuration / 1000))
      };
    } catch (err) {
      throw new Error(`Erro ao calcular estat\u00edsticas: ${err.message}`);
    }
  }
}
