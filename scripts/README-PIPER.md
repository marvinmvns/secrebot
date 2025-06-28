# 🎤 Instalação do Piper TTS

Este diretório contém dois scripts para instalação do Piper TTS:

## 📦 Scripts Disponíveis

### 1. `install-piper-simple.sh` ⭐ **RECOMENDADO**

**Script simplificado usando binários pré-compilados**

```bash
chmod +x scripts/install-piper-simple.sh
./scripts/install-piper-simple.sh
```

**✅ Vantagens:**
- ✅ **Sem dependências externas** (não precisa de espeak-ng)
- ✅ **Instalação rápida** (apenas download de binários)
- ✅ **Múltiplas arquiteturas** (amd64, arm64, armv7)
- ✅ **Binários otimizados** do projeto oficial
- ✅ **Sem compilação** ou build
- ✅ **Funciona out-of-the-box**

**🏗️ Arquiteturas suportadas:**
- `x86_64` - amd64 (64-bit desktop Linux)
- `aarch64/arm64` - 64-bit Raspberry Pi 4
- `armv7l` - 32-bit Raspberry Pi 3/4

### 2. `install-piper.sh` 

**Script complexo com dependências**

```bash
chmod +x scripts/install-piper.sh
./scripts/install-piper.sh
```

**⚠️ Características:**
- ❌ Requer espeak-ng instalado no sistema
- ❌ Mais dependências e configurações
- ❌ Instalação mais lenta
- ❌ Pode ter problemas de compatibilidade
- ✅ Usa configuração JSON para modelos

## 🚀 Instalação Recomendada

**Use sempre o script simplificado:**

```bash
# 1. Executar instalação
./scripts/install-piper-simple.sh

# 2. Copiar configuração
cp .env.piper.example .env

# 3. Reiniciar aplicação
pm2 restart app

# 4. Testar no WhatsApp
# Envie: !voz
```

## 🔧 Configuração

Após a instalação, adicione ao seu `.env`:

```bash
# Habilitar Piper TTS local
PIPER_ENABLED=true

# Caminho para o wrapper (recomendado)
PIPER_EXECUTABLE=/caminho/para/secrebot/piper/piper-wrapper.sh

# Modelo português brasileiro
PIPER_MODEL=/caminho/para/secrebot/piper/models/pt_BR-faber-medium.onnx
```

## 🎯 Teste Manual

```bash
# Testar síntese de voz
echo "Olá, teste do Piper TTS" | ./piper/piper-wrapper.sh \
  --model ./piper/models/pt_BR-faber-medium.onnx \
  --output_file teste.wav

# Verificar versão
./piper/piper-wrapper.sh --version
```

## 📊 Comparação

| Característica | install-piper-simple.sh | install-piper.sh |
|----------------|-------------------------|-------------------|
| **Dependências** | Apenas curl/wget + tar | espeak-ng + outras |
| **Velocidade** | ⚡ Muito rápida | 🐌 Lenta |
| **Simplicidade** | ✅ Muito simples | ❌ Complexa |
| **Compatibilidade** | ✅ Alta | ⚠️ Média |
| **Manutenção** | ✅ Baixa | ❌ Alta |
| **Recomendação** | ⭐ **SIM** | ❌ Não |

## 🆘 Solução de Problemas

### Erro: "No such file or directory: espeak-ng-data"
**Solução:** Use o `install-piper-simple.sh` que não depende do espeak-ng

### Erro: "Architecture not supported"
**Solução:** Verifique se sua arquitetura está na lista suportada:
```bash
uname -m  # Deve retornar: x86_64, aarch64, ou armv7l
```

### Teste não funciona
**Solução:** Verifique permissões:
```bash
chmod +x ./piper/piper-wrapper.sh
chmod +x ./piper/bin/piper
```

## 🎉 Resultado Final

Após instalação bem-sucedida:

1. ✅ Piper TTS funcionando
2. ✅ Modelo pt-BR instalado
3. ✅ Wrapper script configurado
4. ✅ Pronto para usar no WhatsApp com `!voz`

---

**💡 Dica:** Sempre use `install-piper-simple.sh` para evitar problemas de dependência!