
# Secrebot


Secrebot é um assistente para WhatsApp construído em Node.js com uma estrutura modular. O projeto integra serviços de transcrição de áudio (Whisper), modelos LLM locais via Ollama para respostas automáticas, agendamento de mensagens e geração de voz usando a API da ElevenLabs.

## Funcionalidades

- **Envio de Mensagens e Chatbot**: conversas alimentadas por LLM local (Ollama), respondendo a comandos e perguntas.
- **Transcrição de Áudio**: converte mensagens de voz em texto utilizando o Whisper.
- **Comandos por Áudio**: o LLM interpreta gravações e mapeia para os comandos do bot.
- **Descrição de Imagens**: analisa imagens recebidas e fornece descrições ou estimativas de calorias.
- **Agendamento de Lembretes**: armazena lembretes em MongoDB e envia as mensagens programadas no horário marcado.
- **Respostas em Áudio (TTS)**: opcionalmente gera áudio com a ElevenLabs para respostas por voz.
- **API REST**: integração externa pelos endpoints `/send-message` e `/health`.

Os principais comandos podem ser vistos no menu do aplicativo ou acessando a interface web em `/`.

## Requisitos

- Node.js 18 ou superior
- MongoDB acessível para armazenar agendamentos
- `ffmpeg` instalado no sistema (necessário para transcrição de áudio)
- Conta e chave da [ElevenLabs](https://elevenlabs.io/) para recursos de voz (opcional)
- [Ollama](https://ollama.ai/) instalado para executar o modelo local de LLM
- [`Playwright`](https://playwright.dev/) instalado (após `npm install` execute `npx playwright install` para baixar os navegadores)

## Instalação

1. **Clone o repositório**

   ```bash
   git clone <repo-url>
   cd secrebot
   ```

2. **Instale as dependências**

   ```bash
   npm install
   npx playwright install
   ```

3. **Compile o Whisper**

   Após a instalação das dependências, execute o comando abaixo para baixar o modelo e compilar o `nodejs-whisper`. Certifique-se de que ferramentas como `make` e `g++` estejam instaladas (`sudo apt install build-essential`).

   ```bash
   npx nodejs-whisper download
   ```

4. **Instale o MongoDB** (Ubuntu/Debian)

   ```bash
   sudo apt update
   sudo apt install -y mongodb-org
   sudo systemctl start mongod
   sudo systemctl enable mongod
   ```

   Depois, crie a base e o usuário:

   ```bash
   mongosh
   > use sched
   > db.createUser({user: "bot", pwd: "senha", roles:["readWrite"]})
   > exit
   ```

5. **Instale o Ollama** (Linux/macOS)

   ```bash
   curl -L https://ollama.com/install.sh | sh
   ```
   Após instalado, baixe um modelo (ex.: llama3) e inicie o servidor:
   ```bash
   ollama run llama3
   # ou apenas "ollama serve" para manter em segundo plano
   ```

6. **Configure as variáveis de ambiente** (crie um arquivo `.env` ou exporte no shell):


   ```bash
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
   OLLAMA_TIMEOUT_MS=60000
  CALORIE_API_URL=https://api.api-ninjas.com/v1/nutrition?query=
  CALORIE_API_KEY=
  LINKEDIN_USER=
  LINKEDIN_PASS=
  LINKEDIN_LI_AT=
  LINKEDIN_TIMEOUT_MS=30000
  # Integração com Google Calendar
   GOOGLE_CLIENT_ID=
   GOOGLE_CLIENT_SECRET=
  GOOGLE_REDIRECT=http://localhost:3000/oauth2callback
  ```

Para habilitar a importação de eventos do Google Calendar é necessário criar um projeto no Google Cloud Console, habilitar a API Calendar e configurar uma tela de consentimento OAuth. Informe as credenciais acima no arquivo `.env`.

### TTS local com Piper

Se `PIPER_MODEL` estiver definido e a chave da ElevenLabs não for fornecida, o bot utilizará o [Piper](https://github.com/rhasspy/piper) para gerar as respostas em áudio de forma totalmente local. Instale o Piper e baixe um modelo compatível (por exemplo, `pt-br-...`). Em seguida, configure as variáveis acima informando o caminho do modelo e, opcionalmente, do executável.

   Esses valores são lidos em `src/config/index.js` e permitem personalizar a conexão com o banco, a porta do servidor e o uso de TTS.

7. **Inicie o bot**

   ```bash
   npm start
   ```

  Um QR Code será exibido no terminal. Escaneie com o WhatsApp para autenticar o bot. A API REST ficará disponível em `http://localhost:3000` (ou na porta configurada).
  O painel web para gerenciar agendamentos também estará acessível no mesmo endereço, em `/`.
  Para editar as configurações do arquivo `.env` utilize a rota `/config` na interface web.

## Utilização

Após iniciar, envie `!menu` ou os atalhos numéricos para ver as opções. Entre as funções disponíveis estão:

- `!agendabot` para criar lembretes
- `!listaragendamentos` para listar
- `!deletaragendamento` para remover
- `!transcrever` para modo de transcrição de áudio
- `!foto` ou `!calorias` enviados com uma imagem
- `!voz` para alternar respostas por voz ou texto
- `!recurso` para exibir detalhes do sistema onde o bot está rodando
- `!linkedin <URL>` para resumir dados públicos de um perfil
- `!resumir` com texto ou arquivo (PDF, TXT, DOCX ou CSV) para resumir o conteúdo

A interface web de agendamento pode ser acessada em `/`. Ela permite listar, criar, editar e duplicar lembretes usando um formulário simples e exibe estatísticas do bot.


## Estrutura da Base (MongoDB)

Cada lembrete é armazenado em uma coleção definida em `CONFIG.mongo` com o seguinte formato:

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

Ao conectar, o bot cria índices para buscas rápidas por destinatário e horário programado:

```javascript
await this.schedCollection.createIndex({ recipient: 1, status: 1 });
await this.schedCollection.createIndex({ scheduledTime: 1, status: 1, sentAt: 1 });
```

## Estrutura do Projeto

- `src/app.js` – ponto de entrada que inicializa os serviços, o bot e a API REST
- `src/core/whatsAppBot.js` – lógica principal do bot e dos comandos
- `src/services/` – serviços auxiliares (LLM, transcrição, TTS, scheduler)
- `src/api/restApi.js` – implementação da API Express
- `src/config/` – definições de configuração e mensagens padrão
- `src/utils/` – funções utilitárias

## Licença

Distribuído sob a licença ISC conforme definido no `package.json`.

## Docker

Para criar uma imagem Docker do projeto execute:

```bash
docker build -t secrebot .
```

Os testes unitários são executados durante a fase de build. Após a conclusão, inicie o container com:

```bash
docker run -p 3000:3000 secrebot
```

