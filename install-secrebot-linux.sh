#!/bin/bash
# =============================================================================
# 🚀 SecreBot - Instalador Automático para Linux
# =============================================================================
# Assistente Inteligente para WhatsApp com IA Avançada
# Este script instala automaticamente todas as dependências necessárias
# Suporte: Ubuntu/Debian, CentOS/RHEL, Fedora
# =============================================================================

set -euo pipefail  # Falha em qualquer erro
IFS=$'\n\t'       # Secure Internal Field Separator

# =============================================================================
# 🔧 CONFIGURAÇÕES GLOBAIS
# =============================================================================
readonly SCRIPT_VERSION="2.0.0"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly LOG_FILE="/tmp/secrebot-install-$(date +%Y%m%d_%H%M%S).log"
readonly INSTALL_DIR="$HOME/secrebot"
readonly MONGO_DB_NAME="sched"
readonly MONGO_USER="secrebot"
readonly MONGO_PASSWORD="$(openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64)"

# Cores para output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly PURPLE='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m' # No Color

# =============================================================================
# 🛠️ FUNÇÕES DE UTILIDADE a
# =============================================================================

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

log_debug() {
    echo -e "${BLUE}[DEBUG]${NC} $1" | tee -a "$LOG_FILE"
}

log_step() {
    echo -e "\n${PURPLE}[STEP]${NC} $1" | tee -a "$LOG_FILE"
    echo "===========================================" | tee -a "$LOG_FILE"
}

