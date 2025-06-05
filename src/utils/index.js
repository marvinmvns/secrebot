import fs from 'fs/promises';
import path from 'path';
import { encode } from 'gpt-3-encoder';
import { CONFIG, COMMANDS } from '../config/index.js'; // Ajustar caminho se necessário

// ============ Classe de Utilitários ============
class Utils {
  static getCurrentDateInGMTMinus3() {
    // Retorna a data e hora atual da máquina, sem ajustes manuais de fuso
    return new Date();
  }

  static toGMTMinus3(date) {
    // Converte a data recebida para o fuso horário local da máquina
    const offsetMinutes = new Date().getTimezoneOffset();
    return new Date(date.getTime() + offsetMinutes * 60 * 1000);

  }

  static countTokens(str) {
    if (typeof str !== 'string') {
      return 0;
    }
    try {
      return encode(str).length;
    } catch {
      return str.split(/\s+/).filter(Boolean).length;
    }
  }

  static limitContext(context, maxTokens = CONFIG.llm.maxTokens) {
    let totalTokens = context.reduce((acc, curr) => acc + Utils.countTokens(curr.content || ''), 0);
    
    // Garante que o contexto original não seja modificado diretamente
    const limitedContext = [...context];

    while (totalTokens > maxTokens && limitedContext.length > 1) {
      // Remove a mensagem mais antiga após a do sistema (índice 1)
      const removed = limitedContext.splice(1, 1)[0]; 
      totalTokens -= Utils.countTokens(removed.content || '');
    }
    
    return limitedContext;
  }

  static extractJSON(text) {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? match[0] : text;
  }

  static formatRecipientId(id) {
    const cleaned = id.replace(/\D/g, '');
    return cleaned.endsWith('@c.us') ? cleaned : `${cleaned}@c.us`;
  }

  static async cleanupFile(filePath) {
    try {
      await fs.unlink(filePath);
    } catch (err) {
      // Ignora erro se o arquivo não existir, mas loga outros erros
      if (err.code !== 'ENOENT') {
          console.error(`Erro ao deletar arquivo ${filePath}:`, err.message);
      }
    }
  }

  static isVoltarCommand(text) {
    const lower = text.toLowerCase().trim();
    return lower === COMMANDS.VOLTAR || lower === '0' || lower === 'voltar';
  }
}

export default Utils;
