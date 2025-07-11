@echo off
REM =============================================================================
REM 🚀 SecreBot - Instalador Automático para Windows
REM =============================================================================
REM Assistente Inteligente para WhatsApp com IA Avançada
REM Este script instala automaticamente todas as dependências necessárias
REM Suporte: Windows 10/11, Windows Server 2019/2022
REM =============================================================================

setlocal enabledelayedexpansion
title SecreBot - Instalador Automático v2.0.0

REM =============================================================================
REM 🔧 CONFIGURAÇÕES GLOBAIS
REM =============================================================================
set "SCRIPT_VERSION=2.0.0"
set "LOG_FILE=%TEMP%\secrebot-install-%DATE:~-4,4%%DATE:~-10,2%%DATE:~-7,2%_%TIME:~0,2%%TIME:~3,2%%TIME:~6,2%.log"
set "INSTALL_DIR=%USERPROFILE%\secrebot"
set "MONGO_DB_NAME=sched"
set "MONGO_USER=bot"

REM Gerar senha aleatória
for /f %%i in ('powershell -Command "[System.Web.Security.Membership]::GeneratePassword(32, 0)"') do set "MONGO_PASSWORD=%%i"

REM Cores ANSI para output
set "RED=[91m"
set "GREEN=[92m"
set "YELLOW=[93m"
set "BLUE=[94m"
set "PURPLE=[95m"
set "CYAN=[96m"
set "NC=[0m"

REM =============================================================================
REM 🛠️ FUNÇÕES DE UTILIDADE
REM =============================================================================

:log_info
echo %GREEN%[INFO]%NC% %~1 >> "%LOG_FILE%"
echo %GREEN%[INFO]%NC% %~1
goto :eof

:log_warn
echo %YELLOW%[WARN]%NC% %~1 >> "%LOG_FILE%"
echo %YELLOW%[WARN]%NC% %~1
goto :eof

:log_error
echo %RED%[ERROR]%NC% %~1 >> "%LOG_FILE%"
echo %RED%[ERROR]%NC% %~1
goto :eof

:log_debug
echo %BLUE%[DEBUG]%NC% %~1 >> "%LOG_FILE%"
echo %BLUE%[DEBUG]%NC% %~1
goto :eof

:log_step
echo.
echo %PURPLE%[STEP]%NC% %~1 >> "%LOG_FILE%"
echo %PURPLE%[STEP]%NC% %~1
echo ==========================================
echo ========================================== >> "%LOG_FILE%"
goto :eof

:check_command
where %1 >nul 2>&1
if errorlevel 1 (
    exit /b 1
) else (
    exit /b 0
)

:check_service
sc query "%1" | find "RUNNING" >nul 2>&1
if errorlevel 1 (
    exit /b 1
) else (
    exit /b 0
)

:check_internet
ping -n 1 google.com >nul 2>&1
if errorlevel 1 (
    exit /b 1
) else (
    exit /b 0
)

:check_admin
net session >nul 2>&1
if errorlevel 1 (
    exit /b 1
) else (
    exit /b 0
)

:get_system_info
for /f "tokens=2 delims==" %%i in ('wmic os get caption /value ^| find "="') do set "OS_NAME=%%i"
for /f "tokens=2 delims==" %%i in ('wmic os get version /value ^| find "="') do set "OS_VERSION=%%i"
for /f "tokens=2 delims==" %%i in ('wmic computersystem get SystemType /value ^| find "="') do set "ARCH=%%i"
goto :eof

:check_disk_space
for /f "tokens=3" %%i in ('dir /-c %USERPROFILE% ^| find "bytes free"') do (
    set /a "FREE_GB=%%i/1024/1024/1024"
)
if !FREE_GB! LSS 5 (
    call :log_error "Espaço insuficiente em disco. Necessário: 5GB, Disponível: !FREE_GB!GB"
    exit /b 1
)
call :log_info "Espaço em disco: !FREE_GB!GB disponível"
goto :eof

:check_memory
for /f "skip=1 tokens=2" %%i in ('wmic computersystem get TotalPhysicalMemory ^| find /v ""') do (
    set /a "TOTAL_RAM_GB=%%i/1024/1024/1024"
)
if !TOTAL_RAM_GB! LSS 4 (
    call :log_warn "Memória RAM baixa: !TOTAL_RAM_GB!GB (recomendado: 4GB+)"
) else (
    call :log_info "Memória RAM: !TOTAL_RAM_GB!GB"
)
goto :eof

