import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import expressLayouts from 'express-ejs-layouts';
import methodOverride from 'method-override';
import { ObjectId } from 'mongodb';
import multer from 'multer';
import GoogleCalendarService from '../services/googleCalendarService.js';
import Utils from '../utils/index.js';
import { CONFIG, COMMANDS, updateConfigFromEnv, CONFIG_DESCRIPTIONS, CONFIG_ENV_MAP } from '../config/index.js';
import fs from 'fs';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============ API REST ============
class RestAPI {
  constructor(bot) {
    if (!bot || !bot.getClient) {
        throw new Error('Instância inválida do Bot fornecida para RestAPI.');
    }
    this.bot = bot;
    this.app = express();
    this.googleService = new GoogleCalendarService();
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


    // ===== Scheduler UI Routes =====
    const schedCollection = this.bot.getScheduler().schedCollection;

    // Página inicial com menu de dashboards
    this.app.get('/', (req, res) => {
      res.render('home');
    });

    // Dashboard de agendamentos
    this.app.get('/dashboard', async (req, res) => {
      const [messages, stats] = await Promise.all([
        schedCollection.find({}).toArray(),
        this.bot.getScheduler().getStats()
      ]);
      res.render('index', { messages, stats, commands: COMMANDS });
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

    const upload = multer();

    this.app.post('/import-ics', upload.single('icsfile'), async (req, res) => {
      if (!req.file) return res.redirect('/');
      const buffer = req.file.buffer;
      const { default: ICSImportService } = await import('../services/icsImportService.js');
      const icsService = new ICSImportService(this.bot.getScheduler());
      await icsService.importFromBuffer(buffer, 'web');
      res.redirect('/');
    });

    this.app.get('/auth/google', (req, res) => {
      const url = this.googleService.generateAuthUrl();
      res.redirect(url);
    });

    this.app.get('/oauth2callback', async (req, res) => {
      if (!req.query.code) return res.redirect('/');
      await this.googleService.setCredentials(req.query.code);
      const events = await this.googleService.listEvents();
      const scheduler = this.bot.getScheduler();
      for (const ev of events) {
        await scheduler.insertSchedule({
          recipient: 'web',
          message: ev.summary || 'Evento',
          status: 'approved',
          scheduledTime: new Date(ev.start.dateTime || ev.start.date),
          expiryTime: new Date(ev.end.dateTime || ev.start.date),
          sentAt: null,
          attempts: 0,
          lastAttemptAt: null
        });
      }
      res.redirect('/');
    });

    this.app.get('/config', (req, res) => {
      const envPath = path.join(__dirname, '../../.env');
      const examplePath = path.join(__dirname, '../../.env.example');
      const file = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : fs.readFileSync(examplePath, 'utf-8');
      const parsed = dotenv.parse(file);

      const getNested = (obj, pathStr) =>
        pathStr.split('.').reduce((o, k) => (o || {})[k], obj);

      const env = {};
      const descriptions = {};
      for (const [cfgPath, envVar] of Object.entries(CONFIG_ENV_MAP)) {
        env[envVar] = parsed[envVar] ?? getNested(CONFIG, cfgPath);
        descriptions[envVar] = CONFIG_DESCRIPTIONS[cfgPath];
      }

      res.render('config', { env, descriptions });
    });

    this.app.post('/config', (req, res) => {
      const envPath = path.join(__dirname, '../../.env');
      const lines = Object.entries(req.body).map(([k,v]) => `${k}=${v}`).join('\n');
      fs.writeFileSync(envPath, lines);
      dotenv.config({ path: envPath, override: true });
      updateConfigFromEnv();
      res.send('Configurações salvas. Reiniciando...');
      console.log('♻️  Reiniciando aplicação para aplicar novas configurações');
      setTimeout(() => process.exit(0), 500);
    });

    // Rota catch-all para 404
    this.app.use((req, res) => {
        res.status(404).json({ error: '❌ Rota não encontrada' });
    });
  }

  start() {
    this.app.listen(CONFIG.server.port, () => {
      console.log(`🌐 API REST iniciada e ouvindo na porta ${CONFIG.server.port}`);
      console.log(`📊 Interface disponível em http://localhost:${CONFIG.server.port}/`);
    }).on('error', (err) => {
        console.error(`❌ Falha ao iniciar servidor na porta ${CONFIG.server.port}:`, err);
        process.exit(1);
    });
  }
}

export default RestAPI;

