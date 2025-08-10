#!/usr/bin/env python3
"""
Script para remover métodos finais que foram movidos para handlers especializados
"""
import re

# Métodos que foram movidos para handlers especializados
methods_to_remove = [
    # EndpointHandler
    'handleChooseWhisperEndpointCommand',
    'getAvailableEndpoints',
    'getAvailableWhisperEndpoints',
    'processChooseSpecificWhisperEndpointMessage', 
    'processChangeSpecificWhisperEndpointMessage',
    'processTranscribeWithSpecificEndpointMessage',
    'transcribeWithSpecificEndpoint',
    'handleReiniciarWhisperCommand',
    'handleListarEndpointsWhisperCommand',
    'handleListarEndpointsOllamaCommand',
    
    # FlowManagementHandler
    'handleFlowCommand',
    'handleFlowStart',
    'handleFlowStop', 
    'handleFlowSair',
    'handleFlowRestart',
    'handleFlowVoltar',
    'handleFlowStatus',
    'handleFlowList',
    'sendFlowHelp',
    
    # UtilityHandler
    'isValidLinkedInUrl',
    'shouldRetryVideoProcessing',
    'getVideoProcessingCircuitBreaker',
    'recordVideoProcessingFailure',
    'validateScheduleData'
]

# Ler o arquivo original
with open('src/core/whatsAppBot.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Remover métodos especificados
lines = content.split('\n')
new_lines = []
in_method_to_remove = False
brace_count = 0
removed_methods = []
current_method = None

for i, line in enumerate(lines):
    # Detectar início de método a ser removido
    method_match = re.match(r'\s*async (\w+)\s*\(', line)
    if not method_match:
        method_match = re.match(r'\s*(\w+)\s*\(', line)
    
    if method_match:
        method_name = method_match.group(1)
        if method_name in methods_to_remove:
            in_method_to_remove = True
            current_method = method_name
            removed_methods.append(method_name)
            brace_count = line.count('{') - line.count('}')
            continue
    
    # Se estamos em um método a ser removido, pular linhas
    if in_method_to_remove:
        brace_count += line.count('{') - line.count('}')
        # Se brace_count chegou a 0, método terminou
        if brace_count == 0:
            in_method_to_remove = False
            current_method = None
        continue
    
    # Manter linha se não é de método a ser removido
    new_lines.append(line)

# Salvar arquivo modificado
new_content = '\n'.join(new_lines)
with open('src/core/whatsAppBot.js', 'w', encoding='utf-8') as f:
    f.write(new_content)

print(f"Removidos {len(removed_methods)} métodos movidos para handlers finais:")
for method in removed_methods:
    print(f"- {method}")

# Calcular redução de linhas
original_lines = len(lines)
new_lines_count = len(new_lines)
reduction = original_lines - new_lines_count

print(f"\nLinhas originais: {original_lines}")
print(f"Linhas após remoção: {new_lines_count}")
print(f"Linhas removidas: {reduction}")