REM =============================================================================
REM 🔒 VERIFICAÇÕES PRELIMINARES
REM =============================================================================

:check_requirements
call :log_step "Verificando requisitos do sistema"

REM Verificar se está rodando como administrador
call :check_admin
if errorlevel 1 (
    call :log_error "Execute como Administrador"
    call :log_info "Clique com botão direito no script e selecione 'Executar como administrador'"
    pause
    exit /b 1
)

REM Verificar conexão internet
call :check_internet
if errorlevel 1 (
    call :log_error "Sem conexão com internet"
    call :log_info "Verifique sua conexão e tente novamente"
    pause
    exit /b 1
)

call :check_disk_space
if errorlevel 1 (
    pause
    exit /b 1
)

call :check_memory

REM Obter informações do sistema
call :get_system_info
call :log_info "Sistema: !OS_NAME! (!OS_VERSION!)"
call :log_info "Arquitetura: !ARCH!"

REM Verificar versão do Windows
echo !OS_VERSION! | findstr /r "^10\." >nul
if not errorlevel 1 (
    call :log_info "Windows 10 detectado"
    goto :version_ok
)

echo !OS_VERSION! | findstr /r "^6\." >nul
if not errorlevel 1 (
    call :log_warn "Windows 7/8 detectado - algumas funcionalidades podem não funcionar"
    goto :version_ok
)

call :log_info "Versão do Windows suportada"

:version_ok
call :log_info "Verificações preliminares concluídas"
goto :eof

REM =============================================================================
REM 📦 INSTALAÇÃO DO CHOCOLATEY
REM =============================================================================

:install_chocolatey
call :log_step "Instalando Chocolatey Package Manager"

call :check_command choco
if not errorlevel 1 (
    call :log_info "Chocolatey já está instalado"
    goto :eof
)

call :log_info "Baixando e instalando Chocolatey..."

powershell -Command "Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))"

if errorlevel 1 (
    call :log_error "Falha na instalação do Chocolatey"
    exit /b 1
)

REM Atualizar PATH
call refreshenv
set "PATH=%PATH%;%ALLUSERSPROFILE%\chocolatey\bin"

call :check_command choco
if errorlevel 1 (
    call :log_error "Chocolatey não foi instalado corretamente"
    call :log_info "Reinicie o prompt como administrador e tente novamente"
    exit /b 1
)

call :log_info "Chocolatey instalado com sucesso"
goto :eof

REM =============================================================================
REM 📦 INSTALAÇÃO DE DEPENDÊNCIAS DO SISTEMA
REM =============================================================================

:install_system_deps
call :log_step "Instalando dependências do sistema"

call :log_info "Instalando dependências básicas via Chocolatey..."

REM Instalar Node.js
call :check_command node
if errorlevel 1 (
    call :log_info "Instalando Node.js..."
    choco install nodejs --version=18.20.4 -y
    if errorlevel 1 (
        call :log_error "Falha na instalação do Node.js"
        exit /b 1
    )
) else (
    for /f "tokens=1" %%v in ('node --version') do (
        set "NODE_VERSION=%%v"
        set "NODE_MAJOR=!NODE_VERSION:~1,2!"
    )
    if !NODE_MAJOR! LSS 18 (
        call :log_info "Atualizando Node.js para versão 18..."
        choco upgrade nodejs --version=18.20.4 -y
    ) else (
        call :log_info "Node.js já está instalado"
    )
)

REM Instalar Python
call :check_command python
if errorlevel 1 (
    call :log_info "Instalando Python..."
    choco install python3 -y
    if errorlevel 1 (
        call :log_error "Falha na instalação do Python"
        exit /b 1
    )
)

REM Instalar Git
call :check_command git
if errorlevel 1 (
    call :log_info "Instalando Git..."
    choco install git -y
    if errorlevel 1 (
        call :log_error "Falha na instalação do Git"
        exit /b 1
    )
)

REM Instalar FFmpeg
call :check_command ffmpeg
if errorlevel 1 (
    call :log_info "Instalando FFmpeg..."
    choco install ffmpeg -y
    if errorlevel 1 (
        call :log_error "Falha na instalação do FFmpeg"
        exit /b 1
    )
)

REM Instalar MongoDB
call :check_command mongod
if errorlevel 1 (
    call :log_info "Instalando MongoDB..."
    choco install mongodb -y
    if errorlevel 1 (
        call :log_error "Falha na instalação do MongoDB"
        exit /b 1
    )
)

