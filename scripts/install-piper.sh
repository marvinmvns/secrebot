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

# Carregar configuração dos modelos
CONFIG_FILE="$PROJECT_DIR/piper-models.json"
if [ ! -f "$CONFIG_FILE" ]; then
    print_error "Arquivo de configuração não encontrado: $CONFIG_FILE"
    exit 1
fi

# Função para extrair dados do JSON (requer jq ou python)
get_json_value() {
    local key=$1
    if command -v jq &> /dev/null; then
        jq -r "$key" "$CONFIG_FILE"
    elif command -v python3 &> /dev/null; then
        python3 -c "import json; data=json.load(open('$CONFIG_FILE')); print($key)" 2>/dev/null || echo "null"
    else
        print_error "jq ou python3 necessário para processar configuração"
        exit 1
    fi
}

# Carregar configuração do Piper
PIPER_VERSION=$(get_json_value '.piper.version')
PIPER_BASE_URL=$(get_json_value '.piper.baseUrl')

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

# Carregar URLs específicas da configuração
if [ "$OS" = "linux" ]; then
    REAL_ARCH=$ARCH  # Usar arquitetura real do sistema
    PIPER_ARCHIVE=$(get_json_value ".piper.architectures.linux.\"$REAL_ARCH\"")
elif [ "$OS" = "darwin" ]; then
    REAL_ARCH=$ARCH  # Usar arquitetura real do sistema
    PIPER_ARCHIVE=$(get_json_value ".piper.architectures.darwin.\"$REAL_ARCH\"")
else
    echo -e "${RED}❌ Sistema operacional não suportado: $OS${NC}"
    exit 1
fi

if [ "$PIPER_ARCHIVE" = "null" ] || [ -z "$PIPER_ARCHIVE" ]; then
    echo -e "${RED}❌ Arquitetura não suportada: $OS/$ARCH${NC}"
    exit 1
fi

PIPER_URL="${PIPER_BASE_URL}/${PIPER_ARCHIVE}"

# Função para obter modelos da configuração
get_default_model() {
    local lang=$(get_json_value '.default.language')
    local model=$(get_json_value '.default.model')
    echo "${lang}:${model}"
}

get_model_urls() {
    local lang=$1
    local model_name=$2
    local model_url=$(get_json_value ".models.\"$lang\"[] | select(.name == \"$model_name\") | .urls.model")
    local config_url=$(get_json_value ".models.\"$lang\"[] | select(.name == \"$model_name\") | .urls.config")
    local filename=$(get_json_value ".models.\"$lang\"[] | select(.name == \"$model_name\") | .filename")
    
    echo "${model_url}|${config_url}|${filename}"
}

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

