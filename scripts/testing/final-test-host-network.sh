#!/bin/bash

echo "🚀 TESTE FINAL: Monitoramento com rede do host..."

echo "📋 Verificações preliminares..."
if curl -s http://localhost:3000/health > /dev/null; then
    echo "✅ SecreBot rodando em localhost:3000"
else
    echo "❌ SecreBot NÃO está rodando"
    exit 1
fi

if curl -s http://localhost:3000/metrics | grep -q "secrebot_"; then
    echo "✅ Métricas habilitadas"
else
    echo "❌ Habilitando métricas..."
    curl -s -X POST http://localhost:3000/api/observabilidade/config \
      -H "Content-Type: application/json" \
      -d '{"metricsCollectionEnabled": true, "grafanaEnabled": true, "prometheusEnabled": true, "alertmanagerEnabled": true}' > /dev/null
fi

echo ""
echo "📛 Reiniciando stack com rede do host..."
sudo docker-compose -f docker-compose.monitoring.yml down

echo "⏳ Aguardando 5 segundos..."
sleep 5

echo "🚀 Iniciando com network_mode: host..."
sudo docker-compose -f docker-compose.monitoring.yml up -d prometheus alertmanager grafana

echo "⏳ Aguardando 20 segundos para inicialização completa..."
sleep 20

echo ""
echo "🔍 Verificando serviços..."

# Verificar Prometheus
if curl -s http://localhost:9090/-/healthy > /dev/null; then
    echo "✅ Prometheus: FUNCIONANDO"
else
    echo "❌ Prometheus: FALHA"
fi

# Verificar Alertmanager
if curl -s http://localhost:9093/-/healthy > /dev/null; then
    echo "✅ Alertmanager: FUNCIONANDO"
else
    echo "❌ Alertmanager: FALHA"
fi

# Verificar Grafana
if curl -s http://localhost:3001/api/health > /dev/null; then
    echo "✅ Grafana: FUNCIONANDO"
else
    echo "❌ Grafana: FALHA"
fi

echo ""
echo "🧪 Gerando tráfego de teste..."
for i in {1..10}; do
    curl -s http://localhost:3000/health > /dev/null
    curl -s http://localhost:3000/api/system/stats > /dev/null
    curl -s http://localhost:3000/api/flow/list > /dev/null
    [ $((i % 3)) -eq 0 ] && echo "   Geradas $i requisições..."
done

echo "⏳ Aguardando 15 segundos para coleta..."
sleep 15

echo ""
echo "📊 Verificando targets no Prometheus..."
targets_result=$(curl -s http://localhost:9090/api/v1/targets 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    secrebot_targets = [t for t in data['data']['activeTargets'] if 'secrebot' in t['labels']['job']]
    if secrebot_targets:
        for target in secrebot_targets:
            job = target['labels']['job']
            health = target['health']
            url = target['scrapeUrl']
            print(f'   {job}: {health} ({url})')
    else:
        print('   Nenhum target SecreBot encontrado')
except Exception as e:
    print(f'   Erro: {e}')
" 2>/dev/null)

echo "$targets_result"

echo ""
echo "📈 Verificando métricas coletadas..."
metrics_result=$(curl -s "http://localhost:9090/api/v1/query?query=secrebot_http_requests_total" 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    results = data['data']['result']
    if results:
        print(f'✅ {len(results)} séries de métricas encontradas')
        # Mostrar algumas métricas
        for i, result in enumerate(results[:3]):
            metric = result['metric']
            value = result['value'][1]
            print(f'   - {metric.get(\"method\", \"?\")} {metric.get(\"route\", \"?\")} ({metric.get(\"status_code\", \"?\")}): {value}')
        if len(results) > 3:
            print(f'   ... e mais {len(results) - 3} métricas')
    else:
        print('❌ Nenhuma métrica encontrada')
except Exception as e:
    print(f'❌ Erro ao verificar métricas: {e}')
" 2>/dev/null)

echo "$metrics_result"

echo ""
echo "🎯 RESULTADO FINAL:"
if echo "$targets_result" | grep -q "up"; then
    echo "✅ SUCESSO! Prometheus consegue coletar métricas da aplicação"
    echo ""
    echo "📊 Dashboards funcionais:"
    echo "   Dashboard APIs: http://localhost:3001/d/secrebot-api-complete/secrebot-api-monitoring-completo"
    echo "   Prometheus: http://localhost:9090"
    echo "   Targets: http://localhost:9090/targets"
    echo ""
    echo "🔑 Login Grafana: admin / admin123"
else
    echo "❌ FALHA: Ainda há problemas de conectividade"
    echo "   Verifique os logs: sudo docker logs secrebot_prometheus"
fi