REM Instalar utilitários
call :log_info "Instalando utilitários adicionais..."
choco install curl wget 7zip -y

REM Atualizar PATH
call refreshenv

REM Verificar instalações
call :log_info "Verificando instalações..."

call :check_command node
if errorlevel 1 (
    call :log_error "Node.js não foi instalado corretamente"
    exit /b 1
)

for /f "tokens=1" %%v in ('node --version') do (
    call :log_info "Node.js %%v ✓"
)

call :check_command npm
if errorlevel 1 (
    call :log_error "npm não foi instalado corretamente"
    exit /b 1
)

for /f "tokens=1" %%v in ('npm --version') do (
    call :log_info "npm v%%v ✓"
)

call :check_command python
if errorlevel 1 (
    call :log_error "Python não foi instalado corretamente"
    exit /b 1
)

for /f "tokens=2" %%v in ('python --version') do (
    call :log_info "Python %%v ✓"
)

call :check_command git
if errorlevel 1 (
    call :log_error "Git não foi instalado corretamente"
    exit /b 1
)

for /f "tokens=3" %%v in ('git --version') do (
    call :log_info "Git %%v ✓"
)

call :check_command ffmpeg
if errorlevel 1 (
    call :log_error "FFmpeg não foi instalado corretamente"
    exit /b 1
)

call :log_info "FFmpeg ✓"

call :log_info "Dependências do sistema instaladas com sucesso"
goto :eof

REM =============================================================================
REM 🗄️ CONFIGURAÇÃO DO MONGODB
REM =============================================================================

:setup_mongodb
call :log_step "Configurando MongoDB"

REM Verificar se serviço MongoDB existe
sc query MongoDB >nul 2>&1
if errorlevel 1 (
    call :log_info "Configurando MongoDB como serviço..."
    
    REM Criar diretório de dados
    if not exist "C:\data\db" mkdir "C:\data\db"
    
    REM Instalar serviço MongoDB
    mongod --install --serviceName MongoDB --serviceDisplayName "MongoDB" --logpath "C:\data\db\mongodb.log" --dbpath "C:\data\db"
    
    if errorlevel 1 (
        call :log_error "Falha ao instalar serviço MongoDB"
        exit /b 1
    )
)

REM Iniciar serviço MongoDB
call :log_info "Iniciando serviço MongoDB..."
net start MongoDB
if errorlevel 1 (
    sc start MongoDB
    if errorlevel 1 (
        call :log_error "Falha ao iniciar MongoDB"
        exit /b 1
    )
)

REM Aguardar MongoDB inicializar
call :log_info "Aguardando MongoDB inicializar..."
timeout /t 10 /nobreak >nul

REM Verificar se MongoDB está rodando
call :check_service MongoDB
if errorlevel 1 (
    call :log_error "MongoDB não está rodando"
    exit /b 1
)

call :log_info "MongoDB iniciado com sucesso"

REM Criar usuário do banco
call :log_info "Criando usuário do banco de dados..."

REM Preparar script MongoDB
echo use %MONGO_DB_NAME% > "%TEMP%\mongo_setup.js"
echo db.createUser({user: "%MONGO_USER%", pwd: "%MONGO_PASSWORD%", roles: ["readWrite"]}) >> "%TEMP%\mongo_setup.js"

REM Executar script
call :check_command mongosh
if not errorlevel 1 (
    mongosh < "%TEMP%\mongo_setup.js"
) else (
    call :check_command mongo
    if not errorlevel 1 (
        mongo < "%TEMP%\mongo_setup.js"
    ) else (
        call :log_error "Cliente MongoDB não encontrado"
        exit /b 1
    )
)

if errorlevel 1 (
    call :log_warn "Falha ao criar usuário (pode já existir)"
) else (
    call :log_info "Usuário MongoDB criado: %MONGO_USER%"
)

REM Limpar arquivo temporário
del "%TEMP%\mongo_setup.js" 2>nul

REM Testar conexão
call :log_info "Testando conexão MongoDB..."
set "MONGO_URI=mongodb://%MONGO_USER%:%MONGO_PASSWORD%@localhost:27017/%MONGO_DB_NAME%?authSource=%MONGO_DB_NAME%"

