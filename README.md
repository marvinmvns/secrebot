# Secrebot

Secrebot é um assistente para WhatsApp construído em Node.js com uma estrutura modular. O projeto integra serviços de transcrição de áudio (Whisper), LLM para respostas automáticas, agendamento de mensagens e geração de voz usando a API da ElevenLabs.

## Funcionalidades

- **Envio de Mensagens e Chatbot**: responde a comandos e perguntas via WhatsApp.
- **Transcrição de Áudio**: converte mensagens de voz em texto utilizando o Whisper.
- **Descrição de Imagens**: analisa imagens e fornece descrições detalhadas ou estimativa de calorias.
- **Agendamento de Lembretes**: armazena lembretes em MongoDB e envia as mensagens na hora marcada.
- **Respostas em Áudio (TTS)**: opcionalmente gera áudio com a ElevenLabs para respostas por voz.
- **API REST**: disponível para integrações externas com endpoints `/send-message`, `/health` e `/dashboard`.

Os principais comandos podem ser vistos na aplicação ou acessando o dashboard.

## Requisitos

- Node.js 18 ou superior
- MongoDB acessível para armazenar agendamentos
- `ffmpeg` instalado no sistema (necessário para a transcrição de áudio)
- Conta e chave de API da [ElevenLabs](https://elevenlabs.io/) para recursos de voz (opcional)

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

3. **Configure as variáveis de ambiente** (crie um arquivo `.env` ou exporte no shell):

   ```bash
   MONGO_URI=mongodb://<usuario>:<senha>@<host>:<porta>/
   PORT=3000
   ELEVENLABS_API_KEY=<sua_chave>
   ELEVENLABS_VOICE_ID=<voice_id>
   ```

   Esses valores são lidos em `src/config/index.js` e permitem personalizar a conexão com o banco, a porta do servidor e o uso de TTS.

4. **Inicie o bot**

   ```bash
   npm start
   ```

   Será exibido um QR Code no terminal. Escaneie com o WhatsApp para autenticar o bot. A API REST ficará disponível em `http://localhost:3000` (ou na porta configurada).

## Utilização

Após iniciar, envie `!menu` ou os atalhos numéricos para ver as opções. Entre as funções disponíveis estão:

- `!agendabot` para criar lembretes
- `!listaragendamentos` para listar
- `!deletaragendamento` para remover
- `!transcrever` para modo de transcrição de áudio
- `!foto` ou `!calorias` enviados com uma imagem
- `!voz` para alternar respostas por voz ou texto

O endpoint `/dashboard` oferece uma página simples com as informações do bot e comandos disponíveis.

## Estrutura do Projeto

- `src/app.js` – ponto de entrada que inicializa os serviços, o bot e a API REST
- `src/core/whatsAppBot.js` – lógica principal do bot e dos comandos
- `src/services/` – serviços auxiliares (LLM, transcrição, TTS, scheduler)
- `src/api/restApi.js` – implementação da API Express
- `src/config/` – definições de configuração e mensagens padrão
- `src/utils/` – funções utilitárias

## Licença

Distribuído sob a licença ISC conforme definido no `package.json`.
