#!/bin/bash

echo "🧪 Testando monitoramento de APIs do SecreBot..."

echo "📊 Gerando tráfego de API para testar métricas..."

# Core APIs
echo "Testing Core APIs..."
for i in {1..5}; do
    curl -s http://localhost:3000/health > /dev/null
    curl -s http://localhost:3000/metrics > /dev/null
done

# System Management APIs
echo "Testing System Management APIs..."
for i in {1..3}; do
    curl -s http://localhost:3000/api/system/stats > /dev/null
    curl -s http://localhost:3000/api/processing/stats > /dev/null
    curl -s http://localhost:3000/api/configs > /dev/null
done

# Flow Management APIs
echo "Testing Flow Management APIs..."
for i in {1..3}; do
    curl -s http://localhost:3000/api/flow/list > /dev/null
    curl -s http://localhost:3000/api/flow/templates > /dev/null
    curl -s http://localhost:3000/api/flow/stats > /dev/null
done

# Integration APIs
echo "Testing Integration APIs..."
for i in {1..2}; do
    curl -s http://localhost:3000/api/linkedin/status > /dev/null
    curl -s http://localhost:3000/api/whisper-api/status > /dev/null
    curl -s http://localhost:3000/api/ollama-api/status > /dev/null
done

# Observability APIs
echo "Testing Observability APIs..."
for i in {1..3}; do
    curl -s http://localhost:3000/api/observabilidade/status > /dev/null
done

# Content Processing (pages)
echo "Testing Content Processing pages..."
for i in {1..2}; do
    curl -s http://localhost:3000/describe > /dev/null
    curl -s http://localhost:3000/calories > /dev/null
    curl -s http://localhost:3000/summarize > /dev/null
    curl -s http://localhost:3000/chat > /dev/null
done

echo "⏳ Aguardando 10 segundos para coleta de métricas..."
sleep 10

echo ""
echo "📈 Verificando métricas coletadas..."

echo "=== HTTP Requests Total ==="
curl -s http://localhost:3000/metrics | grep "secrebot_http_requests_total{" | head -5

echo ""
echo "=== API Category Metrics ==="
curl -s http://localhost:3000/metrics | grep "secrebot_api_category_requests_total{" | head -5

echo ""
echo "=== API Category Duration ==="
curl -s http://localhost:3000/metrics | grep "secrebot_api_category_duration_seconds" | head -3

echo ""
echo "🎯 Resultados:"
echo "✅ Tráfego de API gerado com sucesso"
echo "📊 Acesse o Grafana para ver os dashboards:"
echo "   - Dashboard Geral: http://localhost:3001/d/secrebot-overview/secrebot-overview"
echo "   - Dashboard APIs: http://localhost:3001/d/secrebot-api/secrebot-api-monitoring"
echo "🔍 Prometheus Targets: http://localhost:9090/targets"
echo "📢 Alertmanager: http://localhost:9093"

echo ""
echo "🔧 Status dos serviços de monitoramento:"
curl -s http://localhost:3000/api/observabilidade/status | python3 -m json.tool | grep -E "(grafana|prometheus|alertmanager).*true"