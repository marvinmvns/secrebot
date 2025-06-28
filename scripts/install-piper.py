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

# Carregar configuração do arquivo JSON
def load_config():
    config_file = Path(__file__).parent.parent / "piper-models.json"
    if not config_file.exists():
        raise FileNotFoundError(f"Arquivo de configuração não encontrado: {config_file}")
    
    with open(config_file, 'r', encoding='utf-8') as f:
        return json.load(f)

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
        
        # Carregar configuração
        self.config = load_config()
        
        self.os_name = platform.system().lower()
        self.arch = platform.machine().lower()
        
        # Obter configuração do Piper
        piper_config = self.config['piper']
        base_url = piper_config['baseUrl']
        
        # Obter arquivo para a arquitetura atual
        try:
            archive_name = piper_config['architectures'][self.os_name][self.arch]
        except KeyError:
            self.print_error(f"Arquitetura não suportada: {self.os_name}/{self.arch}")
            sys.exit(1)
            
        self.piper_url = f"{base_url}/{archive_name}"
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
        self.print_step("Instalando modelos de voz...")
        
        # Obter modelo padrão da configuração
        default_config = self.config['default']
        lang = default_config['language']
        model_name = default_config['model']
        
        self.print_step(f"Baixando modelo: {lang}/{model_name}")
        
        # Encontrar configuração do modelo
        model_config = None
        for model in self.config['models'][lang]:
            if model['name'] == model_name:
                model_config = model
                break
        
        if not model_config:
            self.print_error(f"Modelo não encontrado na configuração: {lang}/{model_name}")
            return False
        
        filename = model_config['filename']
        model_file = self.models_dir / f"{filename}.onnx"
        config_file = self.models_dir / f"{filename}.onnx.json"
        
        success = True
        
        # Baixar modelo
        if not model_file.exists():
            if not self.download_file(model_config['urls']['model'], model_file, f"modelo {lang}/{model_name}"):
                success = False
        else:
            self.print_success(f"Modelo {lang}/{model_name} já existe")
        
        # Baixar configuração
        if not config_file.exists():
            if not self.download_file(model_config['urls']['config'], config_file, "configuração do modelo"):
                success = False
        else:
            self.print_success("Configuração do modelo já existe")
        
        if success:
            self.print_success("Modelos instalados")
        
        return success

    def test_installation(self):
        self.print_step("Testando instalação...")
        
        piper_executable = self.bin_dir / "piper"
        
        # Obter modelo padrão para teste
        default_config = self.config['default']
        lang = default_config['language']
        model_name = default_config['model']
        
        # Encontrar configuração do modelo
        model_config = None
        for model in self.config['models'][lang]:
            if model['name'] == model_name:
                model_config = model
                break
        
        if not model_config:
            self.print_error(f"Modelo não encontrado na configuração: {lang}/{model_name}")
            return False
        
        filename = model_config['filename']
        model_file = self.models_dir / f"{filename}.onnx"
        
        if not piper_executable.exists() or not os.access(piper_executable, os.X_OK):
            self.print_error("Executável Piper não encontrado ou não executável")
            return False
        
        if not model_file.exists():
            self.print_error(f"Modelo não encontrado: {model_file}")
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
        
        # Obter modelo padrão para configuração
        default_config = self.config['default']
        lang = default_config['language']
        model_name = default_config['model']
        
        # Encontrar configuração do modelo
        model_config = None
        for model in self.config['models'][lang]:
            if model['name'] == model_name:
                model_config = model
                break
        
        if not model_config:
            self.print_error(f"Modelo não encontrado na configuração: {lang}/{model_name}")
            return
        
        filename = model_config['filename']
        env_example = self.project_dir / ".env.piper.example"
        
        content = f"""# Configuração Piper TTS - Adicione ao seu arquivo .env

# Habilitar Piper TTS local
PIPER_ENABLED=true

# Caminho para o executável Piper (use o wrapper para melhor compatibilidade)
PIPER_EXECUTABLE={self.piper_dir}/piper-wrapper.sh

# Caminho para o modelo padrão ({lang}/{model_name})
PIPER_MODEL={self.models_dir}/{filename}.onnx

# Exemplo de configuração completa:
# cp .env.piper.example .env
# ou adicione essas linhas ao seu .env existente

# Nota: Modelos disponíveis estão definidos em piper-models.json
# Para usar outro modelo, baixe-o primeiro com o script de instalação
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