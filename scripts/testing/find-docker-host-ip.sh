#!/bin/bash

echo "🔍 Descobrindo como o Docker pode acessar o host..."

echo "1. Verificando IP da bridge Docker..."
docker_bridge_ip=$(ip route | grep docker0 | grep src | awk '{print $9}' | head -1)
echo "   Docker Bridge IP: $docker_bridge_ip"

echo "2. Verificando gateway padrão..."
default_gateway=$(ip route | grep default | awk '{print $3}' | head -1)
echo "   Default Gateway: $default_gateway"

echo "3. Testando conectividade do host para a aplicação..."
if curl -s http://localhost:3000/health > /dev/null; then
    echo "✅ Host pode acessar localhost:3000"
else
    echo "❌ Host NÃO pode acessar localhost:3000"
fi

echo "4. Testando diferentes IPs para acesso do Docker..."

# Testar IP da bridge
if [ -n "$docker_bridge_ip" ]; then
    echo "   Testando $docker_bridge_ip:3000 de dentro do container..."
    if sudo docker run --rm --network=monitoring_monitoring alpine/curl:latest curl -s -m 5 http://$docker_bridge_ip:3000/health > /dev/null 2>&1; then
        echo "✅ Docker pode acessar $docker_bridge_ip:3000"
        recommended_ip="$docker_bridge_ip"
    else
        echo "❌ Docker NÃO pode acessar $docker_bridge_ip:3000"
    fi
fi

# Testar host.docker.internal
echo "   Testando host.docker.internal:3000 de dentro do container..."
if sudo docker run --rm --network=monitoring_monitoring alpine/curl:latest curl -s -m 5 http://host.docker.internal:3000/health > /dev/null 2>&1; then
    echo "✅ Docker pode acessar host.docker.internal:3000"
    recommended_ip="host.docker.internal"
else
    echo "❌ Docker NÃO pode acessar host.docker.internal:3000"
fi

# Usar network_mode: host como alternativa
echo ""
echo "💡 SOLUÇÕES POSSÍVEIS:"

if [ -n "$recommended_ip" ]; then
    echo "1. ✅ Usar IP recomendado: $recommended_ip:3000"
    echo "   Atualizando prometheus.yml..."
    
    # Atualizar prometheus.yml com o IP correto
    sed -i "s|targets: \['.*:3000'\]|targets: ['$recommended_ip:3000']|g" monitoring/prometheus/prometheus.yml
    echo "   ✅ prometheus.yml atualizado"
else
    echo "1. 🔧 Usar network_mode: host (recomendado para aplicação no host)"
    echo "2. 🔧 Usar --add-host no Docker Compose"
    echo "3. 🔧 Expor métricas na interface 0.0.0.0 em vez de localhost"
fi

echo ""
echo "🔄 Reiniciando Prometheus com nova configuração..."
sudo docker-compose -f docker-compose.monitoring.yml restart prometheus

echo "⏳ Aguardando 10 segundos..."
sleep 10

echo "📊 Verificando targets após restart..."
curl -s http://localhost:9090/api/v1/targets | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    for target in data['data']['activeTargets']:
        job = target['labels']['job']
        health = target['health']
        url = target['scrapeUrl']
        if 'secrebot' in job:
            print(f'   {job}: {health} ({url})')
except:
    print('   Erro ao verificar targets')
" 2>/dev/null || echo "   Erro ao conectar com Prometheus"