# 🎤 Guia de Instalação Piper TTS

Este guia detalha como instalar e configurar o Piper TTS com modelo em português brasileiro para o SecreBot.

## 🚀 Instalação Rápida

### Opção 1: Makefile (Recomendado)
```bash
# Instalar Piper + modelo pt-BR
make install-piper

# Configurar automaticamente
make setup-env

# Testar instalação
make test-piper
```

### Opção 2: Script Bash
```bash
# Executar instalador
./scripts/install-piper.sh

# Copiar configuração
cp .env.piper.example .env
```

### Opção 3: Script Python
```bash
# Para sistemas sem Bash
python3 scripts/install-piper.py
```

## ⚙️ Configuração Manual

Adicione ao arquivo `.env`:

```bash
# Habilitar Piper TTS
PIPER_ENABLED=true

# Caminho para executável (use o wrapper)
PIPER_EXECUTABLE=./piper/piper-wrapper.sh

# Modelo português brasileiro
PIPER_MODEL=./piper/models/pt_BR-faber-medium.onnx
```

## 🧪 Testando a Instalação

### Teste via Makefile
```bash
make test-piper
```

### Teste Manual
```bash
# Teste direto do Piper
echo "Olá mundo" | ./piper/piper-wrapper.sh \
  --model ./piper/models/pt_BR-faber-medium.onnx \
  --output_file teste.wav

# Verificar se arquivo foi criado
ls -la teste.wav
```

### Teste no WhatsApp
1. Inicie o SecreBot: `npm start`
2. Envie `!voz` para ativar TTS
3. Envie qualquer mensagem para ouvir a voz

## 📁 Estrutura de Arquivos

Após a instalação:

```
secrebot/
├── piper/
│   ├── bin/
│   │   ├── piper                    # Executável principal
│   │   ├── libpiper_phonemize.so*   # Bibliotecas necessárias
│   │   └── lib*.so                  # Outras bibliotecas
│   ├── models/
│   │   ├── pt_BR-faber-medium.onnx      # Modelo TTS
│   │   └── pt_BR-faber-medium.onnx.json # Configuração
│   └── piper-wrapper.sh             # Script wrapper
├── scripts/
│   ├── install-piper.sh             # Instalador Bash
│   └── install-piper.py             # Instalador Python
└── .env.piper.example               # Exemplo de configuração
```

## 🔧 Solução de Problemas

### Erro: "libpiper_phonemize.so.1: cannot open shared object file"

**Solução:** Use o wrapper script em vez do executável direto:
```bash
# ❌ Não funciona
PIPER_EXECUTABLE=./piper/bin/piper

# ✅ Funciona
PIPER_EXECUTABLE=./piper/piper-wrapper.sh
```

### Erro: "Error processing file '/usr/share/espeak-ng-data/phontab'"

**Solução 1:** Instalar espeak-ng-data (recomendado):
```bash
sudo apt-get install espeak-ng-data
```

**Solução 2:** O Piper geralmente funciona mesmo com este aviso. O wrapper script tenta contornar automaticamente.

### Áudio não é gerado

**Verificações:**
1. Modelo existe: `ls -la ./piper/models/pt_BR-faber-medium.onnx`
2. Executável tem permissão: `ls -la ./piper/bin/piper`
3. Wrapper script é executável: `ls -la ./piper/piper-wrapper.sh`

### Performance baixa

**Otimizações:**
- Use SSD em vez de HD
- Aumente RAM disponível
- Considere modelo menor se disponível

## 📋 Informações Técnicas

### Modelo Utilizado
- **Nome:** pt_BR-faber-medium
- **Voz:** Masculina brasileira
- **Qualidade:** Média (boa qualidade vs velocidade)
- **Tamanho:** ~60MB

### Dependências
- **libpiper_phonemize:** Fonética
- **libonnxruntime:** Runtime ML
- **libespeak-ng:** Processamento de texto

### Compatibilidade
- **Linux:** x86_64, ARM64, ARMv7
- **macOS:** x64, ARM64 (Apple Silicon)
- **Windows:** Não suportado pelos scripts (use Docker)

## 🐳 Alternativa Docker

Se a instalação local falhar:

```bash
# Criar wrapper Docker
cat > piper-docker.sh << 'EOF'
#!/bin/bash
docker run --rm -i \
  -v "$(pwd)/piper/models:/models" \
  ghcr.io/rhasspy/piper:latest \
  --model "/models/pt_BR-faber-medium.onnx" \
  --output_file "/tmp/output.wav" \
  "$@"
EOF

chmod +x piper-docker.sh

# Configurar no .env
PIPER_EXECUTABLE=./piper-docker.sh
```

## 🎯 Comandos Úteis

```bash
# Status completo da instalação
make status

# Limpeza completa
make clean-piper

# Reinstalação
make clean-piper && make install-piper

# Verificar versão do Piper
./piper/bin/piper --version

# Listar vozes disponíveis (se suportado)
./piper/bin/piper --list-voices
```

## 🔄 Atualizações

Para atualizar o Piper:

1. Limpe a instalação: `make clean-piper`
2. Atualize os scripts se necessário
3. Reinstale: `make install-piper`

## 📞 Suporte

Se encontrar problemas:

1. Verifique os logs no console
2. Execute `make status` para diagnóstico
3. Teste manualmente com o wrapper script
4. Considere a alternativa Docker

## 🎉 Resultado Final

Após configuração bem-sucedida:
- TTS funcionando em português brasileiro
- Comando `!voz` ativa/desativa por usuário
- Fallback automático se ElevenLabs não disponível
- Interface web para controle de voz