spinner() {
    local pid=$1
    local delay=0.1
    local spinstr='|/-\'
    while [ "$(ps a | awk '{print $1}' | grep $pid)" ]; do
        local temp=${spinstr#?}
        printf " [%c]  " "$spinstr"
        local spinstr=$temp${spinstr%"$temp"}
        sleep $delay
        printf "\b\b\b\b\b\b"
    done
    printf "    \b\b\b\b"
}

check_command() {
    command -v "$1" >/dev/null 2>&1
}

check_service() {
    systemctl is-active --quiet "$1" 2>/dev/null
}

detect_distro() {
    if [[ -f /etc/os-release ]]; then
        source /etc/os-release
        echo "$ID"
    elif [[ -f /etc/redhat-release ]]; then
        echo "rhel"
    elif [[ -f /etc/debian_version ]]; then
        echo "debian"
    else
        echo "unknown"
    fi
}

detect_architecture() {
    uname -m
}

check_internet() {
    if ! ping -c 1 google.com >/dev/null 2>&1; then
        log_error "Sem conexão com a internet"
        exit 1
    fi
}

check_disk_space() {
    local required_gb=5
    local available_gb=$(df . | tail -1 | awk '{print int($4/1024/1024)}')
    
    if [[ $available_gb -lt $required_gb ]]; then
        log_error "Espaço insuficiente em disco. Necessário: ${required_gb}GB, Disponível: ${available_gb}GB"
        exit 1
    fi
    log_info "Espaço em disco: ${available_gb}GB disponível"
}

check_memory() {
    local required_mb=2048
    local available_mb=$(free -m | awk 'NR==2{print $7}' 2>/dev/null || echo "0")
    
    if [[ $available_mb -lt $required_mb ]]; then
        log_warn "Memória disponível baixa: ${available_mb}MB (recomendado: ${required_mb}MB)"
    else
        log_info "Memória disponível: ${available_mb}MB"
    fi
}

# Verifica se comandos essenciais estão disponíveis
check_basic_commands() {
    local missing=()
    for cmd in curl wget git tar; do
        if ! check_command "$cmd"; then
            missing+=("$cmd")
        fi
    done

    if [[ ${#missing[@]} -gt 0 ]]; then
        local suggestion="${missing[*]}"
        case "$PACKAGE_MANAGER" in
            apt)   suggestion="sudo apt install -y $suggestion" ;;
            dnf|yum) suggestion="sudo $PACKAGE_MANAGER install -y $suggestion" ;;
            pacman) suggestion="sudo pacman -S --noconfirm $suggestion" ;;
        esac

        log_error "Dependências básicas ausentes: ${missing[*]}"
        log_info "Instale-as executando: $suggestion"
        exit 1
    fi
}

# Verifica se MongoDB já está instalado
check_mongo_installed() {
    if check_command mongosh || check_command mongo || check_command mongod; then
        return 0
    fi
    if systemctl list-unit-files 2>/dev/null | grep -q -E "mongod\.service|mongodb\.service"; then
        return 0
    fi
    return 1
}

# =============================================================================
# 🔒 VERIFICAÇÕES PRELIMINARES
# =============================================================================

check_requirements() {
    log_step "Verificando requisitos do sistema"
    
    # Verificar se é root (não queremos root para este script)
    if [[ $EUID -eq 0 ]]; then
        log_error "Não execute este script como root/sudo"
        log_info "Execute: ./install-secrebot-linux.sh (sem sudo)"
        exit 1
    fi
    
    # Verificar se sudo está disponível
    if ! command -v sudo >/dev/null 2>&1; then
        log_error "sudo não está instalado. Instale sudo primeiro."
        exit 1
    fi
    
    # Testar sudo
    if ! sudo -n true 2>/dev/null; then
        log_info "Este script precisa de privilégios sudo para instalar dependências do sistema"
        log_info "Você será solicitado a inserir sua senha quando necessário"
        sudo -v || { log_error "Falha na autenticação sudo"; exit 1; }
    fi
    
    check_internet
    check_disk_space
    check_memory
    
    # Detectar distribuição
    DISTRO=$(detect_distro)
    ARCH=$(detect_architecture)
    log_info "Sistema detectado: $DISTRO ($ARCH)"
    
    case "$DISTRO" in
        ubuntu|debian|pop|mint|elementary)
            PACKAGE_MANAGER="apt"
            ;;
        centos|rhel|fedora|rocky|alma)
            if check_command dnf; then
                PACKAGE_MANAGER="dnf"
            elif check_command yum; then
                PACKAGE_MANAGER="yum"
            else
                log_error "Gerenciador de pacotes não encontrado"
                exit 1
            fi
            ;;
        arch|manjaro)
            PACKAGE_MANAGER="pacman"
            ;;
        *)
            log_error "Distribuição não suportada: $DISTRO"
            log_info "Distribuições suportadas: Ubuntu, Debian, CentOS, RHEL, Fedora, Arch"
            exit 1
            ;;
    esac

    log_info "Gerenciador de pacotes: $PACKAGE_MANAGER"

    # Verificar comandos básicos antes de prosseguir
    check_basic_commands
}

# =============================================================================
# 📦 INSTALAÇÃO DE DEPENDÊNCIAS DO SISTEMA
# =============================================================================

install_system_deps() {
    log_step "Instalando dependências do sistema"
    
    case "$PACKAGE_MANAGER" in
        apt)
            log_info "Atualizando cache do apt..."
            sudo apt update -qq
            
            log_info "Instalando dependências básicas..."
            sudo apt install -y \
                curl wget git build-essential \
                software-properties-common apt-transport-https \
                ca-certificates gnupg lsb-release \
                python3 python3-pip python3-venv \
                ffmpeg sox alsa-utils \
                jq unzip tar gzip \
                htop tree nano vim
            
            # Node.js via NodeSource
            if ! check_command node || [[ "$(node --version | cut -d'v' -f2 | cut -d'.' -f1)" -lt "18" ]]; then
                log_info "Instalando Node.js 18..."
                curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
                sudo apt install -y nodejs
            fi
            
            # MongoDB
            if check_mongo_installed; then
                log_info "MongoDB já está instalado, pulando instalação"
            else
                log_info "Instalando MongoDB..."
                wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
                echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
                sudo apt update -qq
                sudo apt install -y mongodb-org
            fi
            ;;
            
        dnf|yum)
            log_info "Atualizando cache do $PACKAGE_MANAGER..."
            sudo $PACKAGE_MANAGER update -y -q
            
            log_info "Instalando dependências básicas..."
            sudo $PACKAGE_MANAGER install -y \
                curl wget git gcc gcc-c++ make \
                python3 python3-pip python3-devel \
                ffmpeg sox alsa-utils \
                jq unzip tar gzip \
                htop tree nano vim
            
            # Node.js via NodeSource
            if ! check_command node || [[ "$(node --version | cut -d'v' -f2 | cut -d'.' -f1)" -lt "18" ]]; then
                log_info "Instalando Node.js 18..."
                curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
                sudo $PACKAGE_MANAGER install -y nodejs
            fi
            
            # MongoDB
            if check_mongo_installed; then
                log_info "MongoDB já está instalado, pulando instalação"
            else
                log_info "Instalando MongoDB..."
                cat > /tmp/mongodb-org-7.0.repo << 'EOF'
