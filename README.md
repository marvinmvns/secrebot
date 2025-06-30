<div align="center">

# 🤖 SecreBot

**Assistente Inteligente para WhatsApp com IA Avançada**

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6.0+-brightgreen.svg)](https://www.mongodb.com/)
[![Ollama](https://img.shields.io/badge/Ollama-Compatible-blue.svg)](https://ollama.com/)
[![Whisper](https://img.shields.io/badge/Whisper-Enabled-orange.svg)](https://openai.com/research/whisper)
[![License](https://img.shields.io/badge/License-ISC-red.svg)](LICENSE)

*Um bot WhatsApp completo com IA local, transcrição de áudio, análise de imagens, agendamentos inteligentes e muito mais!*

[🚀 Instalação Rápida](#-instalação-rápida) •
[📖 Documentação](#-documentação-completa) •
[🎯 Funcionalidades](#-funcionalidades) •
[💡 Exemplos](#-exemplos-de-uso) •
[🆘 Suporte](#-suporte-e-solução-de-problemas)

</div>

---

## 📦 Instalação Automática

### 🚀 Scripts de Instalação Disponíveis

**🐧 `install-secrebot-linux.sh`**
- **Plataformas:** Ubuntu, Debian, CentOS, RHEL, Fedora, Arch Linux
- **Requisitos:** Bash, sudo, conexão à internet
- **Tempo estimado:** 10-20 minutos

**🪟 `install-secrebot-windows.bat`**
- **Plataformas:** Windows 10/11, Windows Server 2019/2022
- **Requisitos:** Privilégios de administrador, conexão à internet
- **Tempo estimado:** 15-25 minutos

### 🐧 Instalação Automática Linux

```bash
# 1. Baixar o script
wget https://raw.githubusercontent.com/seu-usuario/secrebot/main/install-secrebot-linux.sh

# 2. Dar permissão de execução
chmod +x install-secrebot-linux.sh

# 3. Executar (NÃO usar sudo)
./install-secrebot-linux.sh
```

**📋 O que o script Linux faz automaticamente:**
1. ✅ **Verificações preliminares** - Privilegios, internet, espaço em disco, memória
2. 📦 **Dependências** - Node.js, MongoDB, Python, FFmpeg, Git
3. 🗄️ **MongoDB** - Instalação, configuração de usuário, teste de conectividade  
4. 🤖 **Ollama** - Instalação e download dos modelos LLM essenciais
5. 🎤 **Whisper** - Configuração automática para transcrição de áudio
6. 📱 **SecreBot** - Clone do projeto, instalação NPM, configuração .env
7. 🎤 **Piper TTS** - Instalação local gratuita para text-to-speech
8. ✅ **Validação** - Testes de todos os serviços e conectividade

### 🪟 Instalação Automática Windows

1. **Baixar:** `install-secrebot-windows.bat`
2. **Executar como Administrador:** Clique com botão direito > "Executar como administrador"

**📋 O que o script Windows faz automaticamente:**
1. ✅ **Verificações preliminares** - Privilégios admin, internet, espaço, memória
2. 📦 **Chocolatey** - Instalação do gerenciador de pacotes
3. 📦 **Dependências** - Node.js, Python, Git, FFmpeg, MongoDB
4. 🗄️ **MongoDB** - Configuração como serviço Windows
5. 🤖 **Ollama** - Instalação Windows e download de modelos
6. 🎤 **Whisper** - Configuração automática para transcrição
7. 📱 **SecreBot** - Setup completo do projeto
8. 🎤 **Piper TTS** - Download automático com voz Cadu (português)
9. ✅ **Validação** - Verificação de todos os componentes

**✅ Novo:** Piper TTS agora está disponível no Windows com instalação automática!

### 🎯 Distribuições/Versões Suportadas

| Sistema | Versões | Status |
|---------|---------|---------|
| Ubuntu | 18.04+ | ✅ Testado |
| Debian | 10+ | ✅ Testado |
| CentOS | 8+ | ✅ Suportado |
| RHEL | 8+ | ✅ Suportado |
| Fedora | 35+ | ✅ Suportado |
| Arch Linux | Rolling | ✅ Suportado |
| Windows 11 | - | ✅ Recomendado |
| Windows 10 | 1903+ | ✅ Suportado |
| Windows Server | 2019/2022 | ✅ Suportado |

### ✅ Verificação Pós-Instalação

**Linux:**
```bash
# Status dos serviços
systemctl status mongod
pgrep -f "ollama serve"

# Testar conectividade
curl -s http://127.0.0.1:11434/api/tags
mongosh --eval "db.runCommand({ping: 1})"
```

**Windows:**
```batch
# Status dos serviços
sc query MongoDB
tasklist | findstr ollama

# Testar conectividade
curl -s http://127.0.0.1:11434/api/tags
mongosh --eval "db.runCommand({ping: 1})"
```

### 🚀 Primeiro Uso Após Instalação

```bash
# Navegar para o diretório
cd ~/secrebot        # Linux
cd /d %USERPROFILE%\secrebot  # Windows

# Iniciar o SecreBot
npm start

# Escanear QR Code com WhatsApp
# Testar com: !menu
```

---

## 📋 Índice

<details>
<summary>Clique para expandir o índice completo</summary>

- [✨ Visão Geral](#-visão-geral)
- [🎯 Funcionalidades](#-funcionalidades)
  - [🧠 Inteligência Artificial](#-inteligência-artificial)
  - [🎤 Processamento de Áudio](#-processamento-de-áudio)
  - [🖼️ Análise Visual](#️-análise-visual)
  - [📅 Sistema de Agendamentos](#-sistema-de-agendamentos)
  - [💼 Ferramentas Profissionais](#-ferramentas-profissionais)
  - [🌐 Interface Web](#-interface-web)
- [📋 Requisitos](#-requisitos)
- [🚀 Instalação Rápida](#-instalação-rápida)
- [⚙️ Configuração Detalhada](#️-configuração-detalhada)
- [📱 Como Usar](#-como-usar)
  - [🎮 Menu Hierárquico](#-menu-hierárquico)
  - [🗣️ Comandos por Voz](#️-comandos-por-voz)
  - [💡 Exemplos de Uso](#-exemplos-de-uso)
- [🔧 Configurações Avançadas](#-configurações-avançadas)
  - [🤖 Gerenciamento de Modelos IA](#-gerenciamento-de-modelos-ia)
  - [🎤 Modelos Whisper](#-modelos-whisper)
  - [🔊 Text-to-Speech (TTS)](#-text-to-speech-tts)
- [🌐 API REST](#-api-rest)
- [🖥️ Interface Web](#️-interface-web-1)
- [🗄️ Banco de Dados](#️-banco-de-dados)
- [🐳 Docker](#-docker)
- [📁 Estrutura do Projeto](#-estrutura-do-projeto)
- [🧪 Testes](#-testes)
- [🆘 Suporte e Solução de Problemas](#-suporte-e-solução-de-problemas)
- [🤝 Contribuindo](#-contribuindo)
- [📄 Licença](#-licença)

</details>

---

## ✨ Visão Geral

**SecreBot** é um assistente inteligente completo para WhatsApp que combina:

🧠 **IA Local** com Ollama para conversas naturais  
🎤 **Transcrição** de áudio com múltiplos modelos Whisper  
🖼️ **Análise de imagens** e contagem de calorias  
📅 **Agendamentos** inteligentes com MongoDB  
💼 **Integrações** com LinkedIn, YouTube e Google Calendar  
🌐 **Interface web** para gerenciamento completo  

### 🎯 Por que usar o SecreBot?

- ✅ **100% Local**: IA rodando em sua máquina, sem enviar dados para terceiros
- ✅ **Fácil de usar**: Menu hierárquico intuitivo com atalhos numéricos
- ✅ **Extensível**: Arquitetura modular para adicionar novas funcionalidades
- ✅ **Completo**: Desde conversas simples até análises profissionais complexas
- ✅ **Gratuito**: Sem limites de uso ou custos de API (exceto integrações opcionais)

---

## 🎯 Funcionalidades

### 🧠 Inteligência Artificial

<table>
<tr>
<td width="60%">

**🤖 Chat Assistente Avançado**
- Conversas contextuais com memória
- Múltiplos modelos LLM locais via Ollama
- Respostas inteligentes e personalizadas
- Troca de modelos em tempo real

**🔄 Gerenciamento de Modelos**
- ✅ **Listar modelos** disponíveis no Ollama
- ✅ **Trocar modelo** ativo (texto/imagem)
- ✅ **Detecção automática** de tipo de modelo
- ✅ **Reinício inteligente** para limpeza completa

</td>
<td width="40%">

```
📱 Menu: 2️⃣ INTELIGÊNCIA ARTIFICIAL

2.1 💬 Chat Assistente (Deep)
2.2 📄 Resumir Texto/Arquivo  
2.3 🎥 Resumir Vídeo
2.4 🖼️ Analisar Imagem

🔧 Configurações:
5.3 🤖 Listar Modelos IA
5.4 🔄 Trocar Modelo IA
```

</td>
</tr>
</table>

### 🎤 Processamento de Áudio

<table>
<tr>
<td width="60%">

**🗣️ Transcrição Inteligente**
- Transcrição via Whisper com 11 modelos disponíveis
- Reconhecimento de comandos por voz
- Suporte a múltiplos idiomas
- Escolha de modelo baseada na necessidade

**🔊 Text-to-Speech (TTS)**
- Respostas em áudio via ElevenLabs ou Piper local
- Configuração por usuário (texto/voz)
- Múltiplas vozes e idiomas

</td>
<td width="40%">

```
🎤 Modelos Whisper Disponíveis:

⚡ Rápidos: tiny, tiny.en
🚀 Equilibrio: base, small  
🎯 Qualidade: medium, large
🏆 Máxima: large-v3-turbo

🔧 Configurações:
5.5 🎤 Listar Modelos Whisper
5.6 🔄 Trocar Modelo Whisper
```

</td>
</tr>
</table>

### 🖼️ Análise Visual

- **📸 Descrição de imagens**: Análise detalhada de fotos enviadas
- **🍎 Contador de calorias**: Estimativa nutricional baseada em imagens
- **🔍 Análise avançada**: Detecção de objetos, textos e contextos

### 📅 Sistema de Agendamentos

- **⏰ Lembretes inteligentes**: Criação em linguagem natural
- **📋 Gerenciamento completo**: Listar, editar, deletar via WhatsApp ou web
- **🔄 Persistência**: Armazenamento seguro em MongoDB
- **📅 Importação**: Suporte a arquivos .ics do Google Calendar

### 💼 Ferramentas Profissionais

- **🔗 LinkedIn**: Análise automática de perfis profissionais
- **🎥 YouTube**: Transcrição e resumo de vídeos
- **📊 Recursos do Sistema**: Monitoramento em tempo real

### 🌐 Interface Web

- **📊 Dashboard**: Visão geral de agendamentos e estatísticas
- **⚙️ Configurações**: Editor visual de variáveis de ambiente
- **🗨️ Chat Web**: Interface de conversa no navegador
- **📁 Upload de arquivos**: Análise de documentos, imagens e áudios

---

## 📋 Requisitos

### ✅ Obrigatórios

<table>
<tr>
<td width="25%"><strong>🟢 Node.js</strong></td>
<td width="25%">18.0+</td>
<td width="50%">Runtime JavaScript</td>
</tr>
<tr>
<td><strong>🟢 MongoDB</strong></td>
<td>6.0+</td>
<td>Banco de dados para agendamentos</td>
</tr>
<tr>
<td><strong>🟢 FFmpeg</strong></td>
<td>Qualquer versão</td>
<td>Processamento de áudio</td>
</tr>
<tr>
<td><strong>🟢 Ollama</strong></td>
<td>Última versão</td>
<td>Modelos LLM locais</td>
</tr>
</table>

### 🔶 Opcionais (mas recomendados)

<table>
<tr>
<td width="25%"><strong>🔶 Piper</strong></td>
<td width="25%">Auto-install</td>
<td width="50%">TTS local gratuito</td>
</tr>
<tr>
<td><strong>🔶 yt-dlp</strong></td>
<td>Última versão</td>
<td>Fallback para YouTube</td>
</tr>
<tr>
<td><strong>🔶 ElevenLabs</strong></td>
<td>API Key</td>
<td>TTS premium (pago)</td>
</tr>
<tr>
<td><strong>🔶 API Ninjas</strong></td>
<td>API Key</td>
<td>Contagem de calorias</td>
</tr>
</table>

---

## 🚀 Instalação Rápida

### 🎯 Para Iniciantes (Copy-Paste)

```bash
# 1. Clone o projeto
git clone https://github.com/seu-usuario/secrebot.git
cd secrebot

# 2. Instale dependências
npm install
npx playwright install

# 3. Configure banco de dados
sudo apt update && sudo apt install mongodb -y
sudo systemctl start mongodb
sudo systemctl enable mongodb

# 4. Configure Ollama
curl -fsSL https://ollama.com/install.sh | sh
ollama serve &
ollama pull llama3.2:latest

# 5. Configure ambiente
cp .env.example .env
nano .env  # Edite as configurações

# 6. Inicie o bot
npm start
```

### 🔧 Para Usuários Avançados

<details>
<summary>Instalação detalhada passo a passo</summary>

#### 1️⃣ **Preparar Ambiente**

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y nodejs npm mongodb ffmpeg build-essential

# CentOS/RHEL
sudo dnf install -y nodejs npm mongodb-server ffmpeg gcc-c++ make

# macOS
brew install node mongodb ffmpeg
```

#### 2️⃣ **Configurar MongoDB**

```bash
# Iniciar serviço
sudo systemctl start mongod
sudo systemctl enable mongod

# Criar usuário
mongosh
use sched
db.createUser({
  user: "bot",
  pwd: "sua_senha_segura",
  roles: ["readWrite"]
})
exit
```

#### 3️⃣ **Instalar Ollama**

```bash
# Instalação automática
curl -fsSL https://ollama.com/install.sh | sh

# Baixar modelos recomendados
ollama pull llama3.2:latest       # Chat geral
ollama pull llava:latest          # Análise de imagens
ollama pull granite3.2:latest     # Alternativa leve
```

#### 4️⃣ **Configurar Whisper**

```bash
# Whisper será configurado automaticamente
# Mas você pode pré-baixar modelos:
npx nodejs-whisper download base
```

</details>

---

## ⚙️ Configuração Detalhada

### 📝 Arquivo .env

Crie o arquivo `.env` na raiz do projeto:

<details>
<summary>📋 Configuração Completa (.env)</summary>

```bash
# 🔧 ===== CONFIGURAÇÕES BÁSICAS =====
PORT=3000
NODE_ENV=development

# 🗄️ ===== BANCO DE DADOS =====
MONGO_URI=mongodb://bot:sua_senha@localhost:27017/sched?authSource=sched

# 🤖 ===== OLLAMA/LLM =====
OLLAMA_HOST=http://127.0.0.1:11434
OLLAMA_TIMEOUT_MS=600000  # 10 minutos
LLM_MODEL=llama3.2:latest
LLM_IMAGE_MODEL=llava:latest
LLM_MAX_TOKENS=3000
LLM_CONCURRENCY=2

# 🎤 ===== AUDIO/WHISPER =====
WHISPER_MODEL=large-v3-turbo
AUDIO_LANGUAGE=pt
AUDIO_SAMPLE_RATE=16000
WHISPER_TIMEOUT_MS=120000
WHISPER_CONCURRENCY=1

# 🔊 ===== TEXT-TO-SPEECH =====
# Opção 1: ElevenLabs (Pago, melhor qualidade)
ELEVENLABS_API_KEY=sua_chave_elevenlabs
ELEVENLABS_VOICE_ID=seu_voice_id
ELEVENLABS_MODEL_ID=eleven_multilingual_v2

# Opção 2: Piper (Gratuito, local)
PIPER_ENABLED=true
PIPER_EXECUTABLE=./piper/piper-wrapper.sh
PIPER_MODEL=./piper/models/pt_BR-faber-medium.onnx

# 🧠 ===== PROCESSAMENTO =====
QUEUE_MEM_THRESHOLD_GB=4
MEM_CHECK_INTERVAL=1000
DYNAMIC_CONCURRENCY=false

# 📅 ===== AGENDAMENTOS =====
SCHED_INTERVAL=30000
SCHED_MAX_ATTEMPTS=3
SCHED_RETRY_DELAY=7200000
SCHED_CONCURRENCY=5
SCHED_MAX_CONCURRENCY=10
SCHED_CPU_THRESHOLD=0.7
SCHED_MEM_THRESHOLD=0.8

# 🔗 ===== INTEGRAÇÕES EXTERNAS =====
# API Ninjas (Calorias)
CALORIE_API_URL=https://api.api-ninjas.com/v1/nutrition?query=
CALORIE_API_KEY=sua_chave_ninjas

# LinkedIn
LINKEDIN_USER=seu_email@exemplo.com
LINKEDIN_PASS=sua_senha_linkedin
LINKEDIN_LI_AT=cookie_li_at_opcional
LINKEDIN_TIMEOUT_MS=30000

# Google Calendar
GOOGLE_CLIENT_ID=seu_client_id
GOOGLE_CLIENT_SECRET=seu_client_secret
GOOGLE_REDIRECT=http://localhost:3000/oauth2callback
```

</details>

### 🎤 Instalação TTS Local (Piper)

O **Piper** oferece TTS gratuito e local. Use nosso instalador automático:

```bash
# Instalação recomendada (script simplificado)
chmod +x scripts/install-piper-simple.sh
./scripts/install-piper-simple.sh

# Configurar no .env
echo "PIPER_ENABLED=true" >> .env
echo "PIPER_EXECUTABLE=./piper/piper-wrapper.sh" >> .env
echo "PIPER_MODEL=./piper/models/pt_BR-faber-medium.onnx" >> .env

# Testar instalação
echo "Olá, teste do Piper" | ./piper/piper-wrapper.sh --output_file teste.wav
```

<details>
<summary>🔧 Opções avançadas do Piper</summary>

```bash
# Instalação via Makefile
make install-piper

# Script com dependências (não recomendado)
./scripts/install-piper.sh

# Instalação manual para arquiteturas específicas
wget https://github.com/rhasspy/piper/releases/download/v1.2.0/piper_amd64.tar.gz
tar -xzf piper_amd64.tar.gz
sudo mv piper/piper /usr/local/bin/
```

</details>

---

## 📱 Como Usar

### 🎮 Menu Hierárquico

O SecreBot usa um **sistema de menu hierárquico** com até 3 níveis de navegação:

```
🤖 SECREBOT - MENU PRINCIPAL

1️⃣ 📅 AGENDA & LEMBRETES
2️⃣ 🧠 INTELIGÊNCIA ARTIFICIAL  
3️⃣ 🎬 MÍDIA & CONTEÚDO
4️⃣ 💼 ANÁLISE PROFISSIONAL
5️⃣ ⚙️ CONFIGURAÇÕES
6️⃣ 📞 SUPORTE & SISTEMA
```

#### 📋 Menu Completo

<details>
<summary>🗂️ Estrutura completa do menu</summary>

```
1️⃣ 📅 AGENDA & LEMBRETES
├── 1.1 ➕ Criar Agendamento
├── 1.2 📋 Listar Agendamentos  
├── 1.3 🗑️ Deletar Agendamento
└── 1.4 📥 Importar Agenda (.ics)

2️⃣ 🧠 INTELIGÊNCIA ARTIFICIAL
├── 2.1 💬 Chat Assistente (Deep)
├── 2.2 📄 Resumir Texto/Arquivo
├── 2.3 🎥 Resumir Vídeo
│   ├── 2.3.1 🚀 Transcrição Automática (YouTube)
│   └── 2.3.2 🎯 Whisper IA (Mais Preciso)
└── 2.4 🖼️ Analisar Imagem

3️⃣ 🎬 MÍDIA & CONTEÚDO  
├── 3.1 🎤 Transcrever Áudio
├── 3.2 🔊 Ativar/Desativar Voz
└── 3.3 🍎 Calcular Calorias (Foto)

4️⃣ 💼 ANÁLISE PROFISSIONAL
└── 4.1 🔗 Analisar LinkedIn

5️⃣ ⚙️ CONFIGURAÇÕES
├── 5.1 🔊 Modo de Resposta (Texto/Voz)
├── 5.2 ⚡ Recursos do Sistema
├── 5.3 🤖 Listar Modelos IA
├── 5.4 🔄 Trocar Modelo IA
├── 5.5 🎤 Listar Modelos Whisper
├── 5.6 🔄 Trocar Modelo Whisper
├── 5.7 🔄 Reiniciar Ollama
└── 5.8 🎤 Reiniciar Whisper

6️⃣ 📞 SUPORTE & SISTEMA
├── 6.1 📖 Ajuda Detalhada
└── 6.2 ⚡ Recursos do Sistema
```

</details>

### 🗣️ Comandos por Voz

O bot reconhece comandos falados! Envie um áudio dizendo:

- 🗣️ *"Menu principal"* → Abre o menu
- 🗣️ *"Criar lembrete"* → Ativa modo de agendamento
- 🗣️ *"Conversar com IA"* → Inicia chat assistente
- 🗣️ *"Transcrever áudio"* → Ativa modo transcrição

### 💡 Exemplos de Uso

<table>
<tr>
<th width="30%">🎯 Funcionalidade</th>
<th width="35%">📱 Como usar</th>
<th width="35%">💬 Exemplo</th>
</tr>

<tr>
<td><strong>📅 Criar Lembrete</strong></td>
<td>Digite <code>1.1</code> ou <code>!agendabot</code></td>
<td><em>"Reunião importante amanhã às 14:00 sobre projeto X"</em></td>
</tr>

<tr>
<td><strong>🤖 Chat com IA</strong></td>
<td>Digite <code>2.1</code> ou <code>!deep</code></td>
<td><em>"Como posso melhorar minha produtividade no trabalho?"</em></td>
</tr>

<tr>
<td><strong>🎤 Transcrever Áudio</strong></td>
<td>Digite <code>3.1</code> ou <code>!transcrever</code><br>Depois envie um áudio</td>
<td>🎙️ <em>[Enviar mensagem de voz]</em></td>
</tr>

<tr>
<td><strong>📄 Resumir Documento</strong></td>
<td>Digite <code>2.2</code> ou <code>!resumir</code><br>Envie arquivo PDF/DOCX</td>
<td>📎 <em>[Anexar documento.pdf]</em></td>
</tr>

<tr>
<td><strong>🖼️ Analisar Imagem</strong></td>
<td>Digite <code>2.4</code> ou <code>!foto</code><br>Envie uma foto</td>
<td>🖼️ <em>[Anexar imagem.jpg]</em></td>
</tr>

<tr>
<td><strong>🍎 Calcular Calorias</strong></td>
<td>Digite <code>3.3</code> ou <code>!calorias</code><br>Envie foto da comida</td>
<td>🍽️ <em>[Foto da refeição]</em></td>
</tr>

<tr>
<td><strong>🔗 Analisar LinkedIn</strong></td>
<td>Digite <code>4.1</code> ou <code>!linkedin</code></td>
<td><em>"linkedin.com/in/seuperfil"</em></td>
</tr>

<tr>
<td><strong>🎥 Resumir YouTube</strong></td>
<td>Digite <code>2.3.1</code> ou <code>!resumirvideo</code></td>
<td><em>"youtube.com/watch?v=abc123"</em></td>
</tr>

</table>

---

## 🔧 Configurações Avançadas

### 🤖 Gerenciamento de Modelos IA

O SecreBot permite **trocar modelos Ollama** em tempo real:

```
📱 Menu: 5.3 🤖 Listar Modelos IA

🔄 MODELOS DISPONÍVEIS:

1. llama3.2:latest ✅ (atual-texto)
   🏷️ llama (8B parâmetros)

2. llava:latest 🖼️ (atual-imagem)  
   🏷️ llava (7B parâmetros)

3. granite3.2:latest
   🏷️ granite (3B parâmetros)
```

**Trocar modelo:**
```
📱 Menu: 5.4 🔄 Trocar Modelo IA

Digite o número do modelo desejado: 3

✅ Modelo alterado para granite3.2:latest
```

### 🎤 Modelos Whisper

**11 modelos disponíveis** para diferentes necessidades:

<table>
<tr>
<th>🏷️ Modelo</th>
<th>⚡ Velocidade</th>
<th>🎯 Qualidade</th>
<th>🌍 Idioma</th>
<th>💡 Recomendado para</th>
</tr>

<tr>
<td><code>tiny</code></td>
<td>🚀🚀🚀🚀</td>
<td>⭐</td>
<td>Multilíngue</td>
<td>Testes rápidos</td>
</tr>

<tr>
<td><code>tiny.en</code></td>
<td>🚀🚀🚀🚀</td>
<td>⭐⭐</td>
<td>Inglês</td>
<td>Inglês rápido</td>
</tr>

<tr>
<td><code>base</code></td>
<td>🚀🚀🚀</td>
<td>⭐⭐</td>
<td>Multilíngue</td>
<td>Uso geral</td>
</tr>

<tr>
<td><code>small</code></td>
<td>🚀🚀</td>
<td>⭐⭐⭐</td>
<td>Multilíngue</td>
<td>🏆 <strong>Recomendado</strong></td>
</tr>

<tr>
<td><code>medium</code></td>
<td>🚀</td>
<td>⭐⭐⭐⭐</td>
<td>Multilíngue</td>
<td>Alta qualidade</td>
</tr>

<tr>
<td><code>large-v3-turbo</code></td>
<td>🐌</td>
<td>⭐⭐⭐⭐⭐</td>
<td>Multilíngue</td>
<td>Máxima precisão</td>
</tr>

</table>

**Trocar modelo Whisper:**
```
📱 Menu: 5.6 🔄 Trocar Modelo Whisper

🎤 MODELOS DISPONÍVEIS:
1. tiny ⚡ Ultrarrápido
2. small 🚀 Rápido ✅ (atual)
3. large-v3-turbo 🐌 Lento, alta qualidade

Digite o número: 3

✅ Modelo alterado para large-v3-turbo
🎯 Teste: Use !transcrever e envie um áudio
```

### 🔊 Text-to-Speech (TTS)

#### Opção 1: Piper (Local, Gratuito)

```bash
# Instalação automática
./scripts/install-piper-simple.sh

# Configuração no .env
PIPER_ENABLED=true
PIPER_EXECUTABLE=./piper/piper-wrapper.sh
PIPER_MODEL=./piper/models/pt_BR-faber-medium.onnx
```

#### Opção 2: ElevenLabs (Pago, Premium)

```bash
# Configuração no .env
ELEVENLABS_API_KEY=sua_chave
ELEVENLABS_VOICE_ID=seu_voice_id
```

---

## 🌐 API REST

### 📡 Endpoints Principais

<table>
<tr>
<th width="20%">Método</th>
<th width="30%">Endpoint</th>
<th width="50%">Descrição</th>
</tr>

<tr>
<td><code>POST</code></td>
<td><code>/send-message</code></td>
<td>Enviar mensagem via API</td>
</tr>

<tr>
<td><code>GET</code></td>
<td><code>/health</code></td>
<td>Status da aplicação</td>
</tr>

<tr>
<td><code>POST</code></td>
<td><code>/chat</code></td>
<td>Interface de chat web</td>
</tr>

<tr>
<td><code>POST</code></td>
<td><code>/transcribe</code></td>
<td>Upload de áudio para transcrição</td>
</tr>

<tr>
<td><code>POST</code></td>
<td><code>/describe</code></td>
<td>Análise de imagens</td>
</tr>

<tr>
<td><code>POST</code></td>
<td><code>/calories</code></td>
<td>Contador de calorias</td>
</tr>

<tr>
<td><code>GET</code></td>
<td><code>/resources</code></td>
<td>Informações do sistema</td>
</tr>

</table>

### 💻 Exemplos de uso da API

<details>
<summary>📋 Exemplos de requisições</summary>

#### Enviar mensagem
```bash
curl -X POST http://localhost:3000/send-message \
  -H "Content-Type: application/json" \
  -d '{
    "to": "5511999999999",
    "message": "Olá! Como posso ajudar?"
  }'
```

#### Transcrever áudio
```bash
curl -X POST http://localhost:3000/transcribe \
  -F "audio=@audio.wav"
```

#### Analisar imagem
```bash
curl -X POST http://localhost:3000/describe \
  -F "image=@foto.jpg"
```

#### Status da aplicação
```bash
curl http://localhost:3000/health
```

</details>

---

## 🖥️ Interface Web

Acesse **`http://localhost:3000`** para usar a interface web completa:

### 📊 Dashboard (`/`)
- **📋 Agendamentos**: Listar, criar, editar e deletar
- **📈 Estatísticas**: Métricas de uso do bot
- **🚨 Alertas**: Status dos serviços

### 🗨️ Chat Web (`/chat`)
- **💬 Conversa**: Interface similar ao WhatsApp
- **📎 Upload**: Envio de arquivos, imagens e áudios
- **🎯 Comandos**: Todos os recursos disponíveis

### ⚙️ Configurações (`/config`)
- **📝 Editor**: Modificar variáveis de ambiente
- **🔄 Restart**: Reinicialização automática
- **✅ Validação**: Verificar configurações
- **📋 Exemplos**: Campos exibem sugestões de valores

### 📊 Recursos (`/resources`)
- **💻 Sistema**: CPU, memória, disco
- **🔌 Serviços**: Status Ollama, MongoDB, Whisper
- **📈 Performance**: Métricas em tempo real

---

## 🗄️ Banco de Dados

### 📋 Schema de Agendamentos

```json
{
  "_id": "ObjectId",
  "recipient": "5511999999999",
  "message": "Reunião importante às 14h",
  "status": "approved|sent|failed",
  "scheduledTime": "2024-01-01T14:00:00Z",
  "expiryTime": "2024-01-01T15:00:00Z", 
  "sentAt": "2024-01-01T14:00:05Z",
  "attempts": 1,
  "lastAttemptAt": "2024-01-01T14:00:05Z",
  "error": "Mensagem de erro opcional"
}
```

### 🔍 Índices Automáticos

```javascript
// Criados automaticamente na inicialização
db.schedv2.createIndex({ recipient: 1, status: 1 })
db.schedv2.createIndex({ scheduledTime: 1, status: 1, sentAt: 1 })
```

---

## 🐳 Docker

### 🚀 Docker Compose (Recomendado)

```bash
# Iniciar todos os serviços
docker-compose up --build

# Em background
docker-compose up -d --build

# Ver logs
docker-compose logs -f secrebot
```

O **docker-compose.yml** inclui:
- 🗄️ **MongoDB** com persistência
- 🤖 **Ollama** com modelos pré-carregados
- 🤖 **SecreBot** com todas as dependências

### 🔧 Build manual

```bash
# Build da imagem
docker build -t secrebot .

# Executar container
docker run -p 3000:3000 \
  -e MONGO_URI=mongodb://host.docker.internal:27017/sched \
  -e OLLAMA_HOST=http://host.docker.internal:11434 \
  secrebot
```

<details>
<summary>🔧 Docker Compose para produção</summary>

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  secrebot:
    build: .
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - MONGO_URI=mongodb://mongo:27017/sched
      - OLLAMA_HOST=http://ollama:11434
    depends_on:
      - mongo
      - ollama
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data

  mongo:
    image: mongo:6
    restart: unless-stopped
    volumes:
      - mongo_data:/data/db
    environment:
      - MONGO_INITDB_ROOT_USERNAME=admin
      - MONGO_INITDB_ROOT_PASSWORD=password

  ollama:
    image: ollama/ollama:latest
    restart: unless-stopped
    volumes:
      - ollama_data:/root/.ollama
    environment:
      - OLLAMA_HOST=0.0.0.0

volumes:
  mongo_data:
  ollama_data:
```

</details>

---

## 📁 Estrutura do Projeto

```
secrebot/
├── 📂 src/                          # Código fonte principal
│   ├── 📄 app.js                    # 🚀 Ponto de entrada
│   ├── 📂 core/
│   │   └── 📄 whatsAppBot.js        # 🤖 Lógica principal do bot
│   ├── 📂 services/                 # 🔧 Serviços modulares
│   │   ├── 📄 llmService.js         # 🧠 Integração Ollama
│   │   ├── 📄 transcription.js     # 🎤 Whisper/transcrição
│   │   ├── 📄 ttsService.js         # 🔊 Text-to-Speech
│   │   ├── 📄 scheduler.js          # 📅 Sistema de agendamentos
│   │   ├── 📄 youtubeService.js     # 🎥 Processamento YouTube
│   │   ├── 📄 linkedinScraper.js   # 🔗 Análise LinkedIn
│   │   └── 📄 calorieService.js     # 🍎 Contagem de calorias
│   ├── 📂 api/
│   │   └── 📄 restApi.js            # 🌐 API Express
│   ├── 📂 config/                   # ⚙️ Configurações
│   │   ├── 📄 index.js              # 📋 Config principal
│   │   ├── 📄 config.js             # 🔧 Variáveis ambiente
│   │   └── 📄 metadata.js           # 📝 Metadados
│   ├── 📂 constants/                # 📚 Constantes
│   │   ├── 📄 commands.js           # 🎮 Comandos e menus
│   │   └── 📄 messages.js           # 💬 Mensagens padrão
│   ├── 📂 utils/                    # 🛠️ Utilitários
│   │   ├── 📄 index.js              # 🔗 Funções auxiliares
│   │   ├── 📄 jobQueue.js           # ⚙️ Fila de processamento
│   │   ├── 📄 logger.js             # 📊 Sistema de logs
│   │   └── 📄 errorHandler.js       # 🚨 Tratamento de erros
│   └── 📂 workers/                  # 👷 Processamento background
├── 📂 public/                       # 🌐 Assets interface web
│   ├── 📂 css/                      # 🎨 Estilos
│   ├── 📂 js/                       # ✨ Scripts front-end
│   └── 📂 images/                   # 🖼️ Imagens
├── 📂 views/                        # 📄 Templates HTML
│   ├── 📄 layout.ejs                # 🏗️ Layout principal
│   ├── 📄 dashboard.ejs             # 📊 Dashboard
│   ├── 📄 chat.ejs                  # 💬 Interface chat
│   └── 📄 config.ejs                # ⚙️ Configurações
├── 📂 scripts/                      # 🔧 Scripts de instalação
│   ├── 📄 install-piper-simple.sh   # 🎤 Instalador Piper (recomendado)
│   ├── 📄 install-piper.sh          # 🎤 Instalador completo
│   └── 📄 README-PIPER.md           # 📖 Documentação Piper
├── 📂 test/                         # 🧪 Testes automatizados
├── 📂 piper/                        # 🔊 TTS local (auto-criado)
├── 📄 package.json                  # 📦 Dependências
├── 📄 .env.example                  # ⚙️ Exemplo configuração
├── 📄 Dockerfile                    # 🐳 Container Docker
├── 📄 docker-compose.yml            # 🐳 Orquestração
├── 📄 Makefile                      # 🔧 Comandos automatizados
└── 📄 README.md                     # 📖 Este arquivo
```

---

## 🧪 Testes

```bash
# Executar todos os testes
npm test

# Executar com detalhes
npm test -- --verbose

# Verificar funcionalidades específicas
npm test -- --grep "whisper"
npm test -- --grep "ollama"
```

### 🔍 Tipos de Teste

- ✅ **Unitários**: Funções individuais
- ✅ **Integração**: Serviços externos (Ollama, MongoDB)
- ✅ **E2E**: Fluxos completos de usuário

---

## 🆘 Suporte e Solução de Problemas

### ❓ Problemas Comuns

<details>
<summary>🔧 QR Code não aparece</summary>

**Problema**: QR Code não é exibido no terminal

**Soluções**:
```bash
# 1. Verificar se todas as dependências estão instaladas
npm install

# 2. Limpar cache do WhatsApp Web
rm -rf .wwebjs_auth/

# 3. Reiniciar aplicação
npm start
```

</details>

<details>
<summary>🤖 Ollama não responde</summary>

**Problema**: Erro "Connection refused" ou timeouts

**Soluções**:
```bash
# 1. Verificar se Ollama está rodando
ollama list

# 2. Iniciar serviço
ollama serve

# 3. Baixar modelo necessário
ollama pull llama3.2:latest

# 4. Verificar configuração
echo $OLLAMA_HOST  # Deve ser http://127.0.0.1:11434
```

</details>

<details>
<summary>🗄️ MongoDB não conecta</summary>

**Problema**: Erro de conexão com banco de dados

**Soluções**:
```bash
# 1. Verificar se MongoDB está rodando
sudo systemctl status mongod

# 2. Iniciar serviço
sudo systemctl start mongod

# 3. Testar conexão
mongosh "mongodb://bot:senha@localhost:27017/sched"

# 4. Recriar usuário se necessário
mongosh
use sched
db.createUser({user: "bot", pwd: "senha", roles: ["readWrite"]})
```

</details>

<details>
<summary>🎤 Whisper/Transcrição com erro</summary>

**Problema**: Falha na transcrição de áudios

**Soluções**:
```bash
# 1. Verificar FFmpeg
ffmpeg -version

# 2. Instalar se necessário
sudo apt install ffmpeg

# 3. Testar Whisper manualmente
npx nodejs-whisper transcribe audio.wav

# 4. Verificar modelo configurado
echo $WHISPER_MODEL
```

</details>

<details>
<summary>🔊 TTS não funciona</summary>

**Problema**: Respostas de voz não são enviadas

**Soluções**:
```bash
# Para Piper (local):
# 1. Verificar instalação
./piper/piper-wrapper.sh --version

# 2. Reinstalar se necessário
./scripts/install-piper-simple.sh

# Para ElevenLabs (pago):
# 1. Verificar API key
echo $ELEVENLABS_API_KEY

# 2. Testar conexão
curl -H "xi-api-key: $ELEVENLABS_API_KEY" \
     https://api.elevenlabs.io/v1/voices
```

</details>

### 📞 Como Obter Ajuda

1. **📖 Verificar documentação**: Este README cobre 95% dos casos
2. **🔍 Buscar erros**: Use `grep` nos logs para encontrar erros específicos
3. **🐛 Reportar bugs**: Abra uma issue no GitHub com:
   - Versão do Node.js (`node --version`)
   - Sistema operacional
   - Logs de erro completos
   - Passos para reproduzir

### 📊 Logs Úteis

```bash
# Ver logs em tempo real
tail -f logs/app.log

# Logs específicos do WhatsApp
grep "WhatsApp" logs/app.log

# Logs de erro
grep "ERROR" logs/app.log

# Logs do Ollama
grep "ollama" logs/app.log
```

---

## 🤝 Contribuindo

Contribuições são bem-vindas! 🎉

### 🔄 Processo

1. **🍴 Fork** o projeto
2. **🌿 Crie uma branch** para sua feature:
   ```bash
   git checkout -b feature/nova-funcionalidade
   ```
3. **✨ Faça suas mudanças** seguindo os padrões do código
4. **🧪 Execute os testes**:
   ```bash
   npm test
   ```
5. **📝 Commit** suas mudanças:
   ```bash
   git commit -m "feat: adiciona nova funcionalidade incrível"
   ```
6. **📤 Push** para sua branch:
   ```bash
   git push origin feature/nova-funcionalidade
   ```
7. **🔀 Abra um Pull Request**

### 📋 Diretrizes

- ✅ **Código limpo**: Siga os padrões existentes
- ✅ **Testes**: Adicione testes para novas funcionalidades
- ✅ **Documentação**: Atualize o README se necessário
- ✅ **Commits semânticos**: Use `feat:`, `fix:`, `docs:`, etc.

### 💡 Ideias para Contribuir

- 🔌 **Novas integrações**: Discord, Telegram, Slack
- 🤖 **Novos modelos**: Suporte a mais LLMs
- 🌍 **Internacionalização**: Tradução para outros idiomas
- 📊 **Analytics**: Métricas de uso mais detalhadas
- 🎨 **Interface**: Melhorias na interface web

---

## 📄 Licença

Distribuído sob a licença **ISC**. Veja [`LICENSE`](LICENSE) para mais informações.

### 📋 Resumo da Licença

- ✅ **Uso comercial** permitido
- ✅ **Modificação** permitida
- ✅ **Distribuição** permitida
- ⚠️ **Sem garantia** implícita
- ⚠️ **Responsabilidade** do usuário

---

<div align="center">

## 🎉 Pronto para começar?

### 🚀 Instalação Rápida

```bash
git clone https://github.com/seu-usuario/secrebot.git
cd secrebot && npm install
cp .env.example .env && nano .env
npm start
```

### 🌟 Gostou do projeto?

Se este projeto foi útil para você, considere dar uma ⭐ no GitHub!

---

**[⬆ Voltar ao topo](#-secrebot)**

Feito com ❤️ para revolucionar seu WhatsApp  
**SecreBot** - Seu assistente inteligente completo

---

*📅 Última atualização: Julho 2025*  
*🔄 Versão: 2.0.0*

</div>
