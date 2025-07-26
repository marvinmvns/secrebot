# 🚀 Changelog: Melhorias Piper TTS

## ✅ Implementado

### 🔧 .gitignore Atualizado
- **Cache e dados temporários** ignorados automaticamente
- **Piper TTS** (`piper/`, `*.onnx`, `*.onnx.json`) não commitado
- **Arquivos de áudio** (`*.wav`, `*.mp3`, `*.ogg`) ignorados
- **Cache WhatsApp** (`.wwebjs_auth/`, `.wwebjs_cache/`) ignorado
- **Arquivos IDE** e temporários ignorados

### 📋 Configuração Externalizada
- **`piper-models.json`**: Arquivo de configuração central
- **URLs não hardcoded**: Todas as URLs vêm da configuração
- **Modelos configuráveis**: Fácil adição de novos modelos/idiomas
- **Arquiteturas suportadas**: Linux (x86_64, aarch64, armv7l), macOS (x64, arm64)

### 🤖 Scripts Melhorados

#### **install-piper.sh**
- ✅ Lê configuração de `piper-models.json`
- ✅ Suporte a `jq` ou `python3` para parsing JSON
- ✅ Download automático baseado na configuração
- ✅ Modelo padrão configurável
- ✅ Arquiteturas dinâmicas

#### **install-piper.py**
- ✅ Versão Python equivalente ao Bash
- ✅ Same features com melhor tratamento de erro
- ✅ Progress bar visual
- ✅ Configuração JSON nativa

#### **Makefile**
- ✅ Comandos simplificados (`make install-piper`)
- ✅ Status completo (`make status`)
- ✅ Limpeza (`make clean-piper`)
- ✅ Suporte a ambos os instaladores

### 🎯 Benefícios Obtidos

1. **Manutenibilidade**: URLs e configurações centralizadas
2. **Flexibilidade**: Fácil adição de novos modelos/idiomas
3. **Segurança**: Dados sensíveis não commitados
4. **Performance**: Cache ignorado automaticamente
5. **Compatibilidade**: Suporte a múltiplas arquiteturas
6. **Usabilidade**: Instalação em um comando

## 📁 Estrutura Final

```
secrebot/
├── .gitignore                    # ✅ Atualizado
├── piper-models.json            # ✅ Novo - Configuração central
├── scripts/
│   ├── install-piper.sh         # ✅ Melhorado - JSON config
│   └── install-piper.py         # ✅ Melhorado - JSON config
├── Makefile                     # ✅ Comandos facilitados
├── .env.piper.example           # ✅ Gerado automaticamente
└── piper/                       # ✅ Ignorado no git
    ├── bin/piper                # ✅ Download automático
    ├── models/                  # ✅ Modelos dinâmicos
    └── piper-wrapper.sh         # ✅ Script helper
```

## 🔄 Fluxo de Instalação

### Automatizado
```bash
make install-piper    # Instala tudo
make setup-env       # Configura .env
make test-piper      # Testa instalação
```

### Manual
```bash
./scripts/install-piper.sh    # ou
python3 scripts/install-piper.py
```

## 🎛️ Configuração JSON

### Adicionar Novo Modelo
```json
{
  "models": {
    "pt_BR": [
      {
        "name": "novo-modelo",
        "displayName": "Novo Modelo (Feminina)",
        "language": "pt_BR",
        "gender": "female",
        "quality": "high",
        "urls": {
          "model": "https://...",
          "config": "https://..."
        },
        "filename": "pt_BR-novo-modelo"
      }
    ]
  }
}
```

### Adicionar Novo Idioma
```json
{
  "models": {
    "en_US": [
      {
        "name": "american-voice",
        "displayName": "American Voice",
        "language": "en_US",
        "urls": {
          "model": "https://...",
          "config": "https://..."
        },
        "filename": "en_US-american-voice"
      }
    ]
  }
}
```

## 🚀 Próximos Passos Possíveis

1. **Interface Web** para gerenciar modelos
2. **Download sob demanda** de modelos
3. **Cache inteligente** de modelos
4. **Compressão automática** de modelos não utilizados
5. **Update automático** do Piper

## 🧪 Testes Realizados

- ✅ Instalação limpa funcional
- ✅ Configuração JSON válida
- ✅ .gitignore funcionando
- ✅ Makefile operacional
- ✅ Scripts Bash e Python equivalentes
- ✅ Arquivos não commitados
- ✅ Modelo pt-BR baixado corretamente