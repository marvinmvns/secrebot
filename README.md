# Secrebot


Secrebot é um assistente para WhatsApp construído em Node.js com uma estrutura modular. O projeto integra serviços de transcrição de áudio (Whisper), modelos LLM locais via Ollama para respostas automáticas, agendamento de mensagens e geração de voz usando a API da ElevenLabs.

## Funcionalidades

- **Envio de Mensagens e Chatbot**: conversas alimentadas por LLM local (Ollama), respondendo a comandos e perguntas.
- **Transcrição de Áudio**: converte mensagens de voz em texto utilizando o Whisper.
- **Comandos por Áudio**: o LLM interpreta gravações e mapeia para os comandos do bot.
- **Descrição de Imagens**: analisa imagens recebidas e fornece descrições ou estimativas de calorias.
- **Agendamento de Lembretes**: armazena lembretes em MongoDB e envia as mensagens programadas no horário marcado.
- **Respostas em Áudio (TTS)**: opcionalmente gera áudio com a ElevenLabs para respostas por voz.
- **API REST**: integração externa pelos endpoints /send-message e /health.

Os principais comandos podem ser vistos no menu do aplicativo ou acessando a interface web em /.

### Endpoints da Interface Web

Além do dashboard e das configurações, cada funcionalidade do bot possui uma rota própria:

- GET /chat e POST /chat – conversar com o assistente.
- GET /transcribe e POST /transcribe – enviar áudio para transcrição.
- GET /describe e POST /describe – descrição de imagens.
- GET /calories e POST /calories – estimativa de calorias de uma foto.
- GET /linkedin e POST /linkedin – análise de um perfil do LinkedIn.
- GET /summarize e POST /summarize – resumo de texto ou arquivo.
- GET /video e POST /video – transcrever vídeos do YouTube.
- GET /resources – mostrar informações do sistema.
- POST /toggle-voice – alternar respostas em voz na interface.

## Requisitos

