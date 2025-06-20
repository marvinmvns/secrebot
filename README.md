Secrebot

Secrebot é um assistente inteligente para WhatsApp, desenvolvido em Node.js com uma arquitetura modular. Ele integra funcionalidades avançadas como transcrição de áudio com Whisper, geração automática de respostas utilizando modelos locais (Ollama), agendamento inteligente de mensagens, e síntese de voz através da API ElevenLabs ou localmente com Piper.

Principais Funcionalidades

Chatbot Inteligente: respostas automáticas baseadas em modelos locais (Ollama).

Transcrição de Áudio: converte mensagens de voz em texto com Whisper.

Comandos por Voz: interpreta comandos enviados por áudio diretamente.

Descrição e Análise de Imagens: gera descrições detalhadas e estima calorias.

Agendamento de Mensagens: envia mensagens programadas, armazenando agendamentos no MongoDB.

Respostas por Voz (TTS): gera áudio utilizando ElevenLabs ou Piper.

API REST: permite integrações externas através de endpoints HTTP.

Endpoints da API Web

Endpoint

Descrição

/chat

Conversação com o chatbot

/transcribe

Transcrição de áudio

/describe

Descrição detalhada de imagens

/calories

Estimativa calórica por imagem

/linkedin

Análise de perfil do LinkedIn

/summarize

Resumo de texto ou arquivos

/video

Transcrição de vídeos do YouTube

/resources

Informações do sistema

/toggle-voice

Alterna entre respostas em texto/voz

Requisitos

Node.js: versão 18 ou superior

MongoDB: armazenamento de agendamentos

ffmpeg: necessário para transcrição de áudio

ElevenLabs (Opcional): chave para geração de voz

Ollama: execução do modelo LLM local

Playwright: instalação após dependências

yt-dlp: alternativa para download de áudio do YouTube

Instalação

1. Clone o repositório

git clone <repo-url>
cd secrebot

2. Instale as dependências

npm install
npx playwright install

3. Compile o Whisper

sudo apt install build-essential
npx nodejs-whisper download

4. Configuração do MongoDB

sudo apt update
sudo apt install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod

mongosh
> use sched
> db.createUser({user: "bot", pwd: "senha", roles:["readWrite"]})
> exit

5. Instale e Configure o Ollama

curl -L https://ollama.com/install.sh | sh
ollama run llama3
# ou "ollama serve" em segundo plano

6. Configuração das Variáveis de Ambiente

Crie um arquivo .env:

MONGO_URI=mongodb://usuario:senha@host:porta/
PORT=3000
ELEVENLABS_API_KEY=<sua_chave>
ELEVENLABS_VOICE_ID=<voice_id>
PIPER_MODEL=/caminho/modelo.onnx
PIPER_EXECUTABLE=/usr/local/bin/piper
QUEUE_MEM_THRESHOLD_GB=4
LLM_CONCURRENCY=2
WHISPER_CONCURRENCY=1
OLLAMA_HOST=http://127.0.0.1:11434
CALORIE_API_KEY=
LINKEDIN_USER=
LINKEDIN_PASS=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT=http://localhost:3000/oauth2callback

TTS local com Piper

Alternativa ao ElevenLabs, configuração local com Docker:

PIPER_ENABLED=true
PIPER_EXECUTABLE=/caminho/piper-docker.sh
PIPER_MODEL=/caminho/modelos/pt-br-voce.onnx

7. Inicie o Bot

npm start

Escaneie o QR Code exibido com WhatsApp para autenticar.

Utilização

Após iniciar, envie comandos no WhatsApp:

!ajuda - Exibe menu de ajuda

!agendabot - Cria lembretes

!listaragendamentos - Lista lembretes

!deletaragendamento - Remove lembretes

!deep - Conversação avançada

!transcrever - Transcrição de áudios

!foto - Descrição de imagens

!calorias - Estima calorias de fotos

!linkedin <URL> - Análise de LinkedIn

!voz - Alterna respostas por voz/texto

!recurso - Informações do sistema

!resumir - Resumo de textos

!importaragenda - Importação do Google Agenda

!resumirvideo <URL> - Transcrição de vídeos YouTube

!voltar - Retorna ao menu inicial

Interface Web

Disponível em http://localhost:3000

Dashboard (/dashboard): gerencia agendamentos e estatísticas

Configurações (/config): edição de configurações em tempo real

Estrutura do Projeto

src/
├── app.js (inicialização principal)
├── core/
│   └── whatsAppBot.js (lógica principal)
├── services/ (auxiliares: LLM, transcrição, TTS, agendamento)
├── api/
│   └── restApi.js (API REST)
├── config/ (configurações e mensagens)
└── utils/ (funções auxiliares)

Estrutura do MongoDB

Coleção padrão:

{
  "recipient": "numero",
  "message": "texto",
  "status": "approved"|"sent"|"failed",
  "scheduledTime": ISODate,
  "expiryTime": ISODate,
  "sentAt": ISODate|null,
  "attempts": Number,
  "lastAttemptAt": ISODate|null,
  "error": "mensagem erro"
}

Docker

Construa e execute rapidamente com Docker:

docker compose up --build

Licença

Distribuído sob a licença ISC. Consulte o arquivo package.json.