if exist "%PROGRAMFILES%\MongoDB\Server\*\bin\mongosh.exe" (
    "%PROGRAMFILES%\MongoDB\Server\*\bin\mongosh.exe" "%MONGO_URI%" --eval "db.runCommand({ping: 1})" >nul 2>&1
) else (
    mongosh "%MONGO_URI%" --eval "db.runCommand({ping: 1})" >nul 2>&1
)

if errorlevel 1 (
    call :log_error "Falha ao conectar ao MongoDB com credenciais"
    exit /b 1
)

call :log_info "MongoDB configurado com sucesso ✓"
goto :eof

REM =============================================================================
REM 🤖 INSTALAÇÃO DO OLLAMA
REM =============================================================================

:install_ollama
call :log_step "Instalando Ollama"

call :check_command ollama
if not errorlevel 1 (
    call :log_info "Ollama já está instalado"
    goto :download_models
)

call :log_info "Baixando Ollama para Windows..."

REM Baixar instalador do Ollama
powershell -Command "Invoke-WebRequest -Uri 'https://ollama.com/download/OllamaSetup.exe' -OutFile '%TEMP%\OllamaSetup.exe'"

if errorlevel 1 (
    call :log_error "Falha ao baixar Ollama"
    exit /b 1
)

call :log_info "Instalando Ollama..."
start /wait "%TEMP%\OllamaSetup.exe" /S

if errorlevel 1 (
    call :log_error "Falha na instalação do Ollama"
    exit /b 1
)

REM Atualizar PATH
call refreshenv

call :check_command ollama
if errorlevel 1 (
    call :log_error "Ollama não foi instalado corretamente"
    call :log_info "Reinicie o sistema e tente novamente"
    exit /b 1
)

call :log_info "Ollama instalado com sucesso"

:download_models
REM Iniciar Ollama
call :log_info "Iniciando Ollama..."
start /min ollama serve

REM Aguardar Ollama inicializar
call :log_info "Aguardando Ollama inicializar..."
timeout /t 15 /nobreak >nul

REM Verificar se Ollama está acessível
for /l %%i in (1,1,30) do (
    curl -s http://127.0.0.1:11434/api/tags >nul 2>&1
    if not errorlevel 1 (
        call :log_info "Ollama API disponível"
        goto :models_download
    )
    timeout /t 2 /nobreak >nul
)

call :log_error "Ollama falhou ao inicializar"
exit /b 1

:models_download
REM Baixar modelos essenciais
call :log_info "Baixando modelos de IA..."

call :log_info "Baixando llama3.2:latest (modelo de texto)..."
ollama pull llama3.2:latest
if errorlevel 1 (
    call :log_error "Falha ao baixar modelo llama3.2"
    exit /b 1
)

call :log_info "Baixando llava:latest (modelo de imagem)..."
ollama pull llava:latest
if errorlevel 1 (
    call :log_error "Falha ao baixar modelo llava"
    exit /b 1
)

REM Listar modelos instalados
call :log_info "Modelos instalados:"
ollama list

call :log_info "Ollama configurado com sucesso ✓"
goto :eof

REM =============================================================================
REM 📱 CONFIGURAÇÃO DO PROJETO SECREBOT
REM =============================================================================

:setup_project
call :log_step "Configurando projeto SecreBot"

REM Remover instalação existente se houver
if exist "%INSTALL_DIR%" (
    call :log_warn "Diretório existente encontrado: %INSTALL_DIR%"
    set /p "REPLY=Deseja sobrescrever? (s/N): "
    if /i "!REPLY!"=="s" (
        call :log_info "Removendo instalação anterior..."
        rmdir /s /q "%INSTALL_DIR%"
    ) else (
        call :log_error "Instalação cancelada pelo usuário"
        exit /b 1
    )
)

REM Clonar projeto
call :log_info "Clonando projeto SecreBot..."

REM Verificar se SECREBOT_REPO está definido
if defined SECREBOT_REPO (
    git clone "%SECREBOT_REPO%" "%INSTALL_DIR%"
) else (
    REM Se estamos executando dentro do diretório do projeto
    if exist "%~dp0package.json" (
        call :log_info "Copiando projeto atual..."
        xcopy "%~dp0*" "%INSTALL_DIR%\" /E /I /H /Y
    ) else (
        call :log_error "URL do repositório não fornecida e package.json não encontrado"
        call :log_info "Defina a variável SECREBOT_REPO ou execute dentro do diretório do projeto"
        exit /b 1
    )
)

if errorlevel 1 (
    call :log_error "Falha ao clonar/copiar projeto"
    exit /b 1
)