[mongodb-org-7.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/$releasever/mongodb-org/7.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://www.mongodb.org/static/pgp/server-7.0.asc
EOF
                sudo mv /tmp/mongodb-org-7.0.repo /etc/yum.repos.d/
                sudo $PACKAGE_MANAGER install -y mongodb-org
            fi
            ;;
            
        pacman)
            log_info "Atualizando sistema Arch..."
            sudo pacman -Syu --noconfirm
            
            log_info "Instalando dependências básicas..."
            sudo pacman -S --noconfirm \
                curl wget git base-devel \
                python python-pip \
                ffmpeg sox alsa-utils \
                jq unzip tar gzip \
                htop tree nano vi
            
            # Node.js
            if ! check_command node || [[ "$(node --version | cut -d'v' -f2 | cut -d'.' -f1)" -lt "18" ]]; then
                log_info "Instalando Node.js..."
                sudo pacman -S --noconfirm nodejs npm
            fi
            
            # MongoDB
            if check_mongo_installed; then
                log_info "MongoDB já está instalado, pulando instalação"
            else
                log_info "Instalando MongoDB..."
                sudo pacman -S --noconfirm mongodb-bin mongodb-tools
            fi
            ;;
    esac
    
    # Verificar instalações
    log_info "Verificando instalações..."
    
    if ! check_command node; then
        log_error "Node.js não foi instalado corretamente"
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [[ $NODE_VERSION -lt 18 ]]; then
        log_error "Node.js versão muito antiga: v$NODE_VERSION (necessário: ≥18)"
        exit 1
    fi
    log_info "Node.js v$(node --version) ✓"
    
    if ! check_command npm; then
        log_error "npm não foi instalado corretamente"
        exit 1
    fi
    log_info "npm v$(npm --version) ✓"
    
    if ! check_command python3; then
        log_error "Python3 não foi instalado corretamente"
        exit 1
    fi
    log_info "Python $(python3 --version) ✓"
    
    if ! check_command ffmpeg; then
        log_error "FFmpeg não foi instalado corretamente"
        exit 1
    fi
    log_info "FFmpeg $(ffmpeg -version | head -n1 | cut -d' ' -f3) ✓"
}

# =============================================================================
# 🗄️ CONFIGURAÇÃO DO MONGODB
# =============================================================================

setup_mongodb() {
    log_step "Configurando MongoDB"
    
   
    # Criar usuário do banco
    log_info "Criando usuário do banco de dados..."
    
    # Tentar mongosh primeiro, depois mongo
    MONGO_CMD=""
    if check_command mongosh; then
        MONGO_CMD="mongosh"
    elif check_command mongo; then
        MONGO_CMD="mongo"
    else
        log_error "Cliente MongoDB não encontrado (mongosh ou mongo)"
        exit 1
    fi
    
    cat > /tmp/mongo_setup.js << EOF
use $MONGO_DB_NAME
db.createUser({
  user: "$MONGO_USER",
  pwd: "$MONGO_PASSWORD",
  roles: ["readWrite"]
})
EOF
    
    if ! $MONGO_CMD < /tmp/mongo_setup.js; then
        log_warn "Falha ao criar usuário (pode já existir)"
    else
        log_info "Usuário MongoDB criado: $MONGO_USER"
    fi
    
    rm -f /tmp/mongo_setup.js
    
    # Testar conexão
    MONGO_URI="mongodb://$MONGO_USER:$MONGO_PASSWORD@localhost:27017/$MONGO_DB_NAME?authSource=$MONGO_DB_NAME"
    if ! $MONGO_CMD "$MONGO_URI" --eval "db.runCommand({ping: 1})" >/dev/null 2>&1; then
        log_error "Falha ao conectar ao MongoDB com credenciais"
        exit 1
    fi
    
    log_info "MongoDB configurado com sucesso ✓"
}

# =============================================================================
# 🤖 INSTALAÇÃO DO OLLAMA
# =============================================================================

install_ollama() {
    log_step "Instalando Ollama"
    
    if check_command ollama; then
        log_info "Ollama já está instalado"
    else
        log_info "Baixando e instalando Ollama..."
        curl -fsSL https://ollama.com/install.sh | sh
        
        if ! check_command ollama; then
            log_error "Falha na instalação do Ollama"
            exit 1
        fi
    fi
    
    log_info "Ollama v$(ollama --version | head -n1) ✓"
    
    # Iniciar serviço Ollama
    log_info "Iniciando Ollama..."
    if ! pgrep -f "ollama serve" >/dev/null; then
        ollama serve &
        OLLAMA_PID=$!
        log_debug "Ollama PID: $OLLAMA_PID"
    fi
    
    # Aguardar Ollama inicializar
    log_info "Aguardando Ollama inicializar..."
    for i in {1..30}; do
        if curl -s http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
            log_info "Ollama API disponível"
            break
        fi
        if [[ $i -eq 30 ]]; then
            log_error "Ollama falhou ao inicializar"
            exit 1
        fi
        sleep 2
    done
    
    # Baixar modelos essenciais
    log_info "Baixando modelos de IA..."
    
    log_info "Baixando llama3.2:latest (modelo de texto)..."
    if ! ollama pull llama3.2:latest; then
        log_error "Falha ao baixar modelo llama3.2"
        exit 1
    fi
    
    log_info "Baixando llava:latest (modelo de imagem)..."
    if ! ollama pull llava:latest; then
        log_error "Falha ao baixar modelo llava"
        exit 1
    fi
    
    # Listar modelos instalados
    log_info "Modelos instalados:"
    ollama list | tail -n +2 | while read line; do
        log_info "  → $line"
    done
    
    log_info "Ollama configurado com sucesso ✓"
}

# =============================================================================
# 📱 CONFIGURAÇÃO DO PROJETO SECREBOT
# =============================================================================

setup_project() {
    log_step "Configurando projeto SecreBot"
    
    # Remover instalação existente se houver
    if [[ -d "$INSTALL_DIR" ]]; then
        log_warn "Diretório existente encontrado: $INSTALL_DIR"
        read -p "Deseja sobrescrever? (s/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Ss]$ ]]; then
            log_info "Removendo instalação anterior..."
            rm -rf "$INSTALL_DIR"
        else
            log_error "Instalação cancelada pelo usuário"
            exit 1
        fi
    fi
    
    # Clonar projeto
    log_info "Clonando projeto SecreBot..."
    if [[ -n "${SECREBOT_REPO:-}" ]]; then
        git clone "$SECREBOT_REPO" "$INSTALL_DIR"
    else
        # Se estamos executando dentro do diretório do projeto
        if [[ -f "$SCRIPT_DIR/package.json" ]]; then
            log_info "Copiando projeto atual..."
            cp -r "$SCRIPT_DIR" "$INSTALL_DIR"
        else
            log_error "URL do repositório não fornecida e package.json não encontrado"
            log_info "Defina a variável SECREBOT_REPO ou execute dentro do diretório do projeto"
            exit 1
        fi
    fi
    
    cd "$INSTALL_DIR"
    
    # Verificar se é um projeto SecreBot válido
    if [[ ! -f "package.json" ]] || ! grep -q "whatsapp" package.json; then
        log_error "Projeto SecreBot inválido (package.json não encontrado ou inválido)"
        exit 1
    fi
    
    log_info "Projeto clonado com sucesso"
    
    # Instalar dependências NPM
    log_info "Instalando dependências NPM..."
    npm install
    
    # Instalar Playwright
    log_info "Instalando navegadores Playwright..."
    npx playwright install
    
    # Configurar Whisper
    log_info "Configurando Whisper para transcrição de áudio..."
    if ! check_command python3; then
        log_error "Python3 necessário para Whisper"
        exit 1
    fi
    
    # Instalar dependências Python para Whisper
    log_info "Instalando nodejs-whisper e dependências..."
    npm install --save nodejs-whisper
    
    # Verificar se FFmpeg está disponível
    if ! check_command ffmpeg; then
        log_error "FFmpeg necessário para Whisper"
        exit 1
    fi
    
    log_info "Whisper configurado com sucesso ✓"
    
    # Criar arquivo .env
    log_info "Configurando arquivo .env..."
    if [[ -f ".env.example" ]]; then
        cp .env.example .env
        
        # Configurar MongoDB
        sed -i "s|mongodb://bot:sua_senha@localhost:27017/sched?authSource=sched|mongodb://$MONGO_USER:$MONGO_PASSWORD@localhost:27017/$MONGO_DB_NAME?authSource=$MONGO_DB_NAME|g" .env
        
        # Configurar Piper como padrão (será configurado automaticamente pela função install_piper)
        sed -i 's/^# PIPER_ENABLED=.*/PIPER_ENABLED=true/' .env
        sed -i 's|^# PIPER_EXECUTABLE=.*|PIPER_EXECUTABLE=./piper/piper-wrapper.sh|' .env
        sed -i 's|^# PIPER_MODEL=.*|PIPER_MODEL=./piper/models/pt_BR-cadu-medium.onnx|' .env
        
        log_info "Arquivo .env configurado"
    else
        log_error "Arquivo .env.example não encontrado"
        exit 1
    fi
    
    log_info "Projeto SecreBot configurado com sucesso ✓"
}

# =============================================================================
# 🎤 INSTALAÇÃO DO PIPER TTS
# =============================================================================

install_piper() {
    log_step "Instalando Piper TTS"
    
    cd "$INSTALL_DIR"
    
    # Criar diretório do Piper
    log_info "Criando diretório do Piper..."
    mkdir -p piper/models
    
    # Detectar arquitetura para download correto
    case "$ARCH" in
        x86_64)
            PIPER_ARCH="amd64"
            ;;
        aarch64|arm64)
            PIPER_ARCH="arm64"
            ;;
        *)
            log_warn "Arquitetura não suportada para Piper: $ARCH"
            sed -i 's/PIPER_ENABLED=true/PIPER_ENABLED=false/' .env
            return 0
            ;;
    esac
    
    # URLs dos arquivos
    PIPER_VERSION="1.2.0"
    PIPER_URL="https://github.com/rhasspy/piper/releases/download/v${PIPER_VERSION}/piper_linux_${PIPER_ARCH}.tar.gz"
    CADU_VOICE_URL="https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/pt/pt_BR/cadu/medium/pt_BR-cadu-medium.onnx"
    CADU_CONFIG_URL="https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/pt/pt_BR/cadu/medium/pt_BR-cadu-medium.onnx.json"
    
    # Baixar binário do Piper
    log_info "Baixando Piper ${PIPER_VERSION} para ${PIPER_ARCH}..."
    if ! wget -q --show-progress "$PIPER_URL" -O /tmp/piper_linux.tar.gz; then
        log_error "Falha ao baixar Piper"
        sed -i 's/PIPER_ENABLED=true/PIPER_ENABLED=false/' .env
        return 0
    fi
    
    # Extrair Piper
    log_info "Extraindo Piper..."
    if ! tar -xzf /tmp/piper_linux.tar.gz -C piper --strip-components=1; then
        log_error "Falha ao extrair Piper"
        sed -i 's/PIPER_ENABLED=true/PIPER_ENABLED=false/' .env
        return 0
    fi
    
    # Dar permissão de execução
    chmod +x piper/piper
    
    # Baixar voz Cadu (português brasileiro)
    log_info "Baixando voz Cadu (português brasileiro)..."
    if ! wget -q --show-progress "$CADU_VOICE_URL" -O piper/models/pt_BR-cadu-medium.onnx; then
        log_error "Falha ao baixar voz Cadu"
        sed -i 's/PIPER_ENABLED=true/PIPER_ENABLED=false/' .env
        return 0
    fi
    
    # Baixar arquivo de configuração da voz Cadu
    log_info "Baixando configuração da voz Cadu..."
    if ! wget -q --show-progress "$CADU_CONFIG_URL" -O piper/models/pt_BR-cadu-medium.onnx.json; then
        log_error "Falha ao baixar configuração da voz Cadu"
        sed -i 's/PIPER_ENABLED=true/PIPER_ENABLED=false/' .env
        return 0
    fi
    
    # Criar script wrapper para facilitar uso
    log_info "Criando script wrapper do Piper..."
    cat > piper/piper-wrapper.sh << 'EOF'
#!/bin/bash
# Wrapper para Piper TTS - SecreBot
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIPER_BIN="$SCRIPT_DIR/piper"
DEFAULT_MODEL="$SCRIPT_DIR/models/pt_BR-cadu-medium.onnx"

# Verificar se o binário existe
if [[ ! -f "$PIPER_BIN" ]]; then
    echo "Erro: Binário do Piper não encontrado em $PIPER_BIN" >&2
    exit 1
fi

# Verificar se o modelo existe
if [[ ! -f "$DEFAULT_MODEL" ]]; then
    echo "Erro: Modelo da voz não encontrado em $DEFAULT_MODEL" >&2
    exit 1
fi

# Executar Piper com modelo padrão se não especificado
if [[ "$*" == *"--model"* ]]; then
    "$PIPER_BIN" "$@"
else
    "$PIPER_BIN" --model "$DEFAULT_MODEL" "$@"
fi
EOF
    
    chmod +x piper/piper-wrapper.sh
    
    # Testar instalação do Piper
    log_info "Testando instalação do Piper..."
    if echo "Teste do Piper TTS" | ./piper/piper-wrapper.sh --output_file /tmp/piper_test.wav 2>/dev/null; then
        log_info "Piper TTS instalado e testado com sucesso ✓"
        rm -f /tmp/piper_test.wav
        
        # Configurar .env para usar Piper
        sed -i 's|^# PIPER_ENABLED=.*|PIPER_ENABLED=true|' .env
        sed -i 's|^# PIPER_EXECUTABLE=.*|PIPER_EXECUTABLE=./piper/piper-wrapper.sh|' .env
        sed -i 's|^# PIPER_MODEL=.*|PIPER_MODEL=./piper/models/pt_BR-cadu-medium.onnx|' .env
        
    else
        log_warn "Falha no teste do Piper (desabilitando TTS)"
        sed -i 's/PIPER_ENABLED=true/PIPER_ENABLED=false/' .env
    fi
    
    # Limpar arquivo temporário
    rm -f /tmp/piper_linux.tar.gz
    
    log_info "Instalação do Piper concluída"
}

# =============================================================================
# ✅ VALIDAÇÃO DA INSTALAÇÃO
# =============================================================================

validate_installation() {
    log_step "Validando instalação"
    
    cd "$INSTALL_DIR"
    
    # Verificar serviços
    log_info "Verificando serviços..."
    
    if ! (check_service mongodb || check_service mongod); then
        log_error "MongoDB não está rodando"
        exit 1
    fi
    log_info "MongoDB: ✓ Rodando"
    
    if ! curl -s http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
        log_error "Ollama não está acessível"
        exit 1
    fi
    log_info "Ollama: ✓ Acessível"
    
    # Verificar dependências Node.js
    log_info "Verificando dependências Node.js..."
    if ! npm list >/dev/null 2>&1; then
        log_error "Dependências Node.js não instaladas corretamente"
        exit 1
    fi
    log_info "Dependências NPM: ✓ Instaladas"
    
    # Verificar arquivo .env
    if [[ ! -f ".env" ]]; then
        log_error "Arquivo .env não encontrado"
        exit 1
    fi
    log_info "Configuração: ✓ .env presente"
    
    # Teste de conectividade MongoDB
    log_info "Testando conectividade MongoDB..."
    MONGO_CMD=""
    if check_command mongosh; then
        MONGO_CMD="mongosh"
    elif check_command mongo; then
        MONGO_CMD="mongo"
    fi
    
    MONGO_URI="mongodb://$MONGO_USER:$MONGO_PASSWORD@localhost:27017/$MONGO_DB_NAME?authSource=$MONGO_DB_NAME"
    if ! $MONGO_CMD "$MONGO_URI" --eval "db.runCommand({ping: 1})" >/dev/null 2>&1; then
        log_error "Falha na conectividade MongoDB"
        exit 1
    fi
    log_info "MongoDB: ✓ Conectividade OK"
    
    # Teste básico do projeto (se houver testes)
    if [[ -n "$(npm run | grep test)" ]]; then
        log_info "Executando testes do projeto..."
        if npm test; then
            log_info "Testes: ✓ Passou"
        else
            log_warn "Alguns testes falharam (não crítico)"
        fi
    fi
    
    log_info "Validação concluída com sucesso ✓"
}

# =============================================================================
# 🧹 LIMPEZA E TRATAMENTO DE ERROS
# =============================================================================

cleanup_on_error() {
    log_error "Limpando após erro..."
    
    # Parar serviços se necessário
    if [[ -n "${OLLAMA_PID:-}" ]]; then
        kill $OLLAMA_PID 2>/dev/null || true
    fi
    
    # Remover arquivos temporários
    rm -f /tmp/mongo_setup.js
    rm -f /tmp/mongodb-org-*.repo
    
    log_info "Log completo disponível em: $LOG_FILE"
}

handle_error() {
    local exit_code=$1
    local line_number=$2
    local command="$3"
    
    log_error "Falha na linha $line_number: $command (código: $exit_code)"
    
    # Sugestões específicas baseadas no código de erro
    case $exit_code in
        1)   log_info "💡 Solução: Verifique as permissões e conexão de internet" ;;
        2)   log_info "💡 Solução: Verifique se todos os argumentos foram fornecidos" ;;
        126) log_info "💡 Solução: Arquivo não executável - rode: chmod +x $0" ;;
        127) log_info "💡 Solução: Comando não encontrado - instale a dependência faltante" ;;
        130) log_info "💡 Instalação cancelada pelo usuário (Ctrl+C)" ;;
        *)   log_info "💡 Consulte o log completo: $LOG_FILE" ;;
    esac
    
    cleanup_on_error
    exit $exit_code
}

# =============================================================================
# 📊 RELATÓRIO FINAL
# =============================================================================

