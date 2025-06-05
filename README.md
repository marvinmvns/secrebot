
# Secrebot


Secrebot é um assistente para WhatsApp construído em Node.js com uma estrutura modular. O projeto integra serviços de transcrição de áudio (Whisper), modelos LLM locais via Ollama para respostas automáticas, agendamento de mensagens e geração de voz usando a API da ElevenLabs.

## Funcionalidades

- **Envio de Mensagens e Chatbot**: conversas alimentadas por LLM local (Ollama), respondendo a comandos e perguntas.
- **Transcrição de Áudio**: converte mensagens de voz em texto utilizando o Whisper.
- **Comandos por Áudio**: o LLM interpreta gravações e mapeia para os comandos do bot.
- **Descrição de Imagens**: analisa imagens recebidas e fornece descrições ou estimativas de calorias.
- **Agendamento de Lembretes**: armazena lembretes em MongoDB e envia as mensagens programadas no horário marcado.
- **Respostas em Áudio (TTS)**: opcionalmente gera áudio com a ElevenLabs para respostas por voz.
- **API REST**: integração externa pelos endpoints `/send-message`, `/health` e `/dashboard`.

Os principais comandos podem ser vistos no menu do aplicativo ou acessando o dashboard.

## Requisitos

- Node.js 18 ou superior
- MongoDB acessível para armazenar agendamentos
- `ffmpeg` instalado no sistema (necessário para transcrição de áudio)
- Conta e chave da [ElevenLabs](https://elevenlabs.io/) para recursos de voz (opcional)
- [Ollama](https://ollama.ai/) instalado para executar o modelo local de LLM

## Instalação

1. **Clone o repositório**

   ```bash
   git clone <repo-url>
   cd secrebot
   ```

2. **Instale as dependências**

   ```bash
   npm install
   ```
   
3. **Instale o MongoDB** (Ubuntu/Debian)

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

4. **Instale o Ollama** (Linux/macOS)

   ```bash
   curl -L https://ollama.com/install.sh | sh
   ```
   Após instalado, baixe um modelo (ex.: llama3) e inicie o servidor:
   ```bash
   ollama run llama3
   # ou apenas "ollama serve" para manter em segundo plano
   ```

5. **Configure as variáveis de ambiente** (crie um arquivo `.env` ou exporte no shell):


   ```bash
   MONGO_URI=mongodb://<usuario>:<senha>@<host>:<porta>/
   PORT=3000
   ELEVENLABS_API_KEY=<sua_chave>
   ELEVENLABS_VOICE_ID=<voice_id>
   ```

   Esses valores são lidos em `src/config/index.js` e permitem personalizar a conexão com o banco, a porta do servidor e o uso de TTS.

6. **Inicie o bot**

   ```bash
   npm start
   ```

   Um QR Code será exibido no terminal. Escaneie com o WhatsApp para autenticar o bot. A API REST ficará disponível em `http://localhost:3000` (ou na porta configurada).

## Utilização

Após iniciar, envie `!menu` ou os atalhos numéricos para ver as opções. Entre as funções disponíveis estão:

- `!agendabot` para criar lembretes
- `!listaragendamentos` para listar
- `!deletaragendamento` para remover
- `!transcrever` para modo de transcrição de áudio
- `!foto` ou `!calorias` enviados com uma imagem
- `!voz` para alternar respostas por voz ou texto

O endpoint `/dashboard` oferece uma página simples com as informações do bot e comandos disponíveis.


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
