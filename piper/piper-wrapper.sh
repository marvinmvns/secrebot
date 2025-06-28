#!/bin/bash

# Wrapper script para Piper TTS
# Configura todas as variáveis de ambiente necessárias

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIPER_DIR="$SCRIPT_DIR"
BIN_DIR="$PIPER_DIR/bin"

# Configurar LD_LIBRARY_PATH
export LD_LIBRARY_PATH="$BIN_DIR:$LD_LIBRARY_PATH"

# Configurar ESPEAK_NG_DATA_PATH se necessário
if [ ! -d "/usr/share/espeak-ng-data" ]; then
    # Tentar encontrar dados do espeak-ng em locais alternativos
    for possible_path in \
        "/usr/local/share/espeak-ng-data" \
        "/opt/espeak-ng/share/espeak-ng-data" \
        "$BIN_DIR/../share/espeak-ng-data" \
        "$BIN_DIR/espeak-ng-data"; do
        if [ -d "$possible_path" ]; then
            export ESPEAK_NG_DATA_PATH="$possible_path"
            break
        fi
    done
fi

# Executar Piper
exec "$BIN_DIR/piper" "$@"