# 📱 SecreBot - Telegram Bot

## 🚀 Configuração do Bot do Telegram

### 1. Criar o Bot no Telegram

1. Abra o Telegram e procure por `@BotFather`
2. Envie `/newbot` para criar um novo bot
3. Escolha um nome para seu bot (ex: "SecreBot Assistente")
4. Escolha um username único (ex: "secrebot_assistente_bot")
5. Copie o **token** fornecido pelo BotFather

### 2. Configurar o .env

Adicione as seguintes linhas ao seu arquivo `.env`:

```bash
# 📱 ===== TELEGRAM BOT =====
TELEGRAM_BOT_TOKEN=seu_token_aqui

# Configurações gerais
TELEGRAM_ENABLE_TTS=true
TELEGRAM_MAX_FILE_SIZE=20971520

# 🎛️ ===== FEATURE TOGGLES TELEGRAM =====
# Features básicas (habilitadas por padrão)
TELEGRAM_FEATURE_AI_CHAT=true
TELEGRAM_FEATURE_SCHEDULER=true
TELEGRAM_FEATURE_AUDIO_TRANSCRIPTION=true
TELEGRAM_FEATURE_IMAGE_ANALYSIS=true
TELEGRAM_FEATURE_VIDEO_SUMMARY=true
TELEGRAM_FEATURE_TEXT_SUMMARY=true
TELEGRAM_FEATURE_TTS=true
TELEGRAM_FEATURE_MEDIA_PROCESSING=true
TELEGRAM_FEATURE_SYSTEM_RESOURCES=true

# Features que requerem configuração adicional
TELEGRAM_FEATURE_CALORIE_COUNTER=false
TELEGRAM_FEATURE_LINKEDIN_ANALYSIS=false
TELEGRAM_FEATURE_PROFESSIONAL_ANALYSIS=false
```

### 3. Inicializar o Bot

```bash
npm start
```

Se configurado corretamente, você verá:
```
✅ Bot do Telegram ativo e pronto para uso
```

## 🎮 Como Usar o Bot

### Comandos Básicos

- `/start` - Menu principal
- `/help` - Ajuda detalhada

### 🗂️ Estrutura do Menu

```
🤖 SECREBOT - MENU PRINCIPAL

🧠 IA & Chat          📅 Agenda
🎬 Mídia             💼 Análise  
⚙️ Configurações      ❓ Ajuda
```

#### 🧠 IA & Chat
- **💬 Chat Assistente**: Conversas com IA
- **📄 Resumir Texto**: Resume textos ou documentos
- **🖼️ Analisar Imagem**: Análise detalhada de imagens
- **🎥 Resumir Vídeo**: Resumo de vídeos do YouTube

#### 📅 Agenda
- **➕ Criar Lembrete**: Agendar compromissos
- **📋 Listar Lembretes**: Ver agendamentos
- **🗑️ Deletar Lembrete**: Remover agendamentos

#### 🎬 Mídia
- **🎤 Transcrever Áudio**: Converter áudio em texto
- **🔊 Configurar Voz**: Ajustes de TTS
- **🍎 Calcular Calorias**: Contar calorias em fotos de comida

#### 💼 Análise
- **🔗 Analisar LinkedIn**: Análise de perfis profissionais
- **📊 Recursos Sistema**: Status do servidor

#### ⚙️ Configurações
- **🤖 Modelos IA**: Gerenciar modelos Ollama
- **🎤 Modelos Whisper**: Configurar transcrição
- **🔧 Feature Toggles**: Ver funcionalidades ativas

## 🎯 Funcionalidades por Tipo de Conteúdo

### 📝 Mensagens de Texto
- **Chat direto**: Envie qualquer texto para conversar com IA
- **Comandos específicos**: Use o menu para funcionalidades direcionadas

### 🎤 Mensagens de Áudio
- **Transcrição automática**: O bot converte automaticamente áudio em texto
- **Suporte a múltiplos idiomas**: Configurável via Whisper

### 🖼️ Imagens
- **Análise automática**: Descrição detalhada da imagem
- **Contagem de calorias**: Para fotos de comida (se habilitado)
- **Detecção de texto**: OCR integrado

### 📄 Documentos
- **PDF, DOCX, TXT**: Resumo automático de documentos
- **Limite de 20MB**: Arquivos maiores serão rejeitados

## 🎛️ Feature Toggles

### Por Usuário (MongoDB)
Cada usuário pode ter configurações personalizadas armazenadas no banco:

```javascript
{
  "userId": "123456789",
  "features": {
    "ai_chat": true,
    "scheduler": true,
    "audio_transcription": false,
    // ...
  }
}
```

### Global (ENV)
Configurações aplicadas a todos os usuários:

```bash
# Para desabilitar uma feature globalmente
TELEGRAM_FEATURE_AI_CHAT=false

# Para habilitar (padrão para a maioria)
TELEGRAM_FEATURE_SCHEDULER=true
```

### Prioridade de Configuração
1. **Configuração do usuário (MongoDB)** - Maior prioridade
2. **Configuração de ambiente (.env)** - Média prioridade  
3. **Configuração padrão** - Menor prioridade

## 🔧 Configurações Avançadas

### Dependências de Features

Algumas funcionalidades requerem configurações adicionais:

```bash
# Para habilitar contagem de calorias
CALORIE_API_KEY=sua_chave_api_ninjas
TELEGRAM_FEATURE_CALORIE_COUNTER=true

# Para análise de LinkedIn
LINKEDIN_USER=seu_email
LINKEDIN_PASS=sua_senha
TELEGRAM_FEATURE_LINKEDIN_ANALYSIS=true

# Para TTS com ElevenLabs
ELEVENLABS_API_KEY=sua_chave
TELEGRAM_FEATURE_TTS=true
```

### Webhook vs Polling

Por padrão, o bot usa **polling**. Para produção, considere usar **webhook**:

```bash
TELEGRAM_WEBHOOK_URL=https://seu-dominio.com/webhook
```

## 📊 Monitoramento

### Logs do Telegram Bot

```bash
# Ver logs em tempo real
tail -f logs/app.log | grep -i telegram

# Logs específicos do bot
grep "Telegram" logs/app.log
```

### Status das Funcionalidades

Use o comando `/start` → `⚙️ Configurações` → `🔧 Feature Toggles` para ver quais funcionalidades estão ativas para seu usuário.

## 🚨 Solução de Problemas

### Bot não responde
1. Verifique se o token está correto no `.env`
2. Confirme que o bot não está pausado no BotFather
3. Verifique os logs para erros de conexão

### Features não funcionam
1. Verifique as dependências (Ollama, MongoDB, etc.)
2. Confirme se a feature está habilitada no `.env`
3. Teste as funcionalidades individuais

### Erro de permissões
1. Verifique se o bot tem permissões para ler mensagens
2. Confirme que o bot foi adicionado ao chat/grupo correto

## 🔄 Atualizações

### Adicionar Nova Feature

1. **Atualizar enum de features**:
```javascript
// src/services/featureToggleService.js
const DEFAULT_FEATURES = {
  // ...
  nova_feature: false
};
```

2. **Adicionar ao .env**:
```bash
TELEGRAM_FEATURE_NOVA_FEATURE=true
```

3. **Implementar no menu**:
```javascript
// src/core/telegramBot.js
case 'nova_feature':
  await this.processNovaFeature(chatId, input);
  break;
```

### Backup da Configuração

```bash
# Backup das configurações do MongoDB
mongodump --db sched --collection telegram_features

# Restaurar
mongorestore --db sched --collection telegram_features dump/sched/telegram_features.bson
```

## 📱 Comandos do BotFather

Para configurar o bot no Telegram:

```
/setcommands

start - Menu principal do SecreBot
help - Ajuda e documentação
```

```
/setdescription
Assistente inteligente com IA, agendamentos, transcrição e muito mais! 🤖✨
```

```
/setabouttext
SecreBot - Seu assistente pessoal com IA local, transcrição de áudio, análise de imagens e agendamentos inteligentes.
```

## 🔐 Segurança

### Proteção do Token
- **Nunca** compartilhe o token do bot
- Use variáveis de ambiente, não hardcode no código
- Considere usar secrets managers em produção

### Validação de Usuários
Para restringir o acesso, adicione uma lista de usuários autorizados:

```bash
TELEGRAM_ALLOWED_USERS=123456789,987654321
```

### Rate Limiting
O bot implementa controles básicos de rate limiting para evitar spam.

---

🎉 **Pronto!** Seu bot do Telegram está configurado e funcionando com todas as funcionalidades do SecreBot!

Para suporte adicional, consulte o README principal ou abra uma issue no GitHub.