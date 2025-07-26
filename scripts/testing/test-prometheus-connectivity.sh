#!/bin/bash

echo "🔧 Testando conectividade Prometheus → SecreBot..."

echo "1. Verificando se SecreBot está acessível localmente..."
if curl -s http://localhost:3000/health > /dev/null; then
    echo "✅ SecreBot responde em localhost:3000"
else
    echo "❌ SecreBot NÃO responde em localhost:3000"
    exit 1
fi

echo "2. Verificando se métricas estão acessíveis..."
if curl -s http://localhost:3000/metrics | grep -q "secrebot_"; then
    echo "✅ Métricas SecreBot disponíveis"
else
    echo "❌ Métricas SecreBot NÃO disponíveis"
    exit 1
fi

echo "3. Verificando se Prometheus está rodando..."
if curl -s http://localhost:9090/-/healthy > /dev/null; then
    echo "✅ Prometheus está rodando"
else
    echo "❌ Prometheus NÃO está rodando"
    exit 1
fi

echo "4. Verificando targets do Prometheus..."
target_status=$(curl -s http://localhost:9090/api/v1/targets | jq -r '.data.activeTargets[] | select(.labels.job == "secrebot-app") | .health')

if [ "$target_status" = "up" ]; then
    echo "✅ Target SecreBot está UP"
    
    echo "5. Testando coleta de métricas..."
    metrics_count=$(curl -s "http://localhost:9090/api/v1/query?query=secrebot_http_requests_total" | jq -r '.data.result | length')
    
    if [ "$metrics_count" -gt "0" ]; then
        echo "✅ Métricas sendo coletadas: $metrics_count séries"
        echo ""
        echo "🎉 SUCESSO! Monitoramento funcionando perfeitamente!"
        echo ""
        echo "📊 Acesse os dashboards:"
        echo "   • Grafana: http://localhost:3001 (admin/admin123)"
        echo "   • Prometheus: http://localhost:9090"
        echo "   • Targets: http://localhost:9090/targets"
    else
        echo "⚠️  Target UP mas sem métricas coletadas ainda"
        echo "   Aguarde alguns segundos e tente novamente"
    fi
else
    echo "❌ Target SecreBot está DOWN: $target_status"
    
    echo "   Erro details:"
    curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | select(.labels.job == "secrebot-app") | .lastError'
    
    echo ""
    echo "🔧 Tentando soluções..."
    
    echo "   Forçando reload do Prometheus..."
    curl -s -X POST http://localhost:9090/-/reload
    
    echo "   Aguardando 15 segundos..."
    sleep 15
    
    echo "   Verificando novamente..."
    new_status=$(curl -s http://localhost:9090/api/v1/targets | jq -r '.data.activeTargets[] | select(.labels.job == "secrebot-app") | .health')
    
    if [ "$new_status" = "up" ]; then
        echo "✅ Problema resolvido! Target agora está UP"
    else
        echo "❌ Problema persiste. Verifique:"
        echo "     1. Se a aplicação está rodando em localhost:3000"
        echo "     2. Se não há firewall bloqueando"
        echo "     3. Se o Prometheus está usando network_mode: host"
    fi
fi