cd /d "%INSTALL_DIR%"

REM Verificar se é um projeto SecreBot válido
if not exist "package.json" (
    call :log_error "Projeto SecreBot inválido (package.json não encontrado)"
    exit /b 1
)

findstr /i "whatsapp" package.json >nul
if errorlevel 1 (
    call :log_error "Projeto SecreBot inválido (não contém dependências WhatsApp)"
    exit /b 1
)

call :log_info "Projeto clonado com sucesso"

REM Instalar dependências NPM
call :log_info "Instalando dependências NPM..."
npm install
if errorlevel 1 (
    call :log_error "Falha na instalação das dependências NPM"
    exit /b 1
)

REM Instalar Playwright
call :log_info "Instalando navegadores Playwright..."
npx playwright install
if errorlevel 1 (
    call :log_warn "Falha na instalação do Playwright (não crítico)"
)

REM Configurar Whisper
call :log_info "Configurando Whisper para transcrição de áudio..."
call :check_command python
if errorlevel 1 (
    call :log_error "Python necessário para Whisper"
    exit /b 1
)

REM Instalar dependências NPM para Whisper
call :log_info "Instalando nodejs-whisper e dependências..."
npm install --save nodejs-whisper
if errorlevel 1 (
    call :log_warn "Falha na instalação do nodejs-whisper (não crítico)"
) else (
    call :log_info "nodejs-whisper instalado com sucesso"
)

REM Verificar se FFmpeg está disponível
call :check_command ffmpeg
if errorlevel 1 (
    call :log_error "FFmpeg necessário para Whisper"
    exit /b 1
)

call :log_info "Whisper configurado com sucesso ✓"

REM Criar arquivo .env
call :log_info "Configurando arquivo .env..."
if exist ".env.example" (
    copy ".env.example" ".env" >nul
    
    REM Configurar MongoDB no .env
    powershell -Command "(Get-Content .env) -replace 'mongodb://bot:sua_senha@localhost:27017/sched\?authSource=sched', 'mongodb://%MONGO_USER%:%MONGO_PASSWORD%@localhost:27017/%MONGO_DB_NAME%?authSource=%MONGO_DB_NAME%' | Set-Content .env"
    
    REM Configurar Piper como padrão (será configurado automaticamente pela função install_piper)
    powershell -Command "(Get-Content .env) -replace '^# PIPER_ENABLED=.*', 'PIPER_ENABLED=true' | Set-Content .env"
    powershell -Command "(Get-Content .env) -replace '^# PIPER_EXECUTABLE=.*', 'PIPER_EXECUTABLE=./piper/piper-wrapper.bat' | Set-Content .env"
    powershell -Command "(Get-Content .env) -replace '^# PIPER_MODEL=.*', 'PIPER_MODEL=./piper/models/pt_BR-cadu-medium.onnx' | Set-Content .env"
    
    call :log_info "Arquivo .env configurado"
) else (
    call :log_error "Arquivo .env.example não encontrado"
    exit /b 1
)

call :log_info "Projeto SecreBot configurado com sucesso ✓"
goto :eof

REM =============================================================================
REM 🎤 INSTALAÇÃO DO PIPER TTS
REM =============================================================================

:install_piper
call :log_step "Instalando Piper TTS"

cd /d "%INSTALL_DIR%"

REM Criar diretório do Piper
call :log_info "Criando diretório do Piper..."
if not exist "piper" mkdir piper
if not exist "piper\models" mkdir piper\models

REM Detectar arquitetura
set "PIPER_ARCH=amd64"
if "%PROCESSOR_ARCHITECTURE%"=="ARM64" set "PIPER_ARCH=arm64"

REM URLs dos arquivos
set "PIPER_VERSION=1.2.0"
set "PIPER_URL=https://github.com/rhasspy/piper/releases/download/v%PIPER_VERSION%/piper_windows_%PIPER_ARCH%.zip"
set "CADU_VOICE_URL=https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/pt/pt_BR/cadu/medium/pt_BR-cadu-medium.onnx"
set "CADU_CONFIG_URL=https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/pt/pt_BR/cadu/medium/pt_BR-cadu-medium.onnx.json"

