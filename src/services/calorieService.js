import { CONFIG } from '../config/index.js';
import logger from '../utils/logger.js';

class CalorieService {
  static async getCalories(food) {
    const url = `${CONFIG.calorieApi.url}${encodeURIComponent(food)}`;
    try {
      const response = await fetch(url, {
        headers: CONFIG.calorieApi.key ? { 'X-Api-Key': CONFIG.calorieApi.key } : {}
      });
      if (!response.ok) {
        logger.warn(`⚠️ Erro na API de calorias: ${response.status}`);
        return null;
      }
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        return data[0].calories;
      }
    } catch (err) {
      logger.error('❌ Erro ao consultar API de calorias', err);
    }
    return null;
  }
}

export default CalorieService;