install_espeak_ng() {
    print_step "Verificando e instalando espeak-ng..."
    
    # Verificar se espeak-ng já está instalado
    if command -v espeak-ng &> /dev/null && [ -d "/usr/share/espeak-ng-data" ]; then
        print_success "espeak-ng já está instalado"
        return 0
    fi
    
    print_step "Instalando espeak-ng..."
    
    # Detectar gerenciador de pacotes e instalar
    if command -v apt-get &> /dev/null; then
        print_step "Usando apt-get para instalar espeak-ng..."
        if sudo apt-get update && sudo apt-get install -y espeak-ng espeak-ng-data; then
            print_success "espeak-ng instalado via apt-get"
        else
            print_error "Falha ao instalar espeak-ng via apt-get"
            return 1
        fi
    elif command -v yum &> /dev/null; then
        print_step "Usando yum para instalar espeak-ng..."
        if sudo yum install -y espeak-ng; then
            print_success "espeak-ng instalado via yum"
        else
            print_error "Falha ao instalar espeak-ng via yum"
            return 1
        fi
    elif command -v dnf &> /dev/null; then
        print_step "Usando dnf para instalar espeak-ng..."
        if sudo dnf install -y espeak-ng; then
            print_success "espeak-ng instalado via dnf"
        else
            print_error "Falha ao instalar espeak-ng via dnf"
            return 1
        fi
    elif command -v pacman &> /dev/null; then
        print_step "Usando pacman para instalar espeak-ng..."
        if sudo pacman -S --noconfirm espeak-ng; then
            print_success "espeak-ng instalado via pacman"
        else
            print_error "Falha ao instalar espeak-ng via pacman"
            return 1
        fi
    elif command -v zypper &> /dev/null; then
        print_step "Usando zypper para instalar espeak-ng..."
        if sudo zypper install -y espeak-ng; then
            print_success "espeak-ng instalado via zypper"
        else
            print_error "Falha ao instalar espeak-ng via zypper"
            return 1
        fi
    else
        print_error "Gerenciador de pacotes não suportado. Instale espeak-ng manualmente:"
        echo "Ubuntu/Debian: sudo apt-get install espeak-ng espeak-ng-data"
        echo "CentOS/RHEL/Fedora: sudo yum install espeak-ng ou sudo dnf install espeak-ng"
        echo "Arch Linux: sudo pacman -S espeak-ng"
        echo "openSUSE: sudo zypper install espeak-ng"
        return 1
    fi
    
    # Verificar se a instalação foi bem-sucedida
    if [ ! -d "/usr/share/espeak-ng-data" ]; then
        print_error "Diretório espeak-ng-data não encontrado após instalação"
        print_error "Tente instalar manualmente: sudo apt-get install espeak-ng-data"
        return 1
    fi
    
    print_success "espeak-ng instalado e configurado"
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
    print_step "Instalando modelos de voz..."
    
    # Obter modelo padrão da configuração
    local default_model=$(get_default_model)
    local lang=${default_model%:*}
    local model_name=${default_model#*:}
    
    print_step "Baixando modelo: $lang/$model_name"
    
    # Obter URLs do modelo
    local model_info=$(get_model_urls "$lang" "$model_name")
    local model_url=${model_info%%|*}
    local remaining=${model_info#*|}
    local config_url=${remaining%%|*}
    local filename=${remaining#*|}
    
    if [ "$model_url" = "null" ] || [ -z "$model_url" ]; then
        print_error "Modelo não encontrado na configuração: $lang/$model_name"
        return 1
    fi
    
    local model_file="$MODELS_DIR/${filename}.onnx"
    local config_file="$MODELS_DIR/${filename}.onnx.json"
    
    # Baixar modelo
    if [ ! -f "$model_file" ]; then
        download_file "$model_url" "$model_file" "modelo $lang/$model_name"
    else
        print_success "Modelo $lang/$model_name já existe"
    fi
    
    # Baixar configuração
    if [ ! -f "$config_file" ]; then
        download_file "$config_url" "$config_file" "configuração do modelo"
    else
        print_success "Configuração do modelo já existe"
    fi
    
    print_success "Modelos instalados"
}

test_installation() {
    print_step "Testando instalação..."
    
    local piper_executable="$BIN_DIR/piper"
    
    # Obter modelo padrão para teste
    local default_model=$(get_default_model)
    local lang=${default_model%:*}
    local model_name=${default_model#*:}
    local model_info=$(get_model_urls "$lang" "$model_name")
    local filename=${model_info##*|}
    local model_file="$MODELS_DIR/${filename}.onnx"
    
    if [ ! -x "$piper_executable" ]; then
        print_error "Executável Piper não encontrado ou não executável"
        return 1
    fi
    
    if [ ! -f "$model_file" ]; then
        print_error "Modelo não encontrado: $model_file"
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

create_wrapper_script() {
    print_step "Criando script wrapper..."
    
    local wrapper_script="$PIPER_DIR/piper-wrapper.sh"
    
    cat > "$wrapper_script" << 'EOF'
#!/bin/bash

# Wrapper script para Piper TTS com configuração de ambiente
# Garante que todas as dependências estejam disponíveis

# Diretório do script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIPER_EXECUTABLE="$SCRIPT_DIR/bin/piper"

# Configurar LD_LIBRARY_PATH para bibliotecas do Piper
export LD_LIBRARY_PATH="$SCRIPT_DIR/bin:$SCRIPT_DIR/lib:$LD_LIBRARY_PATH"

# Verificar se espeak-ng está disponível
if ! command -v espeak-ng &> /dev/null; then
    echo "Erro: espeak-ng não encontrado. Execute o script de instalação primeiro." >&2
    exit 1
fi

# Verificar se os dados do espeak-ng existem
if [ ! -d "/usr/share/espeak-ng-data" ]; then
    echo "Erro: Dados do espeak-ng não encontrados em /usr/share/espeak-ng-data" >&2
    echo "Execute: sudo apt-get install espeak-ng-data" >&2
    exit 1
fi

# Verificar se o executável Piper existe
if [ ! -x "$PIPER_EXECUTABLE" ]; then
    echo "Erro: Executável Piper não encontrado em $PIPER_EXECUTABLE" >&2
    exit 1
fi

# Executar Piper com todos os argumentos passados
exec "$PIPER_EXECUTABLE" "$@"
EOF
    
    chmod +x "$wrapper_script"
    print_success "Script wrapper criado"
}

create_env_example() {
    print_step "Criando exemplo de configuração..."
    
    # Obter modelo padrão para configuração
    local default_model=$(get_default_model)
    local lang=${default_model%:*}
    local model_name=${default_model#*:}
    local model_info=$(get_model_urls "$lang" "$model_name")
    local filename=${model_info##*|}
    
    local env_example="$PROJECT_DIR/.env.piper.example"
    
    cat > "$env_example" << EOF
# Configuração Piper TTS - Adicione ao seu arquivo .env

# Habilitar Piper TTS local
PIPER_ENABLED=true

# Caminho para o executável Piper (use o wrapper para melhor compatibilidade)
PIPER_EXECUTABLE=$PIPER_DIR/piper-wrapper.sh

# Caminho para o modelo padrão ($lang/$model_name)
PIPER_MODEL=$MODELS_DIR/${filename}.onnx

# Exemplo de configuração completa:
# cp .env.piper.example .env
# ou adicione essas linhas ao seu .env existente

# Nota: Modelos disponíveis estão definidos em piper-models.json
# Para usar outro modelo, baixe-o primeiro com o script de instalação
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
    echo "   • Wrapper: $PIPER_DIR/piper-wrapper.sh (recomendado)"
    echo "   • Modelo pt-BR: $MODELS_DIR/pt_BR-faber-medium.onnx"
    echo "   • Configuração: .env.piper.example"
    echo "   • espeak-ng: /usr/share/espeak-ng-data (dependência)"
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
    echo "   • Teste direto: echo 'Olá mundo' | $BIN_DIR/piper --model $MODELS_DIR/pt_BR-faber-medium.onnx --output_file teste.wav"
    echo
}

main() {
    print_header
    
    echo -e "${BLUE}🔍 Sistema detectado: $OS ($ARCH)${NC}"
    echo -e "${BLUE}📁 Diretório de instalação: $PIPER_DIR${NC}"
    echo
    
    check_dependencies
    install_espeak_ng
    create_directories
    install_piper
    install_models
    create_wrapper_script
    test_installation
    create_env_example
    show_final_instructions
    
    echo -e "${GREEN}🎉 Piper TTS com modelo pt-BR instalado com sucesso!${NC}"
}

# Executar apenas se chamado diretamente
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi