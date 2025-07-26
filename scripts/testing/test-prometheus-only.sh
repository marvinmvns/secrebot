#!/bin/bash

echo "🔧 Testando Prometheus sem regras de alerta..."

echo "📛 Parando stack..."
sudo docker-compose -f docker-compose.monitoring.yml stop prometheus

echo "⏳ Aguardando 3 segundos..."
sleep 3

echo "🚀 Iniciando apenas Prometheus..."
sudo docker-compose -f docker-compose.monitoring.yml up -d prometheus

echo "⏳ Aguardando 10 segundos..."
sleep 10

echo "📊 Testando Prometheus..."
if curl -s http://localhost:9090/-/healthy > /dev/null; then
    echo "✅ Prometheus: FUNCIONANDO SEM REGRAS!"
    echo "🎯 Problema estava nas regras de alerta"
else
    echo "❌ Prometheus: AINDA COM FALHA"
    echo "🔍 Verificando logs do Prometheus..."
    sudo docker logs secrebot_prometheus 2>/dev/null | tail -10
fi