REM Baixar binário do Piper
call :log_info "Baixando Piper %PIPER_VERSION% para %PIPER_ARCH%..."
powershell -Command "try { Invoke-WebRequest -Uri '%PIPER_URL%' -OutFile '%TEMP%\piper_windows.zip' -UseBasicParsing } catch { exit 1 }"
if errorlevel 1 (
    call :log_error "Falha ao baixar Piper"
    powershell -Command "(Get-Content .env) -replace 'PIPER_ENABLED=true', 'PIPER_ENABLED=false' | Set-Content .env"
    goto :eof
)

REM Extrair Piper
call :log_info "Extraindo Piper..."
powershell -Command "try { Expand-Archive -Path '%TEMP%\piper_windows.zip' -DestinationPath 'piper' -Force } catch { exit 1 }"
if errorlevel 1 (
    call :log_error "Falha ao extrair Piper"
    powershell -Command "(Get-Content .env) -replace 'PIPER_ENABLED=true', 'PIPER_ENABLED=false' | Set-Content .env"
    goto :eof
)

REM Baixar voz Cadu (português brasileiro)
call :log_info "Baixando voz Cadu (português brasileiro)..."
powershell -Command "try { Invoke-WebRequest -Uri '%CADU_VOICE_URL%' -OutFile 'piper\models\pt_BR-cadu-medium.onnx' -UseBasicParsing } catch { exit 1 }"
if errorlevel 1 (
    call :log_error "Falha ao baixar voz Cadu"
    powershell -Command "(Get-Content .env) -replace 'PIPER_ENABLED=true', 'PIPER_ENABLED=false' | Set-Content .env"
    goto :eof
)

REM Baixar arquivo de configuração da voz Cadu
call :log_info "Baixando configuração da voz Cadu..."
powershell -Command "try { Invoke-WebRequest -Uri '%CADU_CONFIG_URL%' -OutFile 'piper\models\pt_BR-cadu-medium.onnx.json' -UseBasicParsing } catch { exit 1 }"
if errorlevel 1 (
    call :log_error "Falha ao baixar configuração da voz Cadu"
    powershell -Command "(Get-Content .env) -replace 'PIPER_ENABLED=true', 'PIPER_ENABLED=false' | Set-Content .env"
    goto :eof
)

REM Criar script wrapper para facilitar uso
call :log_info "Criando script wrapper do Piper..."
echo @echo off > piper\piper-wrapper.bat
echo REM Wrapper para Piper TTS - SecreBot >> piper\piper-wrapper.bat
echo set "SCRIPT_DIR=%%~dp0" >> piper\piper-wrapper.bat
echo set "PIPER_BIN=%%SCRIPT_DIR%%piper.exe" >> piper\piper-wrapper.bat
echo set "DEFAULT_MODEL=%%SCRIPT_DIR%%models\pt_BR-cadu-medium.onnx" >> piper\piper-wrapper.bat
echo. >> piper\piper-wrapper.bat
echo REM Verificar se o binário existe >> piper\piper-wrapper.bat
echo if not exist "%%PIPER_BIN%%" ( >> piper\piper-wrapper.bat
echo     echo Erro: Binário do Piper não encontrado em %%PIPER_BIN%% ^>^&2 >> piper\piper-wrapper.bat
echo     exit /b 1 >> piper\piper-wrapper.bat
echo ^) >> piper\piper-wrapper.bat
echo. >> piper\piper-wrapper.bat
echo REM Verificar se o modelo existe >> piper\piper-wrapper.bat
echo if not exist "%%DEFAULT_MODEL%%" ( >> piper\piper-wrapper.bat
echo     echo Erro: Modelo da voz não encontrado em %%DEFAULT_MODEL%% ^>^&2 >> piper\piper-wrapper.bat
echo     exit /b 1 >> piper\piper-wrapper.bat
echo ^) >> piper\piper-wrapper.bat
echo. >> piper\piper-wrapper.bat
echo REM Executar Piper com modelo padrão se não especificado >> piper\piper-wrapper.bat
echo echo %%* ^| findstr /C:"--model" ^>nul >> piper\piper-wrapper.bat
echo if errorlevel 1 ( >> piper\piper-wrapper.bat
echo     "%%PIPER_BIN%%" --model "%%DEFAULT_MODEL%%" %%* >> piper\piper-wrapper.bat
echo ^) else ( >> piper\piper-wrapper.bat
echo     "%%PIPER_BIN%%" %%* >> piper\piper-wrapper.bat
echo ^) >> piper\piper-wrapper.bat

REM Testar instalação do Piper
call :log_info "Testando instalação do Piper..."
echo Teste do Piper TTS | piper\piper-wrapper.bat --output_file "%TEMP%\piper_test.wav" >nul 2>&1
if not errorlevel 1 (
    call :log_info "Piper TTS instalado e testado com sucesso ✓"
    del "%TEMP%\piper_test.wav" 2>nul
    
    REM Configurar .env para usar Piper
    powershell -Command "(Get-Content .env) -replace '^# PIPER_ENABLED=.*', 'PIPER_ENABLED=true' | Set-Content .env"
    powershell -Command "(Get-Content .env) -replace '^# PIPER_EXECUTABLE=.*', 'PIPER_EXECUTABLE=./piper/piper-wrapper.bat' | Set-Content .env"
    powershell -Command "(Get-Content .env) -replace '^# PIPER_MODEL=.*', 'PIPER_MODEL=./piper/models/pt_BR-cadu-medium.onnx' | Set-Content .env"
    
) else (
    call :log_warn "Falha no teste do Piper (desabilitando TTS)"
    powershell -Command "(Get-Content .env) -replace 'PIPER_ENABLED=true', 'PIPER_ENABLED=false' | Set-Content .env"
)

REM Limpar arquivo temporário
del "%TEMP%\piper_windows.zip" 2>nul

call :log_info "Instalação do Piper concluída"
goto :eof

REM =============================================================================
REM ✅ VALIDAÇÃO DA INSTALAÇÃO
REM =============================================================================

:validate_installation
call :log_step "Validando instalação"

cd /d "%INSTALL_DIR%"

REM Verificar serviços
call :log_info "Verificando serviços..."

call :check_service MongoDB
if errorlevel 1 (
    call :log_error "MongoDB não está rodando"
    exit /b 1
)
call :log_info "MongoDB: ✓ Rodando"

curl -s http://127.0.0.1:11434/api/tags >nul 2>&1
if errorlevel 1 (
    call :log_error "Ollama não está acessível"
    exit /b 1
)
call :log_info "Ollama: ✓ Acessível"

REM Verificar dependências Node.js
call :log_info "Verificando dependências Node.js..."
npm list >nul 2>&1
if errorlevel 1 (
    call :log_error "Dependências Node.js não instaladas corretamente"
    exit /b 1
)
call :log_info "Dependências NPM: ✓ Instaladas"

REM Verificar arquivo .env
if not exist ".env" (
    call :log_error "Arquivo .env não encontrado"
    exit /b 1
)
call :log_info "Configuração: ✓ .env presente"

REM Teste de conectividade MongoDB
call :log_info "Testando conectividade MongoDB..."
set "MONGO_URI=mongodb://%MONGO_USER%:%MONGO_PASSWORD%@localhost:27017/%MONGO_DB_NAME%?authSource=%MONGO_DB_NAME%"

call :check_command mongosh
if not errorlevel 1 (
    mongosh "%MONGO_URI%" --eval "db.runCommand({ping: 1})" >nul 2>&1
) else (
    mongo "%MONGO_URI%" --eval "db.runCommand({ping: 1})" >nul 2>&1
)

if errorlevel 1 (
    call :log_error "Falha na conectividade MongoDB"
    exit /b 1
)
call :log_info "MongoDB: ✓ Conectividade OK"

REM Teste básico do projeto (se houver testes)
npm run | findstr "test" >nul 2>&1
if not errorlevel 1 (
    call :log_info "Executando testes do projeto..."
    npm test
    if errorlevel 1 (
        call :log_warn "Alguns testes falharam (não crítico)"
    ) else (
        call :log_info "Testes: ✓ Passou"
    )
)

call :log_info "Validação concluída com sucesso ✓"
goto :eof

REM =============================================================================
REM 🧹 LIMPEZA E TRATAMENTO DE ERROS
REM =============================================================================

:cleanup_on_error
call :log_error "Limpando após erro..."

REM Remover arquivos temporários
del "%TEMP%\mongo_setup.js" 2>nul
del "%TEMP%\OllamaSetup.exe" 2>nul

call :log_info "Log completo disponível em: %LOG_FILE%"
goto :eof

:handle_error
call :log_error "Erro durante a instalação"
call :log_info "Código de erro: %ERRORLEVEL%"

