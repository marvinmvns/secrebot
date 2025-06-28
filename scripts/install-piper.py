#!/usr/bin/env python3
"""
Script para instalar Piper TTS com modelo em português brasileiro
Execução: python3 scripts/install-piper.py
"""

import os
import sys
import platform
import subprocess
import urllib.request
import urllib.error
import tarfile
import json
import shutil
from pathlib import Path

# Configurações
PIPER_VERSION = "2023.11.14-2"
PIPER_BASE_URL = f"https://github.com/rhasspy/piper/releases/download/{PIPER_VERSION}"

# Modelos pt-BR
MODELS = {
    "faber": "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/pt/pt_BR/faber/medium/pt_BR-faber-medium.onnx",
    "faber_config": "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/pt/pt_BR/faber/medium/pt_BR-faber-medium.onnx.json"
}

class Colors:
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    NC = '\033[0m'  # No Color

class PiperInstaller:
    def __init__(self):
        self.script_dir = Path(__file__).parent
        self.project_dir = self.script_dir.parent
        self.piper_dir = self.project_dir / "piper"
        self.models_dir = self.piper_dir / "models"
        self.bin_dir = self.piper_dir / "bin"
        
        self.os_name = platform.system().lower()
        self.arch = platform.machine().lower()
        
        # Mapear arquiteturas
        arch_map = {
            'x86_64': 'x64',
            'amd64': 'x64',
            'aarch64': 'arm64',
            'arm64': 'arm64',
            'armv7l': 'armv7'
        }
        
        self.piper_arch = arch_map.get(self.arch)
        if not self.piper_arch:
            self.print_error(f"Arquitetura não suportada: {self.arch}")
            sys.exit(1)
            
        # URL do Piper
        if self.os_name == 'linux':
            if self.piper_arch == 'x64':
                archive_name = "piper_linux_x86_64.tar.gz"
            elif self.piper_arch == 'arm64':
                archive_name = "piper_linux_aarch64.tar.gz"
            elif self.piper_arch == 'armv7':
                archive_name = "piper_linux_armv7l.tar.gz"
            else:
                self.print_error(f"Arquitetura Linux não suportada: {self.piper_arch}")
                sys.exit(1)
        elif self.os_name == 'darwin':
            if self.piper_arch == 'x64':
                archive_name = "piper_macos_x64.tar.gz"
            elif self.piper_arch == 'arm64':
                archive_name = "piper_macos_arm64.tar.gz"
            else:
                self.print_error(f"Arquitetura macOS não suportada: {self.piper_arch}")
                sys.exit(1)
        else:
            self.print_error(f"Sistema operacional não suportado: {self.os_name}")
            sys.exit(1)
            
        self.piper_url = f"{PIPER_BASE_URL}/{archive_name}"
        self.piper_archive = archive_name

    def print_header(self):
        print(f"{Colors.BLUE}")
        print("╔══════════════════════════════════════════════════════════════╗")
        print("║                    🎤 Instalador Piper TTS                   ║")
        print("║                     com modelo pt-BR                        ║")
        print("╚══════════════════════════════════════════════════════════════╝")
        print(f"{Colors.NC}")

    def print_step(self, message):
        print(f"{Colors.YELLOW}📋 {message}{Colors.NC}")

    def print_success(self, message):
        print(f"{Colors.GREEN}✅ {message}{Colors.NC}")

    def print_error(self, message):
        print(f"{Colors.RED}❌ {message}{Colors.NC}")

    def create_directories(self):
        self.print_step("Criando diretórios...")
        
        for directory in [self.piper_dir, self.models_dir, self.bin_dir]:
            directory.mkdir(parents=True, exist_ok=True)
        
        self.print_success("Diretórios criados")

    def download_file(self, url, output_path, description):
        self.print_step(f"Baixando {description}...")
        
        try:
            # Criar diretório pai se não existir
            output_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Download com progress
            def progress_hook(block_num, block_size, total_size):
                if total_size > 0:
                    percent = min(100, (block_num * block_size * 100) // total_size)
                    bar_length = 50
                    filled_length = (percent * bar_length) // 100
                    bar = '█' * filled_length + '-' * (bar_length - filled_length)
                    print(f"\r[{bar}] {percent}%", end='', flush=True)
            
            urllib.request.urlretrieve(url, output_path, progress_hook)
            print()  # Nova linha após progress bar
            self.print_success(f"{description} baixado com sucesso")
            return True
            
        except urllib.error.URLError as e:
            print()  # Nova linha após progress bar
            self.print_error(f"Falha ao baixar {description}: {e}")
            return False

    def install_piper(self):
        self.print_step("Instalando Piper TTS...")
        
        archive_path = self.piper_dir / self.piper_archive
        
        # Download do Piper
        if not archive_path.exists():
            if not self.download_file(self.piper_url, archive_path, "Piper TTS"):
                return False
        else:
            self.print_success("Piper TTS já baixado")
        
        # Extrair arquivo
        self.print_step("Extraindo Piper...")
        try:
            with tarfile.open(archive_path, 'r:gz') as tar:
                tar.extractall(self.piper_dir)
            
            # Encontrar executável
            piper_executable = None
            for root, dirs, files in os.walk(self.piper_dir):
                for file in files:
                    if file == 'piper' and os.access(os.path.join(root, file), os.X_OK):
                        piper_executable = os.path.join(root, file)
                        break
                if piper_executable:
                    break
            
            if piper_executable:
                # Copiar para bin_dir
                shutil.copy2(piper_executable, self.bin_dir / "piper")
                os.chmod(self.bin_dir / "piper", 0o755)
                
                # Limpar arquivos temporários
                archive_path.unlink()
                for item in self.piper_dir.iterdir():
                    if item.is_dir() and item.name.startswith('piper') and item != self.bin_dir:
                        shutil.rmtree(item)
                
                self.print_success("Piper TTS instalado")
                return True
            else:
                self.print_error("Executável Piper não encontrado após extração")
                return False
                
        except Exception as e:
            self.print_error(f"Erro ao extrair Piper: {e}")
            return False

    def install_models(self):
        self.print_step("Instalando modelos pt-BR...")
        
        model_file = self.models_dir / "pt_BR-faber-medium.onnx"
        config_file = self.models_dir / "pt_BR-faber-medium.onnx.json"
        
        success = True
        
        # Baixar modelo
        if not model_file.exists():
            if not self.download_file(MODELS["faber"], model_file, "modelo pt-BR Faber"):
                success = False
        else:
            self.print_success("Modelo pt-BR Faber já existe")
        
        # Baixar configuração
        if not config_file.exists():
            if not self.download_file(MODELS["faber_config"], config_file, "configuração do modelo"):
                success = False
        else:
            self.print_success("Configuração do modelo já existe")
        
        if success:
            self.print_success("Modelos pt-BR instalados")
        
        return success

    def test_installation(self):
        self.print_step("Testando instalação...")
        
        piper_executable = self.bin_dir / "piper"
        model_file = self.models_dir / "pt_BR-faber-medium.onnx"
        
        if not piper_executable.exists() or not os.access(piper_executable, os.X_OK):
            self.print_error("Executável Piper não encontrado ou não executável")
            return False
        
        if not model_file.exists():
            self.print_error("Modelo pt-BR não encontrado")
            return False
        
        # Teste básico
        test_file = self.piper_dir / "test.wav"
        try:
            process = subprocess.run([
                str(piper_executable),
                "--model", str(model_file),
                "--output_file", str(test_file)
            ], input="Testando o Piper com modelo brasileiro", 
               text=True, capture_output=True, timeout=30)
            
            if process.returncode == 0 and test_file.exists():
                test_file.unlink()  # Remover arquivo de teste
                self.print_success("Teste do Piper passou")
                return True
            else:
                self.print_error(f"Falha no teste do Piper: {process.stderr}")
                return False
                
        except subprocess.TimeoutExpired:
            self.print_error("Timeout no teste do Piper")
            return False
        except Exception as e:
            self.print_error(f"Erro no teste do Piper: {e}")
            return False

    def create_env_example(self):
        self.print_step("Criando exemplo de configuração...")
        
        env_example = self.project_dir / ".env.piper.example"
        
        content = f"""# Configuração Piper TTS - Adicione ao seu arquivo .env

# Habilitar Piper TTS local
PIPER_ENABLED=true

# Caminho para o executável Piper
PIPER_EXECUTABLE={self.bin_dir}/piper

# Caminho para o modelo pt-BR
PIPER_MODEL={self.models_dir}/pt_BR-faber-medium.onnx

# Exemplo de configuração completa:
# cp .env.piper.example .env
# ou adicione essas linhas ao seu .env existente
"""
        
        with open(env_example, 'w', encoding='utf-8') as f:
            f.write(content)
        
        self.print_success("Arquivo .env.piper.example criado")

    def show_final_instructions(self):
        print(f"{Colors.GREEN}")
        print("╔══════════════════════════════════════════════════════════════╗")
        print("║                    ✅ Instalação Concluída!                  ║")
        print("╚══════════════════════════════════════════════════════════════╝")
        print(f"{Colors.NC}")
        
        print(f"{Colors.BLUE}📁 Arquivos instalados:{Colors.NC}")
        print(f"   • Executável: {self.bin_dir}/piper")
        print(f"   • Modelo pt-BR: {self.models_dir}/pt_BR-faber-medium.onnx")
        print(f"   • Configuração: .env.piper.example")
        print()
        print(f"{Colors.BLUE}🔧 Para configurar:{Colors.NC}")
        print("   1. Copie as variáveis de .env.piper.example para seu .env")
        print("   2. Ou execute: cp .env.piper.example .env")
        print("   3. Reinicie a aplicação")
        print()
        print(f"{Colors.BLUE}🎤 Para testar:{Colors.NC}")
        print("   1. Envie !voz no WhatsApp para ativar")
        print("   2. Envie qualquer mensagem para ouvir a voz")
        print()
        print(f"{Colors.BLUE}💡 Comandos úteis:{Colors.NC}")
        print(f"   • Teste manual: echo 'Olá mundo' | {self.bin_dir}/piper --model {self.models_dir}/pt_BR-faber-medium.onnx --output_file teste.wav")
        print(f"   • Verificar versão: {self.bin_dir}/piper --version")

    def run(self):
        self.print_header()
        
        print(f"{Colors.BLUE}🔍 Sistema detectado: {self.os_name} ({self.arch}){Colors.NC}")
        print(f"{Colors.BLUE}📁 Diretório de instalação: {self.piper_dir}{Colors.NC}")
        print()
        
        try:
            self.create_directories()
            
            if not self.install_piper():
                sys.exit(1)
            
            if not self.install_models():
                sys.exit(1)
            
            if not self.test_installation():
                self.print_error("Teste falhou, mas instalação pode estar funcional")
            
            self.create_env_example()
            self.show_final_instructions()
            
            print(f"{Colors.GREEN}🎉 Piper TTS com modelo pt-BR instalado com sucesso!{Colors.NC}")
            
        except KeyboardInterrupt:
            print(f"\n{Colors.YELLOW}⚠️ Instalação cancelada pelo usuário{Colors.NC}")
            sys.exit(1)
        except Exception as e:
            self.print_error(f"Erro inesperado: {e}")
            sys.exit(1)

def main():
    installer = PiperInstaller()
    installer.run()

if __name__ == "__main__":
    main()