- Node.js 18 ou superior
- MongoDB acessível para armazenar agendamentos
- ffmpeg instalado no sistema (necessário para transcrição de áudio)
- Conta e chave da [ElevenLabs](https://elevenlabs.io/) para recursos de voz (opcional)
- [Ollama](https://ollama.ai/) instalado para executar o modelo local de LLM
- [Playwright](https://playwright.dev/) instalado (após npm install execute npx playwright install para baixar os navegadores)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) para download de áudio do YouTube (utilizado como fallback quando ytdl-core falha)

## Instalação

1. **Clone o repositório**

   
bash
   git clone <repo-url>
   cd secrebot


2. **Instale as dependências**

   
bash
   npm install
   npx playwright install


3. **Compile o Whisper**

   Após a instalação das dependências, execute o comando abaixo para baixar o modelo e compilar o nodejs-whisper. Certifique-se de que ferramentas como make e g++ estejam instaladas (sudo apt install build-essential).

   
bash
   npx nodejs-whisper download


4. **Instale o MongoDB** (Ubuntu/Debian)

   
bash
   sudo apt update
   sudo apt install -y mongodb-org
   sudo systemctl start mongod
   sudo systemctl enable mongod


   Depois, crie a base e o usuário:

   
bash
   mongosh
   > use sched
   > db.createUser({user: "bot", pwd: "senha", roles:["readWrite"]})
   > exit


5. **Instale o Ollama** (Linux/macOS)

   
bash
   curl -L https://ollama.com/install.sh | sh

   Após instalado, baixe um modelo (ex.: llama3) e inicie o servidor:
   
bash
   ollama run llama3
   # ou apenas "ollama serve" para manter em segundo plano


6. **Configure as variáveis de ambiente** (crie um arquivo .env ou exporte no shell):


   
bash
   MONGO_URI=mongodb://<usuario>:<senha>@<host>:<porta>/
   PORT=3000
   ELEVENLABS_API_KEY=<sua_chave>
   ELEVENLABS_VOICE_ID=<voice_id>
   # Para usar TTS local com Piper, defina o modelo (opcional)
   PIPER_MODEL=/caminho/para/modelo.onnx
   # Caso o executável não esteja no PATH, informe também:
   PIPER_EXECUTABLE=/usr/local/bin/piper
   # Limite de memória em GB para processar tarefas pesadas
   QUEUE_MEM_THRESHOLD_GB=4
   LLM_CONCURRENCY=2
   WHISPER_CONCURRENCY=1
   MEM_CHECK_INTERVAL=1000
   DYNAMIC_CONCURRENCY=false
   SCHED_MAX_CONCURRENCY=10
   SCHED_CPU_THRESHOLD=0.7
  SCHED_MEM_THRESHOLD=0.8
  OLLAMA_HOST=http://127.0.0.1:11434
  OLLAMA_TIMEOUT_MS=60000  # tempo máximo para resposta inicial do modelo
  CALORIE_API_URL=https://api.api-ninjas.com/v1/nutrition?query=
  CALORIE_API_KEY=
  LINKEDIN_USER=
  LINKEDIN_PASS=
  LINKEDIN_LI_AT=
  LINKEDIN_TIMEOUT_MS=30000
  # aumente OLLAMA_TIMEOUT_MS caso ocorra "Headers Timeout" ao contactar o LLM
  # Integração com Google Calendar
   GOOGLE_CLIENT_ID=
   GOOGLE_CLIENT_SECRET=
  GOOGLE_REDIRECT=http://localhost:3000/oauth2callback


Para habilitar a importação de eventos do Google Calendar é necessário criar um projeto no Google Cloud Console, habilitar a API Calendar e configurar uma tela de consentimento OAuth. Informe as credenciais acima no arquivo .env.

### TTS local com Piper

Se PIPER_MODEL estiver definido e a chave da ElevenLabs não for fornecida, o bot utilizará o [Piper](https://github.com/rhasspy/piper) para gerar as respostas em áudio de forma totalmente local. Instale o Piper e baixe um modelo compatível (por exemplo, pt-br-...). Em seguida, configure as variáveis acima informando o caminho do modelo e, opcionalmente, do executável.

Para evitar compilar o binário é possível executar o Piper via Docker. A imagem oficial está disponível no mesmo repositório. Um exemplo de script (piper-docker.sh) que o bot pode chamar é:

bash
#!/bin/bash
docker run --rm -i -v /caminho/para/modelos:/data ghcr.io/rhasspy/piper:latest \
  "$@"


Com o script acima defina as variáveis no .env:

bash
PIPER_ENABLED=true
PIPER_EXECUTABLE=/caminho/para/piper-docker.sh
PIPER_MODEL=/caminho/para/modelos/pt-br-voce.onnx


Esses valores são lidos em src/config/index.js e permitem personalizar a conexão com o banco, a porta do servidor e o uso de TTS.

7. **Inicie o bot**

   
bash
   npm start


  Um QR Code será exibido no terminal. Escaneie com o WhatsApp para autenticar o bot. A API REST ficará disponível em http://localhost:3000 (ou na porta configurada).
  O painel web para gerenciar agendamentos também estará acessível no mesmo endereço, em /.
  Para editar as configurações do arquivo .env utilize a rota /config na interface web.

## Utilização

Após iniciar, envie !menu ou use os atalhos numéricos. As opções são:

1️⃣ !ajuda para mostrar o menu
2️⃣ !agendabot para criar lembretes
3️⃣ !listaragendamentos para listar
4️⃣ !deletaragendamento para remover
5️⃣ !deep para conversar com o chatbot
6️⃣ !transcrever para transcrever áudios
7️⃣ !foto para descrever imagens
8️⃣ !calorias para estimar calorias de uma foto
9️⃣ !linkedin <URL> para analisar um perfil (se o cookie li_at não estiver configurado o bot solicitará suas credenciais)
🔟 !voz para alternar respostas por voz ou texto
1️⃣1️⃣ !recurso para exibir detalhes do sistema
1️⃣2️⃣ !resumir para resumir texto ou arquivo
1️⃣3️⃣ !importaragenda para importar eventos
1️⃣4️⃣ !resumirvideo <URL> para transcrever vídeos do YouTube com Whisper
0️⃣ !voltar para retornar ao menu principal

Ao iniciar o bot você terá acesso a uma pequena interface web. Na página inicial (/) há um menu de painéis que inclui o dashboard de agendamentos e a tela de configurações. O dashboard propriamente dito está em /dashboard e permite listar, criar, editar e duplicar lembretes, além de exibir estatísticas do bot.
As configurações da aplicação ficam em /config. A tela lista todas as opções de src/config/index.js com uma breve descrição do uso de cada uma. Após salvar o formulário todas as variáveis são gravadas no .env e a aplicação é reiniciada automaticamente para aplicar os novos valores.


## Estrutura da Base (MongoDB)

Cada lembrete é armazenado em uma coleção definida em CONFIG.mongo com o seguinte formato:

json
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


Ao conectar, o bot cria índices para buscas rápidas por destinatário e horário programado:

javascript
await this.schedCollection.createIndex({ recipient: 1, status: 1 });
await this.schedCollection.createIndex({ scheduledTime: 1, status: 1, sentAt: 1 });


## Estrutura do Projeto

- src/app.js – ponto de entrada que inicializa os serviços, o bot e a API REST
- src/core/whatsAppBot.js – lógica principal do bot e dos comandos
- src/services/ – serviços auxiliares (LLM, transcrição, TTS, scheduler)
- src/api/restApi.js – implementação da API Express
- src/config/ – definições de configuração e mensagens padrão
- src/utils/ – funções utilitárias

## Licença

Distribuído sob a licença ISC conforme definido no package.json.

## Docker

Para criar uma imagem Docker do projeto execute:

bash
docker build -t secrebot .


Os testes unitários são executados durante a fase de build. Após a conclusão, inicie o container com:

bash
docker run -p 3000:3000 secrebot


Para facilitar a execução com todas as dependências (MongoDB e Ollama) utilize o docker-compose.yml incluido no repositório:

bash
docker compose up --build
