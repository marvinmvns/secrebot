# SecreBot v2.0 - API Reference

## 📊 Metrics API (Novo)

### GET /metrics
Endpoint para coleta de métricas pelo Prometheus.

```bash
curl http://localhost:3000/metrics
```

**Response:**
```
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",status="200"} 1234

# HELP llm_requests_total Total LLM requests
# TYPE llm_requests_total counter
llm_requests_total{user="5511999999999",model="llama3.2"} 45
```

### GET /api/metrics/summary
Resumo das métricas do sistema.

**Response:**
```json
{
  "http": {
    "totalRequests": 1234,
    "averageLatency": 150,
    "errorRate": 0.02
  },
  "llm": {
    "totalRequests": 89,
    "averageLatency": 2300,
    "totalTokens": 45000
  },
  "whatsapp": {
    "totalMessages": 567,
    "activeUsers": 23,
    "commandsUsed": 145
  }
}
```

---

## 🧪 A/B Testing API (Novo)

### POST /api/flows/{flowId}/ab-test
Configura teste A/B para um nó específico.

**Request:**
```json
{
  "nodeId": "llm-node-1",
  "variants": [
    {
      "id": "variant-a",
      "name": "Formal",
      "prompt": "Professionally assist...",
      "weight": 50
    },
    {
      "id": "variant-b", 
      "name": "Casual",
      "prompt": "Hey! Let me help...",
      "weight": 50
    }
  ],
  "strategy": "weighted"
}
```

**Response:**
```json
{
  "success": true,
  "abTestId": "ab-test-123",
  "message": "A/B test configured successfully"
}
```

### GET /api/flows/{flowId}/ab-results
Resultados do teste A/B.

**Query Parameters:**
- `period`: `1h`, `24h`, `7d`, `30d`
- `variant`: ID da variante específica

**Response:**
```json
{
  "testId": "ab-test-123",
  "period": "7d",
  "results": [
    {
      "variantId": "variant-a",
      "variantName": "Formal",
      "selections": 156,
      "conversions": 89,
      "conversionRate": 0.57,
      "avgLatency": 2.3
    },
    {
      "variantId": "variant-b",
      "variantName": "Casual", 
      "selections": 144,
      "conversions": 98,
      "conversionRate": 0.68,
      "avgLatency": 2.1
    }
  ],
  "winningVariant": "variant-b",
  "statisticalSignificance": 0.95
}
```

---

## ✅ Validation API (Novo)

### POST /api/flows/{flowId}/validate
Valida estrutura e regras do fluxo.

**Response:**
```json
{
  "isValid": true,
  "errors": [],
  "warnings": [
    {
      "type": "performance",
      "message": "LLM node without balancer may cause delays",
      "nodeId": "llm-node-2"
    }
  ],
  "suggestions": [
    {
      "type": "optimization",
      "message": "Consider adding retry logic to webhook node",
      "nodeId": "webhook-node-1"
    }
  ]
}
```

### POST /api/flows/{flowId}/test
Executa testes automáticos do fluxo.

**Request:**
```json
{
  "scenarios": [
    {
      "name": "happy_path",
      "inputs": ["1", "Desenvolvedor", "Crescer na carreira"],
      "expectedOutputs": ["recomendações", "próximos passos"]
    }
  ],
  "mockLLM": {
    "pergunta sobre carreira": "Baseado no seu perfil..."
  }
}
```

**Response:**
```json
{
  "testId": "test-789",
  "results": {
    "passed": 8,
    "failed": 1,
    "duration": 45.2,
    "scenarios": [
      {
        "name": "happy_path",
        "status": "passed",
        "duration": 12.5,
        "steps": 6,
        "outputs": ["✅ Recomendações geradas", "✅ Próximos passos claros"]
      }
    ]
  }
}
```

---

## 🔄 Flow Versioning API (Novo)

### POST /api/flows/{flowId}/versions
Cria nova versão do fluxo.

**Request:**
```json
{
  "description": "Adicionado validação de entrada",
  "changes": [
    "Novo nó de validação de dados",
    "Melhorado tratamento de erro"
  ],
  "flowData": {
    "nodes": [...],
    "metadata": {...}
  }
}
```

**Response:**
```json
{
  "versionId": "v1.2.3",
  "flowId": "flow-123",
  "status": "draft",
  "createdAt": "2025-01-26T10:30:00Z",
  "createdBy": "user@domain.com"
}
```

### GET /api/flows/{flowId}/versions
Lista todas as versões do fluxo.

**Response:**
```json
{
  "versions": [
    {
      "versionId": "v1.2.3",
      "status": "draft",
      "description": "Adicionado validação de entrada",
      "createdAt": "2025-01-26T10:30:00Z",
      "createdBy": "user@domain.com"
    },
    {
      "versionId": "v1.2.2", 
      "status": "published",
      "description": "Correção de bugs",
      "createdAt": "2025-01-25T15:20:00Z",
      "publishedAt": "2025-01-25T16:00:00Z"
    }
  ]
}
```

### POST /api/flows/{flowId}/versions/{versionId}/publish
Publica uma versão específica.

**Response:**
```json
{
  "success": true,
  "versionId": "v1.2.3",
  "status": "published",
  "publishedAt": "2025-01-26T11:00:00Z"
}
```

---

## 📈 Analytics API (Expandido)

### GET /api/analytics/flows
Analytics gerais de fluxos.

**Query Parameters:**
- `period`: `1h`, `24h`, `7d`, `30d`
- `flowId`: ID específico do fluxo

**Response:**
```json
{
  "period": "7d",
  "totalExecutions": 1234,
  "uniqueUsers": 456,
  "averageCompletionRate": 0.78,
  "topFlows": [
    {
      "flowId": "academia-flow",
      "name": "Academia Fitness",
      "executions": 456,
      "completionRate": 0.85,
      "avgDuration": 180
    }
  ],
  "hourlyDistribution": {
    "09": 45,
    "10": 67,
    "11": 89
  }
}
```

### GET /api/analytics/users
Analytics de usuários.

**Response:**
```json
{
  "totalUsers": 1567,
  "activeUsers": {
    "daily": 234,
    "weekly": 567,
    "monthly": 1234
  },
  "userSegments": {
    "new": 145,
    "returning": 422,
    "power_users": 67
  },
  "engagement": {
    "avgSessionDuration": 245,
    "avgMessagesPerSession": 8.5,
    "bounceRate": 0.23
  }
}
```

### GET /api/analytics/performance
Métricas de performance.

**Response:**
```json
{
  "system": {
    "uptime": 0.999,
    "avgResponseTime": 156,
    "errorRate": 0.002
  },
  "llm": {
    "avgLatency": 2300,
    "successRate": 0.998,
    "tokensPerSecond": 45.6,
    "queueLength": 2
  },
  "database": {
    "connectionPool": {
      "active": 8,
      "idle": 2,
      "max": 10
    },
    "avgQueryTime": 23
  }
}
```

---

## 🎯 Flow Execution API (Melhorado)

### POST /api/flows/{flowId}/execute
Executa fluxo para usuário específico.

**Request:**
```json
{
  "userId": "5511999999999",
  "initialData": {
    "userName": "João",
    "context": "primeira_execução"
  },
  "options": {
    "testMode": false,
    "mockLLM": false,
    "timeout": 1200000
  }
}
```

**Response:**
```json
{
  "executionId": "exec-123",
  "status": "started",
  "currentNodeId": "start-1",
  "estimatedDuration": 300
}
```

### GET /api/flows/executions/{executionId}
Status da execução.

**Response:**
```json
{
  "executionId": "exec-123",
  "flowId": "academia-flow",
  "userId": "5511999999999",
  "status": "running",
  "currentNodeId": "llm-node-2",
  "progress": {
    "completed": 3,
    "total": 8,
    "percentage": 37.5
  },
  "variables": {
    "userName": "João",
    "selectedPlan": "premium",
    "selectedPromptVariant": "casual"
  },
  "startedAt": "2025-01-26T10:30:00Z",
  "estimatedCompletion": "2025-01-26T10:35:00Z"
}
```

### POST /api/flows/executions/{executionId}/input
Enviar entrada do usuário para execução ativa.

**Request:**
```json
{
  "message": "Quero treinar 3x por semana",
  "type": "text"
}
```

**Response:**
```json
{
  "success": true,
  "nextNodeId": "condition-node-1",
  "waitingForInput": false
}
```

---

## 🎨 Templates API (Expandido)

### GET /api/templates
Lista templates disponíveis.

**Query Parameters:**
- `category`: `fitness`, `education`, `business`, `martial_arts`
- `featured`: `true`/`false`

**Response:**
```json
{
  "templates": [
    {
      "id": "academia-template",
      "name": "Academia Fitness Completa",
      "description": "Sistema completo para academias...",
      "category": "fitness",
      "featured": true,
      "preview": "https://...",
      "nodes": 24,
      "estimatedSetup": 15,
      "features": ["agendamento", "planos", "nutrição"]
    }
  ]
}
```

### POST /api/templates/{templateId}/import
Importa template com customizações.

**Request:**
```json
{
  "flowName": "Minha Academia",
  "customizations": {
    "brandName": "Academia Power Fit",
    "contact": "+5511999999999",
    "schedule": "Segunda a Sexta: 6h-22h",
    "services": ["musculação", "aeróbico", "funcional"]
  }
}
```

**Response:**
```json
{
  "flowId": "flow-789",
  "status": "imported",
  "customizationsApplied": 8,
  "readyToPublish": true
}
```

---

## 🔧 Configuration API (Novo)

### GET /api/config
Configurações do sistema.

**Response:**
```json
{
  "version": "2.0.0",
  "environment": "production",
  "features": {
    "monitoring": true,
    "abTesting": true,
    "flowVersioning": true
  },
  "limits": {
    "maxFlowNodes": 100,
    "maxActiveFlows": 50,
    "llmTimeout": 1200000
  }
}
```

### PUT /api/config/features
Ativar/desativar funcionalidades.

**Request:**
```json
{
  "monitoring": true,
  "abTesting": true,
  "flowVersioning": true,
  "advancedAnalytics": false
}
```

**Response:**
```json
{
  "success": true,
  "featuresUpdated": 4,
  "restartRequired": false
}
```

---

## 🚨 Alerts API (Novo)

### GET /api/alerts
Lista alertas ativos.

**Response:**
```json
{
  "alerts": [
    {
      "id": "alert-123",
      "severity": "warning",
      "title": "High LLM Latency",
      "description": "LLM response time > 5s",
      "startsAt": "2025-01-26T10:30:00Z",
      "labels": {
        "service": "llm",
        "instance": "ollama-1"
      }
    }
  ],
  "summary": {
    "critical": 0,
    "warning": 1,
    "info": 3
  }
}
```

### POST /api/alerts/webhook
Webhook para receber alertas do Alertmanager.

**Request:**
```json
{
  "alerts": [
    {
      "labels": {
        "alertname": "HighErrorRate",
        "severity": "critical"
      },
      "annotations": {
        "summary": "Error rate is above 5%"
      }
    }
  ]
}
```

---

## 📝 WebHooks API (Melhorado)

### POST /api/webhooks/flow-event
Webhook para eventos de fluxo.

**Request:**
```json
{
  "event": "flow_completed",
  "flowId": "academia-flow",
  "userId": "5511999999999",
  "data": {
    "completionTime": 245,
    "abTestVariant": "casual",
    "userSatisfaction": "high"
  }
}
```

### POST /api/webhooks/user-event  
Webhook para eventos de usuário.

**Request:**
```json
{
  "event": "user_message",
  "userId": "5511999999999",
  "messageType": "text",
  "isCommand": true,
  "timestamp": "2025-01-26T10:30:00Z"
}
```

---

## 🔐 Authentication (Melhorado)

### Headers Obrigatórios
```bash
# API Key
X-API-Key: your-api-key

# Para webhooks internos
Authorization: Bearer webhook-secret
```

### Rate Limiting
- **Padrão**: 100 requests/minuto por IP
- **Métricas**: 10 requests/minuto
- **Webhooks**: 1000 requests/minuto

### Error Codes
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests",
    "retryAfter": 60
  }
}
```

---

## 📚 SDKs e Bibliotecas

### JavaScript/Node.js
```bash
npm install secrebot-sdk
```

```javascript
const SecreBot = require('secrebot-sdk');

const client = new SecreBot({
  baseUrl: 'http://localhost:3000',
  apiKey: 'your-api-key'
});

// Executar fluxo
const execution = await client.flows.execute('academia-flow', {
  userId: '5511999999999'
});

// Configurar A/B test
await client.abTesting.configure('flow-123', {
  nodeId: 'llm-1',
  variants: [...]
});

// Métricas
const metrics = await client.metrics.summary();
```

### Python
```bash
pip install secrebot-python
```

```python
from secrebot import SecreBot

client = SecreBot(
    base_url='http://localhost:3000',
    api_key='your-api-key'
)

# Analytics
analytics = client.analytics.flows(period='7d')

# Validação
validation = client.flows.validate('flow-123')
```

*API Reference completa para SecreBot v2.0 - Maximize o potencial da sua automação WhatsApp! 🚀*