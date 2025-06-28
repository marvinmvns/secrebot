#!/bin/bash

# Script simplificado para instalar Piper TTS usando binários pré-compilados
# Execução: chmod +x scripts/install-piper-simple.sh && ./scripts/install-piper-simple.sh

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# URLs dos binários pré-compilados
PIPER_BASE_URL="https://github.com/rhasspy/piper/releases/latest/download"

# Diretórios
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PIPER_DIR="$PROJECT_DIR/piper"
MODELS_DIR="$PIPER_DIR/models"
BIN_DIR="$PIPER_DIR/bin"

# URLs dos modelos
MODEL_BASE_URL="https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0"

print_header() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║               🎤 Instalador Piper TTS Simplificado           ║"
    echo "║                  (Binários Pré-compilados)                  ║"
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

detect_architecture() {
    local arch=$(uname -m)
    local os=$(uname -s | tr '[:upper:]' '[:lower:]')
    
    if [ "$os" != "linux" ]; then
        print_error "Sistema operacional não suportado: $os (apenas Linux é suportado)"
        exit 1
    fi
    
    case $arch in
        x86_64)
            PIPER_BINARY="piper_linux_x86_64.tar.gz"
            ARCH_LABEL="amd64 (64-bit desktop Linux)"
            ;;
        aarch64|arm64)
            PIPER_BINARY="piper_linux_aarch64.tar.gz"
            ARCH_LABEL="arm64 (64-bit Raspberry Pi 4)"
            ;;
        armv7l)
            PIPER_BINARY="piper_linux_armv7l.tar.gz"
            ARCH_LABEL="armv7 (32-bit Raspberry Pi 3/4)"
            ;;
        *)
            print_error "Arquitetura não suportada: $arch"
            echo "Arquiteturas suportadas:"
            echo "  • x86_64 (amd64 - 64-bit desktop Linux)"
            echo "  • aarch64/arm64 (64-bit Raspberry Pi 4)"
            echo "  • armv7l (32-bit Raspberry Pi 3/4)"
            exit 1
            ;;
    esac
    
    PIPER_URL="${PIPER_BASE_URL}/${PIPER_BINARY}"
}

check_dependencies() {
    print_step "Verificando dependências mínimas..."
    
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
    
    local archive_path="$PIPER_DIR/$PIPER_BINARY"
    
    # Download do Piper
    if [ ! -f "$archive_path" ]; then
        download_file "$PIPER_URL" "$archive_path" "Piper TTS ($ARCH_LABEL)"
    else
        print_success "Piper TTS já baixado"
    fi
    
    # Extrair arquivo
    print_step "Extraindo Piper..."
    cd "$PIPER_DIR"
    tar -xzf "$PIPER_BINARY"
    
    # Mover arquivos para estrutura organizada
    if [ -d "piper" ]; then
        # Copiar executável
        cp piper/piper "$BIN_DIR/"
        chmod +x "$BIN_DIR/piper"
        
        # Copiar bibliotecas se existirem
        if [ -d "piper/lib" ]; then
            cp -r piper/lib "$PIPER_DIR/"
        fi
        
        # Copiar outros arquivos necessários
        find piper -name "*.so*" -exec cp {} "$BIN_DIR/" \; 2>/dev/null || true
        
        # Limpar diretório temporário
        rm -rf piper
    else
        print_error "Estrutura do arquivo não reconhecida"
        exit 1
    fi
    
    # Limpar arquivo temporário
    rm -f "$PIPER_BINARY"
    
    print_success "Piper TTS instalado"
}

install_models() {
    print_step "Instalando modelo de voz pt-BR..."
    
    local model_name="pt_BR-faber-medium"
    local model_file="$MODELS_DIR/${model_name}.onnx"
    local config_file="$MODELS_DIR/${model_name}.onnx.json"
    
    local model_url="${MODEL_BASE_URL}/pt/pt_BR/faber/medium/pt_BR-faber-medium.onnx"
    local config_url="${MODEL_BASE_URL}/pt/pt_BR/faber/medium/pt_BR-faber-medium.onnx.json"
    
    # Baixar modelo
    if [ ! -f "$model_file" ]; then
        download_file "$model_url" "$model_file" "modelo pt-BR"
    else
        print_success "Modelo pt-BR já existe"
    fi
    
    # Baixar configuração
    if [ ! -f "$config_file" ]; then
        download_file "$config_url" "$config_file" "configuração do modelo"
    else
        print_success "Configuração do modelo já existe"
    fi
    
    print_success "Modelo pt-BR instalado"
}

