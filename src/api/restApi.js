import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import expressLayouts from 'express-ejs-layouts';
import methodOverride from 'method-override';
import { ObjectId } from 'mongodb';
import Utils from '../utils/index.js';
import { CONFIG, COMMANDS } from '../config/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============ API REST ============
class RestAPI {
  constructor(bot) {
    if (!bot || !bot.getClient) {
        throw new Error('Instância inválida do Bot fornecida para RestAPI.');
    }
    this.bot = bot;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(methodOverride('_method'));
    this.app.use(expressLayouts);
    this.app.set('view engine', 'ejs');
    this.app.set('views', path.join(__dirname, '../views'));
    this.app.use(express.static(path.join(__dirname, '../public')));
    this.app.use((req, res, next) => {
      // Log simples de requisições
      console.log(`🌐 ${req.method} ${req.path} - IP: ${req.ip}`);
      next();
    });
  }

  setupRoutes() {
    // Rota para enviar mensagem via API
    this.app.post('/send-message', async (req, res) => {
      const { phone, message } = req.body;

      if (!phone || !message) {
        return res.status(400).json({
          error: 'Os campos "phone" e "message" são obrigatórios.'
        });
      }

      try {
        const recipientId = Utils.formatRecipientId(phone);
        console.log(`📲 Enviando mensagem via API para: ${recipientId}`);
        await this.bot.getClient().sendMessage(recipientId, message);

        res.json({
          success: true,
          status: '✅ Mensagem enviada!',
          sentTo: phone,
          timestamp: new Date().toISOString()
        });
      } catch (err) {
        console.error('❌ Erro ao enviar mensagem via API:', err);
        res.status(500).json({
          error: '❌ Erro ao enviar mensagem',
          details: err.message || 'Erro desconhecido'
        });
      }
    });

    // Rota de Health Check
    this.app.get('/health', (req, res) => {
      // Poderia adicionar mais verificações aqui (e.g., status do bot, conexão DB)
      res.json({
        status: '✅ Online',
        uptime: process.uptime(), // Uptime do processo Node
        timestamp: new Date().toISOString(),
        message: 'API do Bot está operacional.',
        emoji: '🤖'
      });
    });

    // Rota para um Dashboard simples em HTML
    this.app.get('/dashboard', async (req, res) => {
      const uptimeMinutes = Math.floor(process.uptime() / 60);
      let stats = {
        total: 0,
        pending: 0,
        sent: 0,
        failed: 0,
        upcoming: []
      };
      try {
        if (this.bot.getScheduler) {
          stats = await this.bot.getScheduler().getStats();
        }
      } catch (err) {
        console.error('❌ Erro ao coletar estatísticas para o dashboard:', err);
      }
      const html = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>🤖 WhatsApp Bot Dashboard</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background-color: #f4f7f6; color: #333; }
            .container { max-width: 800px; margin: 20px auto; background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { color: #128C7E; text-align: center; border-bottom: 2px solid #25D366; padding-bottom: 10px; margin-bottom: 20px; }
            h2 { color: #075E54; margin-top: 30px; }
            .status { padding: 15px; background-color: #e8f5e9; border: 1px solid #c8e6c9; border-radius: 5px; margin-bottom: 20px; }
            .status p { margin: 5px 0; }
            .commands-list { list-style: none; padding: 0; }
            .commands-list li { background-color: #f5f5f5; padding: 10px 15px; border-radius: 5px; margin-bottom: 8px; font-family: 'Courier New', Courier, monospace; font-size: 0.95em; }
            footer { text-align: center; margin-top: 30px; font-size: 0.9em; color: #777; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🤖 WhatsApp Bot Dashboard</h1>
            <div class="status">
              <h2>✅ Status</h2>
              <p><strong>API:</strong> Online</p>
              <p><strong>Bot Uptime:</strong> ${uptimeMinutes} minutos</p>
              <p><strong>Timestamp:</strong> ${new Date().toLocaleString('pt-BR')}</p>
            </div>
            <h2>📊 Estatísticas de Agendamentos</h2>
            <p>Total: ${stats.total}</p>
            <p>Pendentes: ${stats.pending}</p>
            <p>Enviados: ${stats.sent}</p>
            <p>Falhos: ${stats.failed}</p>
            <h3>Próximos 5 Agendamentos</h3>
            <ul class="commands-list">
              ${stats.upcoming.map(item =>
                `<li>${new Date(item.scheduledTime).toLocaleString('pt-BR')} - ${item.message}</li>`
              ).join('') || '<li>Nenhum agendamento</li>'}
            </ul>

            <h2>📋 Comandos Disponíveis no Bot</h2>
            <ul class="commands-list">
              ${Object.entries(COMMANDS).map(([key, cmd]) =>
                `<li><strong>${key}:</strong> ${cmd}</li>`
              ).join('')}
            </ul>
            <footer>
              <p>WhatsApp Bot Assistant v2.0</p>
            </footer>
          </div>
        </body>
        </html>
      `;
      res.send(html);
    });

    // ===== Scheduler UI Routes =====
    const schedCollection = this.bot.getScheduler().schedCollection;

    this.app.get('/', async (req, res) => {
      const messages = await schedCollection.find({}).toArray();
      res.render('index', { messages });
    });

    this.app.get('/messages/new', (req, res) => {
      res.render('new', { message: null });
    });

    this.app.post('/messages', async (req, res) => {
      const { recipient, message, scheduledTime, expiryTime, status } = req.body;
      await schedCollection.insertOne({
        recipient,
        message,
        status: status || 'approved',
        scheduledTime: new Date(scheduledTime),
        expiryTime: new Date(expiryTime),
        sentAt: null,
        attempts: 0,
        lastAttemptAt: null
      });
      res.redirect('/');
    });

    this.app.get('/messages/:id/edit', async (req, res) => {
      const message = await schedCollection.findOne({ _id: new ObjectId(req.params.id) });
      if (!message) return res.status(404).send('Message not found');
      res.render('edit', { message });
    });

    this.app.put('/messages/:id', async (req, res) => {
      const { recipient, message, scheduledTime, expiryTime, status } = req.body;
      await schedCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: {
            recipient,
            message,
            scheduledTime: new Date(scheduledTime),
            expiryTime: new Date(expiryTime),
            sentAt: null,
            status
          } }
      );
      res.redirect('/');
    });

    this.app.delete('/messages/:id', async (req, res) => {
      await schedCollection.deleteOne({ _id: new ObjectId(req.params.id) });
      res.redirect('/');
    });

    this.app.post('/messages/:id/duplicate', async (req, res) => {
      const original = await schedCollection.findOne({ _id: new ObjectId(req.params.id) });
      if (!original) return res.status(404).send('Message not found');
      const newMessage = {
        recipient: original.recipient,
        message: original.message,
        status: 'approved',
        scheduledTime: original.scheduledTime,
        expiryTime: original.expiryTime,
        sentAt: null,
        attempts: 0,
        lastAttemptAt: null
      };
      await schedCollection.insertOne(newMessage);
      res.redirect('/');
    });

    // Rota catch-all para 404
    this.app.use((req, res) => {
        res.status(404).json({ error: '❌ Rota não encontrada' });
    });
  }

  start() {
    this.app.listen(CONFIG.server.port, () => {
      console.log(`🌐 API REST iniciada e ouvindo na porta ${CONFIG.server.port}`);
      console.log(`📊 Dashboard disponível em http://localhost:${CONFIG.server.port}/dashboard (ou IP da máquina)`);
    }).on('error', (err) => {
        console.error(`❌ Falha ao iniciar servidor na porta ${CONFIG.server.port}:`, err);
        process.exit(1);
    });
  }
}

export default RestAPI;