REM Sugestões baseadas no código de erro
if %ERRORLEVEL%==1 (
    call :log_info "💡 Solução: Verifique as permissões e conexão de internet"
) else if %ERRORLEVEL%==2 (
    call :log_info "💡 Solução: Verifique se todos os argumentos foram fornecidos"
) else if %ERRORLEVEL%==5 (
    call :log_info "💡 Solução: Execute como Administrador"
) else (
    call :log_info "💡 Consulte o log completo: %LOG_FILE%"
)

call :cleanup_on_error
pause
exit /b %ERRORLEVEL%

REM =============================================================================
REM 📊 RELATÓRIO FINAL
REM =============================================================================

:show_final_report
call :log_step "Relatório de Instalação"

echo.
echo %GREEN%🎉 INSTALAÇÃO CONCLUÍDA COM SUCESSO! 🎉%NC%
echo.

echo %CYAN%📋 RESUMO DA INSTALAÇÃO:%NC%
echo   🪟 Sistema: !OS_NAME! (!OS_VERSION!)
for /f "tokens=1" %%v in ('node --version') do echo   📦 Node.js: %%v
echo   🗄️ MongoDB: Configurado com usuário '%MONGO_USER%'
for /f "tokens=1" %%c in ('ollama list ^| find /c /v ""') do echo   🤖 Ollama: %%c modelos instalados
echo   📱 SecreBot: Instalado em %INSTALL_DIR%
if exist "%INSTALL_DIR%\piper\piper.exe" (
    echo   🎤 Piper TTS: Instalado com voz Cadu
) else (
    echo   🎤 Piper TTS: Falha na instalação
)

echo.
echo %CYAN%🚀 PRÓXIMOS PASSOS:%NC%
echo   1. cd /d "%INSTALL_DIR%"
echo   2. npm start
echo   3. Escaneie o QR Code com seu WhatsApp
echo   4. Envie uma mensagem para testar

echo.
echo %CYAN%🌐 INTERFACES DISPONÍVEIS:%NC%
echo   • WhatsApp Bot: Ativo após escanear QR Code
echo   • Interface Web: http://localhost:3000
echo   • API REST: http://localhost:3000/api

echo.
echo %CYAN%📖 COMANDOS ÚTEIS:%NC%
echo   • Iniciar: npm start
echo   • Parar: Ctrl+C
echo   • Status MongoDB: sc query MongoDB
echo   • Status Ollama: tasklist ^| findstr ollama

echo.
echo %CYAN%🆘 SUPORTE:%NC%
echo   • Documentação: %INSTALL_DIR%\README.md
echo   • Log de instalação: %LOG_FILE%
echo   • Configuração: %INSTALL_DIR%\.env

echo.
echo %GREEN%Instalação realizada em: %DATE% %TIME%%NC%
echo.
goto :eof

REM =============================================================================
REM 🎯 EXECUÇÃO PRINCIPAL
REM =============================================================================

:main
REM Exibir cabeçalho
cls
echo %PURPLE%=============================================================================%NC%
echo %PURPLE%🚀 SecreBot - Instalador Automático para Windows v%SCRIPT_VERSION%%NC%
echo %PURPLE%=============================================================================%NC%
echo %CYAN%Assistente Inteligente para WhatsApp com IA Avançada%NC%
echo %CYAN%Este script irá instalar automaticamente todas as dependências necessárias%NC%
echo %PURPLE%=============================================================================%NC%
echo.

REM Inicializar log
echo SecreBot Installation Log - %DATE% %TIME% > "%LOG_FILE%"
echo Script Version: %SCRIPT_VERSION% >> "%LOG_FILE%"
echo ======================================== >> "%LOG_FILE%"

call :log_info "Iniciando instalação do SecreBot v%SCRIPT_VERSION%"
call :log_info "Log: %LOG_FILE%"

REM Executar etapas
call :check_requirements
if errorlevel 1 goto :handle_error

call :install_chocolatey
if errorlevel 1 goto :handle_error

call :install_system_deps
if errorlevel 1 goto :handle_error

call :setup_mongodb
if errorlevel 1 goto :handle_error

call :install_ollama
if errorlevel 1 goto :handle_error

call :setup_project
if errorlevel 1 goto :handle_error

call :install_piper
if errorlevel 1 goto :handle_error

call :validate_installation
if errorlevel 1 goto :handle_error

REM Relatório final
call :show_final_report

call :log_info "🎉 Instalação concluída com sucesso!"
goto :end

:end
echo.
echo %GREEN%SecreBot está pronto para uso!%NC%
echo %YELLOW%Pressione qualquer tecla para continuar...%NC%
pause >nul
exit /b 0