show_final_report() {
    log_step "Relatório de Instalação"
    
    echo -e "\n${GREEN}🎉 INSTALAÇÃO CONCLUÍDA COM SUCESSO! 🎉${NC}\n"
    
    echo -e "${CYAN}📋 RESUMO DA INSTALAÇÃO:${NC}"
    echo -e "  🐧 Sistema: $DISTRO ($ARCH)"
    echo -e "  📦 Node.js: v$(node --version)"
    echo -e "  🗄️ MongoDB: Configurado com usuário '$MONGO_USER'"
    echo -e "  🤖 Ollama: $(ollama list | wc -l) modelos instalados"
    echo -e "  📱 SecreBot: Instalado em $INSTALL_DIR"
    if [[ -d "$INSTALL_DIR/piper" ]]; then
        echo -e "  🎤 Piper TTS: Instalado"
    else
        echo -e "  🎤 Piper TTS: Não instalado (opcional)"
    fi
    
    echo -e "\n${CYAN}🚀 PRÓXIMOS PASSOS:${NC}"
    echo -e "  1. cd $INSTALL_DIR"
    echo -e "  2. npm start"
    echo -e "  3. Escaneie o QR Code com seu WhatsApp"
    echo -e "  4. Envie uma mensagem para testar"
    
    echo -e "\n${CYAN}🌐 INTERFACES DISPONÍVEIS:${NC}"
    echo -e "  • WhatsApp Bot: Ativo após escanear QR Code"
    echo -e "  • Interface Web: http://localhost:3000"
    echo -e "  • API REST: http://localhost:3000/api"
    
    echo -e "\n${CYAN}📖 COMANDOS ÚTEIS:${NC}"
    echo -e "  • Iniciar: npm start"
    echo -e "  • Parar: Ctrl+C"
    echo -e "  • Logs: tail -f logs/app.log"
    echo -e "  • Status: systemctl status mongodb ollama"
    
    echo -e "\n${CYAN}🆘 SUPORTE:${NC}"
    echo -e "  • Documentação: $INSTALL_DIR/README.md"
    echo -e "  • Log de instalação: $LOG_FILE"
    echo -e "  • Configuração: $INSTALL_DIR/.env"
    
    echo -e "\n${GREEN}Instalação realizada em: $(date)${NC}"
    echo -e "${GREEN}Tempo total: $((SECONDS/60))m $((SECONDS%60))s${NC}\n"
}

# =============================================================================
# 🎯 EXECUÇÃO PRINCIPAL
# =============================================================================

main() {
    # Exibir cabeçalho
    clear
    echo -e "${PURPLE}=============================================================================${NC}"
    echo -e "${PURPLE}🚀 SecreBot - Instalador Automático para Linux v$SCRIPT_VERSION${NC}"
    echo -e "${PURPLE}=============================================================================${NC}"
    echo -e "${CYAN}Assistente Inteligente para WhatsApp com IA Avançada${NC}"
    echo -e "${CYAN}Este script irá instalar automaticamente todas as dependências necessárias${NC}"
    echo -e "${PURPLE}=============================================================================${NC}\n"
    
    # Inicializar log
    echo "SecreBot Installation Log - $(date)" > "$LOG_FILE"
    echo "Script Version: $SCRIPT_VERSION" >> "$LOG_FILE"
    echo "========================================" >> "$LOG_FILE"
    
    log_info "Iniciando instalação do SecreBot v$SCRIPT_VERSION"
    log_info "Log: $LOG_FILE"
    
    # Executar etapas
    check_requirements
    install_system_deps
    setup_mongodb
    install_ollama
    setup_project
    install_piper
    validate_installation
    
    # Relatório final
    show_final_report
    
    log_info "🎉 Instalação concluída com sucesso!"
}

# =============================================================================
# 🔧 INICIALIZAÇÃO
# =============================================================================

# Configurar tratamento de erros
trap 'handle_error $? $LINENO "$BASH_COMMAND"' ERR

# Configurar limpeza em saída
trap cleanup_on_error EXIT

# Executar função principal
main "$@"

# Remover trap de saída se chegou até aqui
trap - EXIT

log_info "SecreBot está pronto para uso!"