create_wrapper_script() {
    print_step "Criando script wrapper..."
    
    local wrapper_script="$PIPER_DIR/piper-wrapper.sh"
    
    cat > "$wrapper_script" << 'EOF'
#!/bin/bash

# Wrapper script para Piper TTS
# Configura ambiente e executa o Piper

# Diretório do script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIPER_EXECUTABLE="$SCRIPT_DIR/bin/piper"

# Configurar LD_LIBRARY_PATH para bibliotecas do Piper
export LD_LIBRARY_PATH="$SCRIPT_DIR/bin:$SCRIPT_DIR/lib:$LD_LIBRARY_PATH"

# Verificar se o executável Piper existe
if [ ! -x "$PIPER_EXECUTABLE" ]; then
    echo "Erro: Executável Piper não encontrado em $PIPER_EXECUTABLE" >&2
    echo "Execute o script de instalação primeiro." >&2
    exit 1
fi

# Executar Piper com todos os argumentos passados
exec "$PIPER_EXECUTABLE" "$@"
EOF
    
    chmod +x "$wrapper_script"
    print_success "Script wrapper criado"
}

test_installation() {
    print_step "Testando instalação..."
    
    local piper_executable="$BIN_DIR/piper"
    local model_file="$MODELS_DIR/pt_BR-faber-medium.onnx"
    local wrapper_script="$PIPER_DIR/piper-wrapper.sh"
    
    if [ ! -x "$piper_executable" ]; then
        print_error "Executável Piper não encontrado ou não executável"
        return 1
    fi
    
    if [ ! -f "$model_file" ]; then
        print_error "Modelo não encontrado: $model_file"
        return 1
    fi
    
    # Teste básico usando o wrapper
    print_step "Executando teste de síntese de voz..."
    if echo "Testando o Piper TTS em português brasileiro" | "$wrapper_script" \
        --model "$model_file" \
        --output_file "$PIPER_DIR/test.wav" 2>/dev/null; then
        
        if [ -f "$PIPER_DIR/test.wav" ]; then
            rm "$PIPER_DIR/test.wav"
            print_success "Teste do Piper passou"
        else
            print_error "Arquivo de áudio de teste não foi criado"
            return 1
        fi
    else
        print_error "Falha no teste do Piper"
        return 1
    fi
}

create_env_example() {
    print_step "Criando exemplo de configuração..."
    
    local env_example="$PROJECT_DIR/.env.piper.example"
    
    cat > "$env_example" << EOF
# Configuração Piper TTS - Adicione ao seu arquivo .env

# Habilitar Piper TTS local (usar wrapper para melhor compatibilidade)
PIPER_ENABLED=true

# Caminho para o wrapper script (recomendado)
PIPER_EXECUTABLE=$PIPER_DIR/piper-wrapper.sh

# Caminho para o modelo padrão
PIPER_MODEL=$MODELS_DIR/pt_BR-faber-medium.onnx

# Para usar:
# 1. Copie estas linhas para seu arquivo .env
# 2. Ou execute: cp .env.piper.example .env
# 3. Reinicie a aplicação
# 4. Use !voz no WhatsApp para ativar

# Nota: Este setup usa binários pré-compilados, sem dependências externas
EOF
    
    print_success "Arquivo .env.piper.example criado"
}

show_final_instructions() {
    echo -e "${GREEN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                    ✅ Instalação Concluída!                  ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    echo -e "${BLUE}🏗️ Arquitetura detectada: $ARCH_LABEL${NC}"
    echo
    echo -e "${BLUE}📁 Arquivos instalados:${NC}"
    echo "   • Executável: $BIN_DIR/piper"
    echo "   • Wrapper: $PIPER_DIR/piper-wrapper.sh (recomendado)"
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
    echo "   • Teste manual: echo 'Olá mundo' | $PIPER_DIR/piper-wrapper.sh --model $MODELS_DIR/pt_BR-faber-medium.onnx --output_file teste.wav"
    echo "   • Verificar versão: $PIPER_DIR/piper-wrapper.sh --version"
    echo
    echo -e "${GREEN}🎉 Vantagens desta instalação:${NC}"
    echo "   • ✅ Sem dependências externas (espeak-ng não necessário)"
    echo "   • ✅ Binários pré-compilados otimizados"
    echo "   • ✅ Instalação rápida e limpa"
    echo "   • ✅ Compatível com múltiplas arquiteturas"
    echo
}

main() {
    print_header
    
    detect_architecture
    
    echo -e "${BLUE}🔍 Sistema detectado: Linux ($ARCH_LABEL)${NC}"
    echo -e "${BLUE}📁 Diretório de instalação: $PIPER_DIR${NC}"
    echo -e "${BLUE}📦 Binário: $PIPER_BINARY${NC}"
    echo
    
    check_dependencies
    create_directories
    install_piper
    install_models
    create_wrapper_script
    test_installation
    create_env_example
    show_final_instructions
    
    echo -e "${GREEN}🎉 Piper TTS instalado com sucesso usando binários pré-compilados!${NC}"
}

# Executar apenas se chamado diretamente
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi