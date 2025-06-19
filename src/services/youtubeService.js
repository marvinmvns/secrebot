import { YoutubeTranscript } from 'youtube-transcript';
import Utils from '../utils/index.js';

async function fetchTranscript(url) {
  const id = Utils.extractYouTubeId(url);
  if (!id) {
    throw new Error('ID de vídeo não encontrado');
  }
  const items = await YoutubeTranscript.fetchTranscript(id);
  return items.map(i => i.text).join(' ');
}

export default { fetchTranscript };
