# Makefile para SecreBot - Facilita instalação e manutenção

.PHONY: help install-piper install-piper-python clean-piper test-piper setup-env start

# Cores para output
GREEN := \033[0;32m
YELLOW := \033[1;33m
BLUE := \033[0;34m
NC := \033[0m

# Diretórios
PROJECT_DIR := $(shell pwd)
PIPER_DIR := $(PROJECT_DIR)/piper
SCRIPTS_DIR := $(PROJECT_DIR)/scripts

help: ## Mostra esta ajuda
	@echo "$(BLUE)🤖 SecreBot - Comandos Disponíveis$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "$(YELLOW)%-20s$(NC) %s\n", $$1, $$2}'

install-piper: ## Instala Piper TTS com modelo pt-BR (Bash)
	@echo "$(BLUE)🎤 Instalando Piper TTS com modelo pt-BR...$(NC)"
	@if [ -f "$(SCRIPTS_DIR)/install-piper.sh" ]; then \
		chmod +x "$(SCRIPTS_DIR)/install-piper.sh"; \
		"$(SCRIPTS_DIR)/install-piper.sh"; \
	else \
		echo "$(RED)❌ Script install-piper.sh não encontrado$(NC)"; \
		exit 1; \
	fi

install-piper-python: ## Instala Piper TTS com modelo pt-BR (Python)
	@echo "$(BLUE)🎤 Instalando Piper TTS com modelo pt-BR (Python)...$(NC)"
	@if [ -f "$(SCRIPTS_DIR)/install-piper.py" ]; then \
		chmod +x "$(SCRIPTS_DIR)/install-piper.py"; \
		python3 "$(SCRIPTS_DIR)/install-piper.py"; \
	else \
		echo "$(RED)❌ Script install-piper.py não encontrado$(NC)"; \
		exit 1; \
	fi

clean-piper: ## Remove instalação do Piper
	@echo "$(YELLOW)🗑️ Removendo instalação do Piper...$(NC)"
	@if [ -d "$(PIPER_DIR)" ]; then \
		rm -rf "$(PIPER_DIR)"; \
		echo "$(GREEN)✅ Piper removido$(NC)"; \
	else \
		echo "$(YELLOW)⚠️ Piper não estava instalado$(NC)"; \
	fi

test-piper: ## Testa instalação do Piper
	@echo "$(BLUE)🧪 Testando Piper TTS...$(NC)"
	@if [ -x "$(PIPER_DIR)/bin/piper" ] && [ -f "$(PIPER_DIR)/models/pt_BR-faber-medium.onnx" ]; then \
		echo "Testando o Piper brasileiro" | "$(PIPER_DIR)/bin/piper" \
			--model "$(PIPER_DIR)/models/pt_BR-faber-medium.onnx" \
			--output_file "$(PIPER_DIR)/teste.wav"; \
		if [ -f "$(PIPER_DIR)/teste.wav" ]; then \
			rm "$(PIPER_DIR)/teste.wav"; \
			echo "$(GREEN)✅ Piper funcionando corretamente$(NC)"; \
		else \
			echo "$(RED)❌ Piper não gerou arquivo de áudio$(NC)"; \
		fi; \
	else \
		echo "$(RED)❌ Piper não instalado ou modelo não encontrado$(NC)"; \
		echo "Execute: make install-piper"; \
	fi

setup-env: ## Configura variáveis de ambiente do Piper
	@echo "$(BLUE)⚙️ Configurando variáveis de ambiente...$(NC)"
	@if [ -f ".env.piper.example" ]; then \
		if [ -f ".env" ]; then \
			echo "$(YELLOW)⚠️ Arquivo .env já existe$(NC)"; \
			echo "$(BLUE)Adicione estas linhas ao seu .env:$(NC)"; \
			echo ""; \
			cat .env.piper.example | grep -E "^PIPER_"; \
		else \
			cp .env.piper.example .env; \
			echo "$(GREEN)✅ Arquivo .env criado com configuração do Piper$(NC)"; \
		fi; \
	else \
		echo "$(RED)❌ Arquivo .env.piper.example não encontrado$(NC)"; \
		echo "Execute: make install-piper"; \
	fi

start: ## Inicia o SecreBot
	@echo "$(BLUE)🚀 Iniciando SecreBot...$(NC)"
	@if [ -f "package.json" ]; then \
		npm start; \
	else \
		echo "$(RED)❌ package.json não encontrado$(NC)"; \
	fi

install-deps: ## Instala dependências Node.js
	@echo "$(BLUE)📦 Instalando dependências...$(NC)"
	@if [ -f "package.json" ]; then \
		npm install; \
		echo "$(GREEN)✅ Dependências instaladas$(NC)"; \
	else \
		echo "$(RED)❌ package.json não encontrado$(NC)"; \
	fi

status: ## Mostra status das instalações
	@echo "$(BLUE)📊 Status do SecreBot$(NC)"
	@echo ""
	@echo "$(YELLOW)Node.js:$(NC)"
	@if command -v node >/dev/null 2>&1; then \
		echo "  ✅ Node.js $(shell node --version)"; \
	else \
		echo "  ❌ Node.js não instalado"; \
	fi
	@if command -v npm >/dev/null 2>&1; then \
		echo "  ✅ npm $(shell npm --version)"; \
	else \
		echo "  ❌ npm não instalado"; \
	fi
	@echo ""
	@echo "$(YELLOW)Piper TTS:$(NC)"
	@if [ -x "$(PIPER_DIR)/bin/piper" ]; then \
		echo "  ✅ Executável instalado"; \
	else \
		echo "  ❌ Executável não encontrado"; \
	fi
	@if [ -f "$(PIPER_DIR)/models/pt_BR-faber-medium.onnx" ]; then \
		echo "  ✅ Modelo pt-BR instalado"; \
	else \
		echo "  ❌ Modelo pt-BR não encontrado"; \
	fi
	@echo ""
	@echo "$(YELLOW)Configuração:$(NC)"
	@if [ -f ".env" ]; then \
		echo "  ✅ Arquivo .env existe"; \
		if grep -q "PIPER_ENABLED" .env; then \
			echo "  ✅ Configuração Piper presente"; \
		else \
			echo "  ⚠️ Configuração Piper ausente"; \
		fi; \
	else \
		echo "  ❌ Arquivo .env não encontrado"; \
	fi

all: install-deps install-piper setup-env ## Instalação completa
	@echo "$(GREEN)🎉 Instalação completa do SecreBot finalizada!$(NC)"
	@echo ""
	@echo "$(BLUE)Próximos passos:$(NC)"
	@echo "1. Configure suas variáveis de ambiente no .env"
	@echo "2. Execute: make start"
	@echo "3. Use !voz no WhatsApp para ativar TTS"

# Comando padrão
.DEFAULT_GOAL := help