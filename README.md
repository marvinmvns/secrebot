# 🤖 Secrebot

> Um assistente inteligente para WhatsApp construído em Node.js com arquitetura modular e recursos avançados de IA

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6.0+-brightgreen.svg)](https://www.mongodb.com/)
[![License](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)

## 📋 Índice

- [Funcionalidades](#-funcionalidades)
- [Requisitos](#-requisitos)
- [Instalação](#-instalação)
- [Configuração](#-configuração)
- [Utilização](#-utilização)
- [API REST](#-api-rest)
- [Interface Web](#-interface-web)
- [Estrutura do Banco](#-estrutura-do-banco)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Docker](#-docker)
- [Licença](#-licença)

## 🚀 Funcionalidades

### 💬 **Chatbot Inteligente**
- Conversas alimentadas por LLM local (Ollama)
- Respostas contextuais e personalizadas
- Suporte a múltiplos modelos de linguagem

### 🎤 **Processamento de Áudio**
- **Transcrição**: Converte mensagens de voz em texto usando Whisper
- **Comandos por voz**: Interpreta gravações e mapeia para comandos do bot
- **TTS**: Gera respostas em áudio via ElevenLabs ou Piper (local)

### 🖼️ **Análise Visual**
- **Descrição de imagens**: Análise detalhada de fotos enviadas
- **Contador de calorias**: Estimativa nutricional baseada em imagens de alimentos

### ⏰ **Sistema de Agendamentos**
- Criação de lembretes personalizados
- Armazenamento seguro em MongoDB
- Envio automático no horário programado
- Interface web para gerenciamento

### 🔗 **Integrações Externas**
- **LinkedIn**: Análise de perfis profissionais
- **Processamento de Vídeos**: Transcrição e resumo de links do YouTube
- **Google Calendar**: Importação de eventos
- **API REST**: Endpoints para integração externa

### 📊 **Monitoramento**
- Dashboard web com estatísticas
- Informações de recursos do sistema
- Logs detalhados de operações

## 📋 Requisitos

### Obrigatórios
- **Node.js** 18 ou superior
- **MongoDB** 6.0 ou superior
- **ffmpeg** (para processamento de áudio)
- **Ollama** (para modelos LLM locais)

### Opcionais
- **ElevenLabs API** (para TTS premium)
- **Piper** (para TTS local)
- **yt-dlp** (extração de áudio/legendas de vídeos)
- **Google Cloud Console** (integração Calendar)

## 🛠️ Instalação

### 1. Clone o repositório
```bash
git clone <repo-url>
cd secrebot
```

### 2. Instale as dependências
```bash
npm install
```
### 3. Instale o yt-dlp (aarch64)
```bash
sudo apt update
sudo apt install -y python3-pip
pip3 install yt-dlp --break-system-packages
```


### 4. Configure o Whisper
```bash
# Certifique-se de ter build-essential instalado
sudo apt install build-essential

# Baixe e compile o Whisper
npx nodejs-whisper download
```

### 5. Configure o MongoDB
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod

# Crie o banco e usuário
mongosh
> use sched
> db.createUser({user: "bot", pwd: "senha", roles:["readWrite"]})
> exit
```

### 6. Instale e configure o Ollama
```bash
# Linux/macOS
curl -L https://ollama.com/install.sh | sh

# Baixe um modelo
ollama run llama3

# Ou mantenha em segundo plano
ollama serve
```

## ⚙️ Configuração

### 1. Inicialize o banco
Execute o script de criação das coleções:

```bash
npm run setup
```

### 2. (Opcional) Importe um `.env`
Edite o arquivo `.env` (use `.env.example` como modelo) e depois rode:

```bash
npm run migrate
```

As variáveis serão gravadas na coleção `config`. O aplicativo não lê o `.env` em tempo de execução.

```bash
# 🔧 Configurações Básicas
PORT=3000

# 🤖 Ollama/LLM
OLLAMA_HOST=<url_do_servidor_ollama>
OLLAMA_TIMEOUT_MS=60000
LLM_CONCURRENCY=2

# 🎤 Audio/TTS
ELEVENLABS_API_KEY=<sua_chave_elevenlabs>
ELEVENLABS_VOICE_ID=<voice_id>

# 🎯 TTS Local (Piper) - Opcional
PIPER_MODEL=/caminho/para/modelo.onnx
PIPER_EXECUTABLE=/usr/local/bin/piper

# 🧠 Processamento
WHISPER_CONCURRENCY=1
QUEUE_MEM_THRESHOLD_GB=4
DYNAMIC_CONCURRENCY=false
# Intervalo para checar novos vídeos (ms)
FEED_CHECK_INTERVAL=1800000

# 📅 Agendamentos
SCHED_MAX_CONCURRENCY=10
SCHED_CPU_THRESHOLD=0.7
SCHED_MEM_THRESHOLD=0.8

# 🔗 Integrações Externas
CALORIE_API_URL=https://api.api-ninjas.com/v1/nutrition?query=
CALORIE_API_KEY=<sua_chave_ninjas>
LINKEDIN_USER=<seu_usuario>
LINKEDIN_PASS=<sua_senha>
LINKEDIN_LI_AT=<cookie_li_at>
LINKEDIN_TIMEOUT_MS=30000

# 📅 Google Calendar
GOOGLE_CLIENT_ID=<client_id>
GOOGLE_CLIENT_SECRET=<client_secret>
GOOGLE_REDIRECT=http://localhost:3000/oauth2callback
```

### 🗣️ TTS Local com Piper

Para usar TTS local sem depender da ElevenLabs:

```bash
# Instale o Piper
# Baixe um modelo pt-br de https://github.com/rhasspy/piper

# Configure no .env
PIPER_ENABLED=true
PIPER_MODEL=/caminho/para/pt-br-voce.onnx
PIPER_EXECUTABLE=/usr/local/bin/piper
```

**Alternativa com Docker:**
```bash
#!/bin/bash
# piper-docker.sh
docker run --rm -i -v /caminho/para/modelos:/data ghcr.io/rhasspy/piper:latest "$@"
```

### 7. Inicie o bot
```bash
npm start
```

🔗 **Autenticação**: Escaneie o QR Code exibido no terminal com o WhatsApp

🌐 **Interface Web**: Acesse `http://localhost:3000`

## 📱 Utilização

### Comandos Disponíveis

Envie `!menu` ou use os atalhos numéricos:

| Comando | Atalho | Descrição |
|---------|--------|-----------|
| `!ajuda` | 1️⃣ | Exibir menu de comandos |
| `!agendabot` | 2️⃣ | Criar lembretes personalizados |
| `!listaragendamentos` | 3️⃣ | Listar agendamentos ativos |
| `!deletaragendamento` | 4️⃣ | Remover agendamentos |
| `!deep` | 5️⃣ | Conversar com o chatbot IA |
| `!transcrever` | 6️⃣ | Transcrever mensagens de áudio |
| `!foto` | 7️⃣ | Descrever imagens enviadas |
| `!calorias` | 8️⃣ | Estimar calorias de alimentos |
| `!linkedin <URL>` | 9️⃣ | Analisar perfil do LinkedIn |
| `!voz` | 🔟 | Alternar respostas voz/texto |
| `!recurso` | 1️⃣1️⃣ | Informações do sistema |
| `!resumir` | 1️⃣2️⃣ | Resumir textos ou arquivos |
| `!importaragenda` | 1️⃣3️⃣ | Importar eventos do Calendar |
| `!resumirvideo <URL>` | 1️⃣4️⃣ | Resumir vídeos do YouTube |
| `!acompanharfeedresumido <link>` | 1️⃣5️⃣ | Seguir canal e resumir vídeos |
| `!listaracompanhamentofeed` | 1️⃣6️⃣ | Listar canais seguidos |
| `!removeracompanhamentofeed <id>` | 1️⃣7️⃣ | Cancelar acompanhamento |
| `!voltar` | 0️⃣ | Retornar ao menu principal |

### Exemplos de Uso

```
# Criar um lembrete
!agendabot
> Reunião importante amanhã às 14:00

# Transcrever áudio
!transcrever
> [Envie um áudio]

# Analisar foto de comida
!calorias
> [Envie uma foto da refeição]

# Conversar com IA
!deep Como melhorar minha produtividade?
```

## 🌐 API REST

### Endpoints Principais

```http
POST /send-message
Content-Type: application/json

{
  "to": "5511999999999",
  "message": "Hello World"
}
```

```http
GET /health
# Retorna status da aplicação
```

#### Feeds

```http
POST /api/feeds
```

```http
GET /api/feeds?phone=5511999999999
```

```http
DELETE /api/feeds/UCxxxx?phone=5511999999999
```

### Endpoints da Interface Web

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET/POST` | `/chat` | Interface de chat |
| `GET/POST` | `/transcribe` | Upload de áudio para transcrição |
| `GET/POST` | `/describe` | Análise de imagens |
| `GET/POST` | `/calories` | Contador de calorias |
| `GET/POST` | `/linkedin` | Análise de perfil LinkedIn |
| `GET/POST` | `/summarize` | Resumo de textos |
| `GET/POST` | `/video` | Transcrição de vídeos |
| `GET` | `/resources` | Informações do sistema |
| `POST` | `/toggle-voice` | Alternar modo de voz |

## 🖥️ Interface Web

### 📊 Dashboard
- **Rota**: `/` ou `/dashboard`
- **Recursos**: 
  - Listagem de agendamentos
  - Criação/edição de lembretes
  - Estatísticas do bot
  - Duplicação de agendamentos

### ⚙️ Configurações
- **Rota**: `/config`
- **Recursos**:
  - Edição das configurações salvas
  - Reinicialização automática
  - Validação de configurações

## 🗄️ Estrutura do Banco

### Coleção de Agendamentos
```json
{
  "_id": "ObjectId",
  "recipient": "5511999999999",
  "message": "Texto do lembrete",
  "status": "approved|sent|failed",
  "scheduledTime": "2024-01-01T10:00:00Z",
  "expiryTime": "2024-01-01T11:00:00Z",
  "sentAt": "2024-01-01T10:00:05Z",
  "attempts": 1,
  "lastAttemptAt": "2024-01-01T10:00:05Z",
  "error": "Mensagem de erro (se houver)"
}
```

### Índices Automáticos
```javascript
// Criados automaticamente na inicialização
{ recipient: 1, status: 1 }
{ scheduledTime: 1, status: 1, sentAt: 1 }
// Índices do acompanhamento de feeds
{ phone: 1, channelId: 1 } // feedSubscriptions
{ channelId: 1, published: 1 } // feedItems
// As coleções feedSubscriptions e feedItems são criadas automaticamente
// na primeira execução do monitor de feeds
```

### Coleção feedSubscriptions
```json
{
  "_id": "ObjectId",
  "phone": "5511999999999",
  "channelId": "UCxxxx",
  "addedAt": "2024-01-01T00:00:00Z",
  "lastChecked": "2024-01-01T01:00:00Z",
  "queueKey": null
}
```

### Coleção feedItems
```json
{
  "_id": "videoId",
  "channelId": "UCxxxx",
  "published": "2024-01-01T02:00:00Z",
  "summaryStatus": "pending"
}
```

## 📁 Estrutura do Projeto

```
secrebot/
├── 📂 src/
│   ├── 📄 app.js                 # Ponto de entrada principal
│   ├── 📂 core/
│   │   └── 📄 whatsAppBot.js     # Lógica do bot WhatsApp
│   ├── 📂 services/              # Serviços auxiliares
│   │   ├── 📄 llmService.js      # Integração com Ollama
│   │   ├── 📄 transcription.js   # Whisper/transcrição
│   │   ├── 📄 ttsService.js      # Text-to-Speech
│   │   └── 📄 scheduler.js       # Agendamentos
│   ├── 📂 api/
│   │   └── 📄 restApi.js         # API Express
│   ├── 📂 config/                # Configurações
│   │   ├── 📄 index.js           # Config principal
│   │   └── 📄 messages.js        # Mensagens padrão
│   └── 📂 utils/                 # Utilitários
├── 📂 public/                    # Assets da interface web
├── 📂 views/                     # Templates HTML
├── 📄 package.json
├── 📄 Dockerfile
├── 📄 docker-compose.yml
└── 📄 README.md
```

## 🐳 Docker

### Build da Imagem
```bash
docker build -t secrebot .
```

### Executar Container
```bash
docker run -p 3000:3000 secrebot
```

### Docker Compose (Recomendado)
```bash
# Inicia todos os serviços (MongoDB + Ollama + Secrebot)
docker compose up --build
```

O `docker-compose.yml` inclui:
- **MongoDB** com persistência de dados
- **Ollama** com modelo pré-carregado
- **Secrebot** com todas as dependências

### Configuração de Produção
```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  secrebot:
    build: .
    environment:
      - NODE_ENV=production
    depends_on:
      - mongo
      - ollama
    restart: unless-stopped
```

## 🧪 Testes

```bash
# Executar testes unitários
npm test

# Executar com coverage
npm run test:coverage

# Testes de integração
npm run test:integration
```

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Distribuído sob a licença ISC. Veja `LICENSE` para mais informações.

---

<div align="center">

**[⬆ Voltar ao topo](#-secrebot)**

Feito com ❤️ para automatizar seu WhatsApp

</div>
