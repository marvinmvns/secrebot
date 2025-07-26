#!/bin/bash

# Check if running as root
if [ "$(id -u)" -ne 0 ]; then
  echo "Este script precisa ser executado como root. Por favor, execute com 'sudo'."
  exit 1
fi

echo "🔍 Iniciando stack de monitoramento completo..."

# Parar serviços existentes para evitar conflitos
echo "📛 Parando serviços existentes..."
docker-compose -f docker-compose.monitoring.yml down 2>/dev/null

# Aguardar um pouco
sleep 2

# Iniciar todos os serviços
echo "🚀 Iniciando todos os serviços de monitoramento..."
docker-compose -f docker-compose.monitoring.yml up -d

# Aguardar serviços subirem
echo "⏳ Aguardando serviços iniciarem..."
sleep 10

# Verificar status
echo "📊 Verificando status dos serviços..."

echo "--- Grafana (porta 3001) ---"
if curl -s http://localhost:3001/api/health > /dev/null; then
    echo "✅ Grafana: FUNCIONANDO"
else
    echo "❌ Grafana: FALHA"
fi

echo "--- Prometheus (porta 9090) ---"
if curl -s http://localhost:9090/-/healthy > /dev/null; then
    echo "✅ Prometheus: FUNCIONANDO"
else
    echo "❌ Prometheus: FALHA"
fi

echo "--- Alertmanager (porta 9093) ---"
if curl -s http://localhost:9093/-/healthy > /dev/null; then
    echo "✅ Alertmanager: FUNCIONANDO"
else
    echo "❌ Alertmanager: FALHA"
fi

echo ""
echo "🎯 Acesso aos serviços:"
echo "   Grafana: http://localhost:3001 (admin/admin123)"
echo "   Prometheus: http://localhost:9090"
echo "   Alertmanager: http://localhost:9093"
echo ""
echo "📋 Para ver logs: sudo docker-compose -f docker-compose.monitoring.yml logs -f"