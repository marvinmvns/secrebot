import { YoutubeTranscript } from 'youtube-transcript';

class YoutubeService {
  constructor(llmService, bot) {
    this.llmService = llmService;
    this.bot = bot;
  }

  async summarizeVideo(contactId, url) {
    const transcript = await YoutubeTranscript.fetchTranscript(url).then(arr => arr.map(t => t.text).join(' ')).catch(() => '');
    if (!transcript) return null;
    const text = transcript.slice(0, 8000);
    const prompt = `Resuma em português por tópicos o vídeo a seguir, mantendo todas as informações relevantes:\n\n${text}`;
    const summary = await this.llmService.getAssistantResponse(contactId, prompt);
    return summary;
  }

  async sendVideoSummary(contactId, url) {
    const summary = await this.summarizeVideo(contactId, url);
    if (summary) {
      await this.bot.sendResponse(contactId, summary);
    } else {
      await this.bot.sendResponse(contactId, '❌ Não foi possível obter a transcrição.');
    }
  }

}

export default YoutubeService;
