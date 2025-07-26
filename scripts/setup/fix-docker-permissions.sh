#!/bin/bash

# Script para resolver problemas de permissões do Docker
# Uso: ./scripts/setup/fix-docker-permissions.sh

set -e

echo "🐳 Diagnóstico de Permissões Docker"
echo "=================================="

# Verificar se usuário está no grupo docker
if groups $USER | grep -q docker; then
    echo "✅ Usuário está no grupo docker"
else
    echo "❌ Usuário NÃO está no grupo docker"
    echo "Execute: sudo usermod -aG docker $USER"
    exit 1
fi

# Verificar socket do docker
if [ -S /var/run/docker.sock ]; then
    echo "✅ Socket Docker existe"
    ls -la /var/run/docker.sock
else
    echo "❌ Socket Docker não encontrado"
    exit 1
fi

# Testar acesso ao Docker
echo ""
echo "🧪 Testando acesso ao Docker..."
if docker version > /dev/null 2>&1; then
    echo "✅ Docker funcionando"
    docker version --format "{{.Server.Version}}"
else
    echo "❌ Erro de permissão detectado"
    echo ""
    echo "🔧 Soluções:"
    echo "1. Faça logout/login para aplicar grupo docker"
    echo "2. Ou execute: newgrp docker"
    echo "3. Ou reinicie o sistema"
    echo ""
    echo "Executando newgrp docker para esta sessão..."
    exec newgrp docker
fi

echo ""
echo "✅ Docker configurado corretamente!"