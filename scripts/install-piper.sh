#!/bin/bash

# Script para instalar Piper TTS com modelo em português brasileiro
# Execução: chmod +x scripts/install-piper.sh && ./scripts/install-piper.sh

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Diretórios
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PIPER_DIR="$PROJECT_DIR/piper"
MODELS_DIR="$PIPER_DIR/models"
BIN_DIR="$PIPER_DIR/bin"

# URLs para download
PIPER_VERSION="2023.11.14-2"
PIPER_BASE_URL="https://github.com/rhasspy/piper/releases/download/${PIPER_VERSION}"

# Detectar arquitetura
ARCH=$(uname -m)
OS=$(uname -s | tr '[:upper:]' '[:lower:]')

case $ARCH in
    x86_64)
        PIPER_ARCH="x64"
        ;;
    aarch64|arm64)
        PIPER_ARCH="arm64"
        ;;
    armv7l)
        PIPER_ARCH="armv7"
        ;;
    *)
        echo -e "${RED}❌ Arquitetura não suportada: $ARCH${NC}"
        exit 1
        ;;
esac

# URLs específicas
if [ "$OS" = "linux" ]; then
    if [ "$PIPER_ARCH" = "x64" ]; then
        PIPER_ARCHIVE="piper_linux_x86_64.tar.gz"
    elif [ "$PIPER_ARCH" = "arm64" ]; then
        PIPER_ARCHIVE="piper_linux_aarch64.tar.gz"
    elif [ "$PIPER_ARCH" = "armv7" ]; then
        PIPER_ARCHIVE="piper_linux_armv7l.tar.gz"
    else
        echo -e "${RED}❌ Arquitetura Linux não suportada: $PIPER_ARCH${NC}"
        exit 1
    fi
    PIPER_URL="${PIPER_BASE_URL}/${PIPER_ARCHIVE}"
elif [ "$OS" = "darwin" ]; then
    if [ "$PIPER_ARCH" = "x64" ]; then
        PIPER_ARCHIVE="piper_macos_x64.tar.gz"
    elif [ "$PIPER_ARCH" = "arm64" ]; then
        PIPER_ARCHIVE="piper_macos_arm64.tar.gz"
    else
        echo -e "${RED}❌ Arquitetura macOS não suportada: $PIPER_ARCH${NC}"
        exit 1
    fi
    PIPER_URL="${PIPER_BASE_URL}/${PIPER_ARCHIVE}"
else
    echo -e "${RED}❌ Sistema operacional não suportado: $OS${NC}"
    exit 1
fi

# Modelos pt-BR disponíveis
declare -A MODELS=(
    ["faber"]="https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/pt/pt_BR/faber/medium/pt_BR-faber-medium.onnx"
    ["faber-config"]="https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/pt/pt_BR/faber/medium/pt_BR-faber-medium.onnx.json"
)

print_header() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                    🎤 Instalador Piper TTS                   ║"
    echo "║                     com modelo pt-BR                        ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_step() {
    echo -e "${YELLOW}📋 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

check_dependencies() {
    print_step "Verificando dependências..."
    
    local missing_deps=()
    
    if ! command -v curl &> /dev/null && ! command -v wget &> /dev/null; then
        missing_deps+=("curl ou wget")
    fi
    
    if ! command -v tar &> /dev/null; then
        missing_deps+=("tar")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        print_error "Dependências faltando: ${missing_deps[*]}"
        echo "Execute: sudo apt-get install curl tar (Ubuntu/Debian)"
        echo "ou: sudo yum install curl tar (CentOS/RHEL)"
        exit 1
    fi
    
    print_success "Dependências verificadas"
}

create_directories() {
    print_step "Criando diretórios..."
    
    mkdir -p "$PIPER_DIR"
    mkdir -p "$MODELS_DIR"
    mkdir -p "$BIN_DIR"
    
    print_success "Diretórios criados"
}

download_file() {
    local url=$1
    local output=$2
    local description=$3
    
    print_step "Baixando $description..."
    
    if command -v curl &> /dev/null; then
        if curl -L --fail --show-error --progress-bar "$url" -o "$output"; then
            print_success "$description baixado com sucesso"
        else
            print_error "Falha ao baixar $description"
            return 1
        fi
    elif command -v wget &> /dev/null; then
        if wget --progress=bar:force:noscroll "$url" -O "$output"; then
            print_success "$description baixado com sucesso"
        else
            print_error "Falha ao baixar $description"
            return 1
        fi
    else
        print_error "curl ou wget não encontrados"
        return 1
    fi
}

install_piper() {
    print_step "Instalando Piper TTS..."
    
    local archive_path="$PIPER_DIR/$PIPER_ARCHIVE"
    
    # Download do Piper
    if [ ! -f "$archive_path" ]; then
        download_file "$PIPER_URL" "$archive_path" "Piper TTS"
    else
        print_success "Piper TTS já baixado"
    fi
    
    # Extrair arquivo
    print_step "Extraindo Piper..."
    cd "$PIPER_DIR"
    tar -xzf "$PIPER_ARCHIVE"
    
    # Encontrar e mover todos os arquivos necessários
    local piper_extracted_dir=$(find . -name "piper" -type d | head -1)
    if [ -n "$piper_extracted_dir" ]; then
        # Copiar executável
        cp "$piper_extracted_dir/piper" "$BIN_DIR/"
        chmod +x "$BIN_DIR/piper"
        
        # Copiar bibliotecas compartilhadas se existirem
        if [ -d "$piper_extracted_dir/lib" ]; then
            cp -r "$piper_extracted_dir/lib" "$PIPER_DIR/"
        fi
        
        # Copiar outros arquivos necessários
        find "$piper_extracted_dir" -name "*.so*" -exec cp {} "$BIN_DIR/" \;
        
    else
        # Tentar encontrar executável diretamente
        local piper_executable=$(find . -name "piper" -type f -executable | head -1)
        if [ -n "$piper_executable" ]; then
            cp "$piper_executable" "$BIN_DIR/"
            chmod +x "$BIN_DIR/piper"
            
            # Copiar bibliotecas do mesmo diretório
            local piper_dir=$(dirname "$piper_executable")
            find "$piper_dir" -name "*.so*" -exec cp {} "$BIN_DIR/" \;
        else
            print_error "Executável Piper não encontrado após extração"
            exit 1
        fi
    fi
    
    # Limpar arquivos temporários
    rm -rf "$PIPER_ARCHIVE"
    find . -maxdepth 1 -type d -name "piper*" -exec rm -rf {} + 2>/dev/null || true
    
    print_success "Piper TTS instalado"
}

