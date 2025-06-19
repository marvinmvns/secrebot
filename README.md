# Secrebot

Secrebot é um assistente modular para WhatsApp escrito em **Node.js**. Ele integra serviços de transcrição de áudio via **Whisper**, utiliza modelos LLM locais fornecidos pelo **Ollama** e pode gerar respostas em voz com a API da **ElevenLabs** ou de forma totalmente local via **Piper**. Além do chatbot, inclui agendamento de mensagens, descrição de imagens e uma pequena interface web para gerenciamento.

## Funcionalidades

- **Chatbot e envio de mensagens** alimentados por LLM local.
- **Transcrição de áudio** de mensagens de voz utilizando Whisper.
- **Comandos por áudio**: o modelo interpreta gravações e mapeia para as funções do bot.
- **Descrição de imagens** e estimativa de calorias de fotos recebidas.
- **Agendamento de lembretes** armazenados no MongoDB.
- **Respostas por voz (TTS)** usando ElevenLabs ou Piper.
- **API REST** para integração externa (`/send-message` e `/health`).

## Requisitos

- Node.js **18** ou superior
- MongoDB acessível para armazenar os agendamentos
- [`ffmpeg`](https://ffmpeg.org/) instalado para a transcrição de áudio
- Chave da [ElevenLabs](https://elevenlabs.io/) para TTS (opcional)
- [Ollama](https://ollama.ai/) para executar o modelo local
- [`Playwright`](https://playwright.dev/) (após `npm install`, execute `npx playwright install`)

## Instalação

1. **Clone o repositório** e entre na pasta:
   ```bash
   git clone <repo-url>
   cd secrebot
   ```
2. **Copie o arquivo de exemplo** de variáveis de ambiente:
   ```bash
   cp .env.example .env
   ```
3. **Instale as dependências** e baixe os navegadores do Playwright:
   ```bash
   npm install
   npx playwright install
   ```
4. **Compile o Whisper** (é necessário ter `make` e `g++`):
   ```bash
   npx nodejs-whisper download
   ```
5. **Configure o MongoDB** (exemplo para Ubuntu/Debian):
   ```bash
   sudo apt update
   sudo apt install -y mongodb-org
   sudo systemctl start mongod
   sudo systemctl enable mongod
   mongosh
   > use sched
   > db.createUser({user: "bot", pwd: "senha", roles:["readWrite"]})
   > exit
   ```
6. **Instale o Ollama** e baixe um modelo (ex.: `llama3`):
   ```bash
   curl -L https://ollama.com/install.sh | sh
   ollama run llama3
   ```
7. **Edite o arquivo `.env`** com as credenciais e ajustes desejados. Os principais campos são:
   ```bash
   MONGO_URI=mongodb://user:pass@localhost:27017/
   PORT=3000
   ELEVENLABS_API_KEY=
   ELEVENLABS_VOICE_ID=
   PIPER_MODEL=
   PIPER_EXECUTABLE=
   OLLAMA_HOST=http://127.0.0.1:11434
   OLLAMA_TIMEOUT_MS=60000
   CALORIE_API_URL=https://api.api-ninjas.com/v1/nutrition?query=
   CALORIE_API_KEY=
   # Integração com Google Calendar
   GOOGLE_CLIENT_ID=
   GOOGLE_CLIENT_SECRET=
   GOOGLE_REDIRECT=http://localhost:3000/oauth2callback
   ```
   Consulte `.env.example` para a lista completa de opções.
8. **Inicie o bot**:
   ```bash
   npm start
   ```
   Um QR Code será exibido no terminal. Escaneie com o WhatsApp para autenticar. A interface web ficará em `http://localhost:3000`.

## Utilização

Envie `!menu` ou utilize os atalhos numéricos no WhatsApp. Principais comandos:

1. `!ajuda` – mostra o menu
2. `!agendabot` – cria lembretes
3. `!listaragendamentos` – lista lembretes
4. `!deletaragendamento` – remove um lembrete
5. `!deep` – conversa com o chatbot
6. `!transcrever` – transcreve áudios
7. `!foto` – descreve imagens
8. `!calorias` – estima calorias de uma foto
9. `!linkedin <URL>` – analisa um perfil (solicitará login se necessário)
10. `!voz` – alterna respostas em áudio ou texto
11. `!recurso` – exibe detalhes do sistema
12. `!resumir` – resume texto ou arquivo
13. `!importaragenda` – importa eventos
14. `!resumoyoutube` – resume vídeos ou agenda canais

Ao iniciar, acesse `http://localhost:3000/` para o painel web. Em `/dashboard` é possível criar, editar e duplicar lembretes, além de visualizar estatísticas. As configurações em `/config` permitem alterar todas as variáveis do `.env` e a aplicação reinicia automaticamente após salvar.

## Estrutura da Base (MongoDB)

Cada lembrete é salvo em uma coleção definida em `CONFIG.mongo` com o formato:
```json
{
  "_id": ObjectId,
  "recipient": "<numero>",
  "message": "<texto>",
  "status": "approved" | "sent" | "failed",
  "scheduledTime": ISODate,
  "expiryTime": ISODate,
  "sentAt": ISODate | null,
  "attempts": Number,
  "lastAttemptAt": ISODate | null,
  "error": "<mensagem de erro>"
}
```
O bot cria índices para buscas rápidas:
```javascript
await this.schedCollection.createIndex({ recipient: 1, status: 1 });
await this.schedCollection.createIndex({ scheduledTime: 1, status: 1, sentAt: 1 });
```

## Estrutura do Projeto

- `src/app.js` – ponto de entrada que inicializa serviços, bot e API
- `src/core/whatsAppBot.js` – lógica principal do bot
- `src/services/` – serviços auxiliares (LLM, transcrição, TTS, scheduler)
- `src/api/restApi.js` – implementação da API Express
- `src/config/` – definições de configuração
- `src/utils/` – funções utilitárias

## Testes

Execute a suíte de testes com:
```bash
npm test
```

## Docker

Para criar uma imagem Docker:
```bash
docker build -t secrebot .
```
Após o build, execute:
```bash
docker run -p 3000:3000 secrebot
```
O repositório também inclui um `docker-compose.yml` para subir MongoDB e Ollama junto ao bot:
```bash
docker compose up --build
```

## Contribuindo

Pull requests são bem-vindos! Siga os passos:
1. Fork do projeto
2. Crie uma branch (`git checkout -b feature/minha-feature`)
3. Commit suas alterações (`git commit -m 'Minha feature'`)
4. Faça push para a branch (`git push origin feature/minha-feature`)
5. Abra um Pull Request

## Licença

Distribuído sob a licença ISC conforme definido em `package.json`.
