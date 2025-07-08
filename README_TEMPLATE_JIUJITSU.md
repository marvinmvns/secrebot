# Template Academia Jiu-Jitsu - Guia de Instalação

## 📋 Visão Geral

Este template fornece um fluxo completo e interativo para atendimento automatizado de academias de jiu-jitsu através do WhatsApp. O fluxo inclui:

- ✅ **Apresentação da academia** com múltiplas opções
- 🥋 **Informações sobre modalidades** (Gi, No-Gi, Kids, Competição)
- 💰 **Planos e preços** detalhados
- 🎯 **Agendamento de aula experimental** gratuita
- 📍 **Localização e horários** da academia
- 💪 **Benefícios do jiu-jitsu** explicados
- 👨‍🏫 **Contato direto com instrutor**
- ⭐ **Depoimentos de alunos**
- 🤖 **Respostas inteligentes** via IA para dúvidas específicas

## 🚀 Como Instalar

### 1. Importar o Template

```bash
# Opção 1: Via interface web
# Acesse: http://localhost:3000/flow-builder
# Clique em "Importar Fluxo"
# Selecione o arquivo: template_academia_jiu_jitsu.json

# Opção 2: Via API REST
curl -X POST http://localhost:3000/api/flow/import \
  -H "Content-Type: application/json" \
  -d @template_academia_jiu_jitsu.json
```

### 2. Personalizar Informações

Edite os seguintes campos no template para sua academia:

#### 📍 **Localização**
- Endereço completo
- CEP
- Referências próximas
- Instruções de como chegar

#### 💰 **Preços e Planos**
- Valores dos planos
- Modalidades oferecidas
- Formas de pagamento
- Promoções especiais

#### ⏰ **Horários**
- Horários de funcionamento
- Horários das aulas
- Dias da semana disponíveis

#### 📱 **Contatos**
- Telefone/WhatsApp
- Instagram
- Email
- Website

#### 👨‍🏫 **Instrutor**
- Nome do professor
- Graduação
- Experiência
- Conquistas

### 3. Configurar Integrações

#### 🔗 **Webhook para Agendamento**
```json
{
  "url": "https://sua-api.com/agendamento",
  "method": "POST",
  "headers": {
    "Authorization": "Bearer SEU_TOKEN_AQUI"
  }
}
```

#### 🤖 **Configuração da IA**
- Configure seu token de API do OpenAI
- Ajuste o modelo utilizado (GPT-3.5 ou GPT-4)
- Personalize o prompt para o contexto da sua academia

### 4. Testar o Fluxo

1. **Teste Local**: Use o botão "Testar Fluxo" na interface do Flow Builder
2. **Teste Real**: Configure uma palavra-chave de teste no WhatsApp
3. **Validação**: Execute todos os caminhos do fluxo

## 🎯 Palavras-chave de Ativação

O fluxo é ativado quando o usuário envia:
- "academia"
- "jiu-jitsu" 
- "jiu jitsu"
- "jiujitsu"
- "arte marcial"
- "luta"

## 📊 Métricas e Conversões

### Principais KPIs a Acompanhar:
- 📈 **Taxa de conversão** para aula experimental
- 💬 **Engajamento** nas conversas
- ⏱️ **Tempo médio** de interação
- 🔄 **Taxa de retorno** ao menu principal
- 📞 **Solicitações de contato** direto

### Otimizações Recomendadas:
- 📝 **A/B test** diferentes mensagens
- 🎯 **Ajustar** gatilhos baseado no comportamento
- 📊 **Monitorar** pontos de abandono
- 🔄 **Melhorar** fluxos com baixa conversão

## 🛠️ Personalização Avançada

### Adicionar Novos Nós:
1. **Nó de Promoção**: Para ofertas especiais
2. **Nó de Eventos**: Para workshops e seminários
3. **Nó de Graduação**: Para informações sobre faixas
4. **Nó de Competição**: Para alunos competidores

### Variáveis Personalizadas:
- `{{nomeAcademia}}`: Nome da sua academia
- `{{professores}}`: Lista de professores
- `{{proximoEvento}}`: Próximo evento/seminário
- `{{horarioEspecial}}`: Horários especiais/feriados

## 🔧 Troubleshooting

### Problemas Comuns:

#### ❌ **Fluxo não inicia**
- Verifique se a palavra-chave está configurada
- Confirme se o fluxo está carregado no sistema
- Teste a integração com o WhatsApp

#### ❌ **Webhook não funciona**
- Verifique a URL do webhook
- Confirme se o token de autorização está correto
- Teste a API externamente

#### ❌ **IA não responde**
- Verifique se o token da OpenAI está configurado
- Confirme se há créditos disponíveis na conta
- Teste a API separadamente

#### ❌ **Variáveis não são substituídas**
- Verifique a sintaxe: `{{variavel}}`
- Confirme se a variável foi definida antes do uso
- Teste com variáveis simples primeiro

## 📈 Melhorias Futuras

### Funcionalidades Planejadas:
- 🎥 **Envio de vídeos** explicativos
- 🖼️ **Galeria de fotos** da academia
- 📅 **Calendário** com horários disponíveis
- 💳 **Pagamento online** integrado
- 🏆 **Sistema de gamificação** para engajamento

### Integrações Possíveis:
- 📊 **Google Analytics** para métricas
- 📧 **Email marketing** para nurturing
- 💬 **CRM** para gestão de leads
- 📱 **App mobile** da academia

## 🎨 Customização Visual

### Emojis Utilizados:
- 🥋 Jiu-jitsu
- 💪 Força/Benefícios
- 🎯 Objetivos/Metas
- 📍 Localização
- 💰 Preços
- ⏰ Horários
- 🏆 Conquistas
- 👨‍🏫 Professor
- 🔥 Energia/Motivação

### Personalização de Mensagens:
- Mantenha o tom **amigável** e **motivador**
- Use **linguagem simples** e direta
- Inclua **calls-to-action** claros
- Adicione **social proof** (depoimentos)

## 📞 Suporte

Para dúvidas sobre o template:
1. Consulte a documentação do Flow Builder
2. Verifique os logs do sistema
3. Teste em ambiente de desenvolvimento primeiro
4. Entre em contato com o suporte técnico

## 🚀 Próximos Passos

1. ✅ **Importar** o template
2. ✅ **Personalizar** as informações
3. ✅ **Configurar** integrações
4. ✅ **Testar** completamente
5. ✅ **Lançar** em produção
6. ✅ **Monitorar** métricas
7. ✅ **Otimizar** baseado nos resultados

---

**🥋 Pronto para transformar o atendimento da sua academia? Boa sorte! OSS! 🙏**