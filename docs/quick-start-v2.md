# SecreBot v2.0 - Guia de Início Rápido

## 🚀 Instalação Completa

### Pré-requisitos
```bash
# Node.js 18+ e MongoDB 6.0+
node --version  # >= 18.0.0
mongod --version  # >= 6.0.0

# Ollama para LLM local
curl -fsSL https://ollama.ai/install.sh | sh
ollama serve
```

### Setup Rápido
```bash
# Clone e instale dependências
git clone <repository-url>
cd secrebot
make all  # Instala tudo: deps + piper + env

# Configure ambiente
cp .env.example .env
# Edite .env com suas configurações

# Inicie o sistema
make start
```

## 📊 Ativando Monitoramento (Novo!)

### Setup Grafana + Prometheus
```bash
# 1. Habilite métricas no .env
echo "GRAFANA_METRICS_ENABLED=true" >> .env

# 2. Inicie stack de monitoramento
docker-compose -f docker-compose.monitoring.yml up -d

# 3. Acesse dashboards
# Grafana: http://localhost:3000 (admin/admin)
# Prometheus: http://localhost:9090
```

### Configuração Inicial do Grafana
1. Login: `admin` / `admin`
2. Vá para Dashboards → SecreBot
3. Selecione "SecreBot - Overview Dashboard"
4. Configure alertas em Alerting → Alert Rules

## 🧪 Criando seu Primeiro A/B Test

### 1. Acesse o Flow Builder
```bash
# Interface web
http://localhost:3000/flow-builder
```

### 2. Crie Nó LLM com Variantes
```json
{
  "type": "llm",
  "data": {
    "label": "Assistente IA",
    "prompt": "Prompt padrão",
    "promptVariants": [
      {
        "id": "formal",
        "name": "Tom Formal",
        "prompt": "Sou um assistente profissional...",
        "weight": 50
      },
      {
        "id": "casual", 
        "name": "Tom Casual",
        "prompt": "Oi! Sou seu assistente...",
        "weight": 50
      }
    ]
  }
}
```

### 3. Execute e Monitore
```bash
# Teste o fluxo
!flow start meu-teste

# Veja resultados no Grafana
# Dashboard → A/B Testing Results
```

## ✅ Validação Automática

### Valide Fluxos via CLI
```bash
# Instale CLI globalmente
npm install -g

# Valide um fluxo
flow-manager validate <flowId>

# Valide todos os fluxos
flow-manager validate-all
```

### Integre com CI/CD
```yaml
# .github/workflows/validate-flows.yml
name: Validate Flows
on: [push, pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm run validate-flows
```

## 🎨 Usando Templates Prontos

### Templates Disponíveis
```bash
# Liste templates
ls template/

# Importe template
flow-manager import template/academia.json

# Customize para sua marca
flow-manager customize academia-flow \
  --brand "Minha Academia" \
  --contact "+5511999999999"
```

### Templates por Área
- 🏃‍♂️ **Academia**: `academia.json`
- 🥊 **Jiu-Jitsu**: `jiu-jitsu.json`
- 💼 **Consultoria**: `consultoria.json`
- 🎓 **Educação**: `educacao.json`

## 🧪 Testes Automatizados

### Configurar Ambiente de Teste
```bash
# 1. Instale dependências de teste
npx playwright install

# 2. Configure MongoDB de teste
export MONGO_URI_TEST="mongodb://localhost:27017/secrebot-test"

# 3. Execute testes
npm test
```

### Teste Específico de Fluxo
```bash
# Teste um fluxo específico
npm test -- --grep "academia"

# Teste com IA (validação semântica)
node test/flow-llm-tester.js academia-flow
```

## 🔧 Configurações Essenciais

### .env Completo
```bash
# Core
NODE_ENV=production
PORT=3000
MONGO_URI=mongodb://localhost:27017/secrebot

# LLM
OLLAMA_HOST=http://localhost:11434
LLM_MODEL=llama3.2

# Monitoramento (Novo!)
GRAFANA_METRICS_ENABLED=true
PROMETHEUS_SCRAPE_INTERVAL=15s

# TTS (Opcional)
PIPER_ENABLED=true
# ou
ELEVENLABS_API_KEY=your_key_here

# Integração (Opcional)
CALORIE_API_KEY=your_key
LINKEDIN_USER=user@domain.com
LINKEDIN_PASS=password
```

### Performance Tuning
```bash
# config/config.js - Otimizações
export const CONFIG = {
  llm: {
    useBalancer: true,      // Pool de conexões
    maxTimeout: 1200000,    // 20min timeout
    cacheEnabled: true      // Cache de respostas
  },
  monitoring: {
    enabled: true,
    scrapeInterval: '15s'
  }
}
```

## 📈 Comandos Essenciais

### Operação Diária
```bash
# Status do sistema
make status

# Reiniciar aplicação
pm2 restart 0

# Ver logs em tempo real
pm2 logs 0 --lines 100

# Backup de fluxos
flow-manager backup-all
```

### Monitoramento
```bash
# Ver métricas via CLI
flow-manager metrics summary

# Analytics de fluxos
flow-manager analytics

# Relatório A/B testing
flow-manager ab-report
```

### Manutenção
```bash
# Limpeza de cache
flow-manager clean-cache

# Otimizar banco de dados
flow-manager optimize-db

# Verificar integridade
flow-manager health-check
```

## 🎯 Casos de Uso Comuns

### 1. Academia/Fitness
```bash
# Importe template
flow-manager import template/academia.json

# Configure horários
flow-manager config academia-flow \
  --schedule "Segunda a Sexta: 6h-22h"

# Ative A/B test para mensagens motivacionais
# Edite via Flow Builder: diferentes tons motivacionais
```

### 2. Atendimento Cliente
```bash
# Template consultoria empresarial
flow-manager import template/consultoria.json

# Configure integrações
flow-manager config consultoria-flow \
  --webhook-url "https://seu-crm.com/webhook" \
  --calendar-integration true
```

### 3. Educação/Cursos
```bash
# Template educacional
flow-manager import template/educacao.json

# Configure materiais
flow-manager config educacao-flow \
  --material-base-url "https://seus-materiais.com/"
```

## 🔍 Troubleshooting

### Problemas Comuns

#### Métricas não aparecem no Grafana
```bash
# Verifique se endpoint está ativo
curl http://localhost:3000/metrics

# Reinicie stack de monitoramento
docker-compose -f docker-compose.monitoring.yml restart
```

#### A/B Test não seleciona variantes
```bash
# Verifique estrutura do nó LLM
flow-manager validate <flowId>

# Debug logs
tail -f logs/app.log | grep "A/B Test"
```

#### Fluxo não executa
```bash
# Verifique Ollama
curl http://localhost:11434/api/version

# Verifique MongoDB
mongosh --eval "db.adminCommand('ping')"

# Logs detalhados
pm2 logs 0 --lines 200
```

### Suporte
- 📖 Documentação: `/docs/`
- 🐛 Issues: GitHub Issues
- 💬 Comunidade: Discord SecreBot
- 📧 Email: support@secrebot.dev

## 🎯 Próximos Passos

1. **Monitore**: Configure alertas no Grafana
2. **Teste**: Implemente A/B testing nos seus fluxos
3. **Optimize**: Use métricas para melhorar performance
4. **Escale**: Configure cluster Ollama se necessário
5. **Integre**: Conecte com seus sistemas existentes

*Pronto para revolucionar seu atendimento WhatsApp com IA! 🚀*