install_models() {
    print_step "Instalando modelos pt-BR..."
    
    # Baixar modelo Faber (voz masculina brasileira)
    local model_file="$MODELS_DIR/pt_BR-faber-medium.onnx"
    local config_file="$MODELS_DIR/pt_BR-faber-medium.onnx.json"
    
    if [ ! -f "$model_file" ]; then
        download_file "${MODELS['faber']}" "$model_file" "modelo pt-BR Faber"
    else
        print_success "Modelo pt-BR Faber já existe"
    fi
    
    if [ ! -f "$config_file" ]; then
        download_file "${MODELS['faber-config']}" "$config_file" "configuração do modelo"
    else
        print_success "Configuração do modelo já existe"
    fi
    
    print_success "Modelos pt-BR instalados"
}

test_installation() {
    print_step "Testando instalação..."
    
    local piper_executable="$BIN_DIR/piper"
    local model_file="$MODELS_DIR/pt_BR-faber-medium.onnx"
    
    if [ ! -x "$piper_executable" ]; then
        print_error "Executável Piper não encontrado ou não executável"
        return 1
    fi
    
    if [ ! -f "$model_file" ]; then
        print_error "Modelo pt-BR não encontrado"
        return 1
    fi
    
    # Teste básico com LD_LIBRARY_PATH
    export LD_LIBRARY_PATH="$BIN_DIR:$PIPER_DIR/lib:$LD_LIBRARY_PATH"
    echo "Testando o Piper com modelo brasileiro" | "$piper_executable" \
        --model "$model_file" \
        --output_file "$PIPER_DIR/test.wav" \
        --output_raw 2>/dev/null || {
        
        # Se falhar, tentar sem --output_raw
        echo "Testando o Piper com modelo brasileiro" | "$piper_executable" \
            --model "$model_file" \
            --output_file "$PIPER_DIR/test.wav" 2>/dev/null || {
            print_error "Falha no teste do Piper"
            return 1
        }
    }
    
    if [ -f "$PIPER_DIR/test.wav" ]; then
        rm "$PIPER_DIR/test.wav"
        print_success "Teste do Piper passou"
    else
        print_error "Arquivo de áudio de teste não foi criado"
        return 1
    fi
}

create_env_example() {
    print_step "Criando exemplo de configuração..."
    
    local env_example="$PROJECT_DIR/.env.piper.example"
    
    cat > "$env_example" << EOF
# Configuração Piper TTS - Adicione ao seu arquivo .env

# Habilitar Piper TTS local
PIPER_ENABLED=true

# Caminho para o executável Piper
PIPER_EXECUTABLE=$BIN_DIR/piper

# Caminho para o modelo pt-BR
PIPER_MODEL=$MODELS_DIR/pt_BR-faber-medium.onnx

# Exemplo de configuração completa:
# cp .env.piper.example .env
# ou adicione essas linhas ao seu .env existente
EOF
    
    print_success "Arquivo .env.piper.example criado"
}

show_final_instructions() {
    echo -e "${GREEN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                    ✅ Instalação Concluída!                  ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    echo -e "${BLUE}📁 Arquivos instalados:${NC}"
    echo "   • Executável: $BIN_DIR/piper"
    echo "   • Modelo pt-BR: $MODELS_DIR/pt_BR-faber-medium.onnx"
    echo "   • Configuração: .env.piper.example"
    echo
    echo -e "${BLUE}🔧 Para configurar:${NC}"
    echo "   1. Copie as variáveis de .env.piper.example para seu .env"
    echo "   2. Ou execute: cp .env.piper.example .env"
    echo "   3. Reinicie a aplicação"
    echo
    echo -e "${BLUE}🎤 Para testar:${NC}"
    echo "   1. Envie !voz no WhatsApp para ativar"
    echo "   2. Envie qualquer mensagem para ouvir a voz"
    echo
    echo -e "${BLUE}💡 Comandos úteis:${NC}"
    echo "   • Teste manual: echo 'Olá mundo' | $BIN_DIR/piper --model $MODELS_DIR/pt_BR-faber-medium.onnx --output_file teste.wav"
    echo "   • Verificar versão: $BIN_DIR/piper --version"
    echo
}

main() {
    print_header
    
    echo -e "${BLUE}🔍 Sistema detectado: $OS ($ARCH)${NC}"
    echo -e "${BLUE}📁 Diretório de instalação: $PIPER_DIR${NC}"
    echo
    
    check_dependencies
    create_directories
    install_piper
    install_models
    test_installation
    create_env_example
    show_final_instructions
    
    echo -e "${GREEN}🎉 Piper TTS com modelo pt-BR instalado com sucesso!${NC}"
}

# Executar apenas se chamado diretamente
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi