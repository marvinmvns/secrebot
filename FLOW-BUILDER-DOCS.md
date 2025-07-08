# Flow Builder - Documentação

## Visão Geral

O Flow Builder é uma interface visual no-code/low-code para criação de fluxos de conversação automatizados para WhatsApp. Permite criar, editar e testar fluxos de interação através de uma interface drag-and-drop intuitiva.

## Arquitetura

### Componentes Principais

#### 1. Interface Frontend (`/src/views/flow-builder.ejs`)
- **Localização**: `src/views/flow-builder.ejs`
- **Função**: Interface visual para construção de fluxos
- **Recursos**:
  - Paleta de nós arrastaveis
  - Canvas de edição com grid
  - Painel de propriedades
  - Mini-mapa para navegação
  - Toolbar com ações (salvar, carregar, testar, limpar)

#### 2. JavaScript Frontend (`/src/public/js/flow-builder.js`)
- **Localização**: `src/public/js/flow-builder.js`
- **Função**: Lógica de interação da interface
- **Recursos**:
  - Classe `FlowBuilder` para gerenciamento de estado
  - Sistema drag-and-drop
  - Criação e edição de conexões
  - Serialização de fluxos
  - Validação de estrutura

#### 3. Serviço de Execução (`/src/services/flowExecutionService.js`)
- **Localização**: `src/services/flowExecutionService.js`
- **Função**: Engine de execução de fluxos
- **Recursos**:
  - Processamento de nós em tempo real
  - Gerenciamento de estado de usuários
  - Integração com WhatsApp Web.js
  - Sistema de variáveis
  - Tratamento de condições e loops

#### 4. API REST (`/src/api/restApi.js`)
- **Função**: Endpoints para persistência e teste
- **Rotas adicionadas**:
  - `GET /flow-builder` - Interface do construtor
  - `POST /api/flow/save` - Salvar fluxo
  - `GET /api/flow/list` - Listar fluxos
  - `GET /api/flow/:id` - Carregar fluxo específico
  - `POST /api/flow/test` - Testar fluxo
  - `DELETE /api/flow/:id` - Excluir fluxo

## Tipos de Nós Disponíveis

### 1. Nó de Início (`start`)
- **Propósito**: Ponto de entrada do fluxo
- **Configurações**:
  - `trigger`: Tipo de gatilho (keyword, any, button)
  - `value`: Palavra-chave ou texto do botão
- **Exemplo**: Gatilho por palavra-chave "oi" ou "olá"

### 2. Nó de Mensagem (`message`)
- **Propósito**: Enviar mensagem de texto
- **Configurações**:
  - `text`: Conteúdo da mensagem
  - `delay`: Tempo de espera antes do envio (segundos)
- **Recursos**: Suporte a variáveis com sintaxe `{{variavel}}`

### 3. Nó de Condição (`condition`)
- **Propósito**: Bifurcação baseada em condições
- **Configurações**:
  - `condition`: Tipo (contains, equals, starts, ends, regex)
  - `value`: Valor para comparação
- **Fluxo**: Duas saídas (verdadeiro/falso)

### 4. Nó de Entrada (`input`)
- **Propósito**: Aguardar entrada do usuário
- **Configurações**:
  - `timeout`: Tempo limite em segundos
  - `variable`: Nome da variável para armazenar entrada
- **Comportamento**: Pausa execução até receber entrada

### 5. Nó de Delay (`delay`)
- **Propósito**: Pausar execução por tempo determinado
- **Configurações**:
  - `seconds`: Tempo de espera
- **Uso**: Simular tempo de digitação ou processamento

### 6. Nó de IA/LLM (`llm`)
- **Propósito**: Resposta inteligente via IA
- **Configurações**:
  - `model`: Modelo a ser usado
  - `prompt`: Prompt para a IA
  - `context`: Se deve usar contexto da conversa
- **Integração**: Usa o `llmService` existente

### 7. Nó de Webhook (`webhook`)
- **Propósito**: Chamar API externa
- **Configurações**:
  - `url`: URL da API
  - `method`: Método HTTP
  - `headers`: Cabeçalhos personalizados
  - `body`: Corpo da requisição
- **Resultado**: Resposta salva em variável `webhookResponse`

### 8. Nó de Fim (`end`)
- **Propósito**: Finalizar fluxo
- **Configurações**:
  - `message`: Mensagem final opcional
- **Comportamento**: Limpa estado do usuário

## Sistema de Variáveis

### Variáveis Padrão
- `userInput`: Última entrada do usuário
- `userId`: ID do usuário no WhatsApp
- `webhookResponse`: Resposta da última chamada de webhook

### Sintaxe
- Uso em mensagens: `{{variavel}}`
- Exemplo: `"Olá {{userName}}, seu pedido {{orderId}} foi processado!"`

### Escopo
- Variáveis são mantidas durante toda a execução do fluxo
- Limpas automaticamente ao finalizar

## Integração com WhatsApp Bot

### Arquivo de Integração
O serviço deve ser integrado ao bot principal em `src/core/whatsAppBot.js`:

```javascript
import FlowExecutionService from '../services/flowExecutionService.js';

// No construtor do WhatsAppBot
this.flowService = new FlowExecutionService(this, this.llmService);

// No tratamento de mensagens
if (this.flowService.hasActiveFlow(fromNumber)) {
    const handled = await this.flowService.processUserInput(fromNumber, body);
    if (handled) return; // Fluxo tratou a mensagem
}
```

### Carregamento de Fluxos
```javascript
// Carregar fluxo salvo
const savedFlows = await configService.getConfig('flows');
Object.values(savedFlows).forEach(flow => {
    this.flowService.loadFlow(flow);
});
```

### Iniciação de Fluxos
```javascript
// Verificar se mensagem deve iniciar fluxo
const triggerMessage = body.toLowerCase();
for (const [flowId, flow] of this.flowService.loadedFlows) {
    const startNodes = flow.startNodes.map(id => flow.nodes.get(id));
    const matchingNode = startNodes.find(node => 
        node.data.trigger === 'keyword' && 
        triggerMessage.includes(node.data.value.toLowerCase())
    );
    
    if (matchingNode) {
        await this.flowService.startFlowExecution(fromNumber, flowId, triggerMessage);
        return;
    }
}
```

## Persistência de Dados

### Estrutura no Banco
Os fluxos são salvos no MongoDB através do `configService`:

```javascript
{
  flows: {
    "flow_123456": {
      id: "flow_123456",
      name: "Atendimento Inicial",
      description: "Fluxo de boas-vindas e direcionamento",
      nodes: [...],
      connections: [...],
      metadata: {
        version: "1.0",
        createdAt: "2024-01-01T00:00:00.000Z",
        lastModified: "2024-01-01T00:00:00.000Z"
      }
    }
  }
}
```

### Backup e Restauração
```javascript
// Exportar todos os fluxos
GET /api/flow/export

// Importar fluxos
POST /api/flow/import
```

## Exemplo de Fluxo Completo

### Cenário: Atendimento de Vendas

1. **Início**: Gatilho por palavra-chave "vendas"
2. **Mensagem**: "Olá! Bem-vindo ao nosso atendimento de vendas. 👋"
3. **Mensagem**: "Para melhor atendê-lo, preciso de algumas informações."
4. **Entrada**: "Qual seu nome?" (salva em `customerName`)
5. **Mensagem**: "Obrigado, {{customerName}}! Que produto tem interesse?"
6. **Entrada**: "Produto de interesse" (salva em `productInterest`)
7. **Condição**: Se `productInterest` contém "premium"
   - **Verdadeiro**: Webhook para API de vendas premium
   - **Falso**: Webhook para API de vendas padrão
8. **Mensagem**: "Perfeito! Um consultor entrará em contato em breve."
9. **Fim**: "Obrigado pelo interesse! 🚀"

### JSON do Fluxo
```json
{
  "name": "Atendimento de Vendas",
  "description": "Fluxo automatizado para captura de leads",
  "nodes": [
    {
      "id": "start_1",
      "type": "start",
      "x": 100,
      "y": 100,
      "data": {
        "trigger": "keyword",
        "value": "vendas"
      }
    },
    {
      "id": "msg_1",
      "type": "message",
      "x": 300,
      "y": 100,
      "data": {
        "text": "Olá! Bem-vindo ao nosso atendimento de vendas. 👋",
        "delay": 1
      }
    }
    // ... outros nós
  ],
  "connections": [
    {
      "id": "conn_1",
      "from": "start_1",
      "to": "msg_1"
    }
    // ... outras conexões
  ]
}
```

## Troubleshooting

### Problemas Comuns

#### 1. Fluxo não inicia
- Verificar se há nó de início configurado
- Confirmar se gatilho está correto
- Validar se fluxo foi carregado corretamente

#### 2. Variáveis não funcionam
- Verificar sintaxe `{{variavel}}`
- Confirmar se variável foi definida antes do uso
- Validar escopo da variável

#### 3. Webhook falha
- Verificar URL e conectividade
- Validar headers e autenticação
- Confirmar formato do body

#### 4. Execução trava
- Verificar timeouts configurados
- Validar se há loops infinitos
- Confirmar conexões entre nós

### Logs Importantes
```bash
# Execução de fluxos
grep "🚀 Iniciando execução" logs/
grep "🔄 Executando nó" logs/
grep "✅ Execução do fluxo finalizada" logs/

# Erros
grep "❌ Erro" logs/ | grep flow
```

## Melhorias Futuras

### Curto Prazo
- [ ] Editor de variáveis globais
- [ ] Templates de fluxo pré-configurados
- [ ] Validação de fluxo em tempo real
- [ ] Histórico de execuções

### Médio Prazo
- [ ] Nós de mídia (imagem, áudio, vídeo)
- [ ] Integração com banco de dados
- [ ] Sistema de tags e categorias
- [ ] Analytics de performance

### Longo Prazo
- [ ] IA para sugestão de fluxos
- [ ] A/B testing de fluxos
- [ ] Multi-canal (Telegram, Discord)
- [ ] Marketplace de fluxos

## Considerações de Segurança

### Validação de Entrada
- Sanitização de dados de entrada
- Validação de URLs de webhook
- Limite de execução por usuário

### Controle de Acesso
- Autenticação para acesso ao Flow Builder
- Permissões por usuário/grupo
- Auditoria de mudanças

### Monitoramento
- Logs detalhados de execução
- Alertas para falhas frequentes
- Métricas de performance

---

**Nota**: Esta documentação deve ser mantida atualizada conforme evoluções do sistema. Para dúvidas técnicas, consulte o código-fonte ou entre em contato com a equipe de desenvolvimento.