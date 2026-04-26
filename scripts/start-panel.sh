#!/bin/bash

# Cores para o terminal
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}Iniciando Painel Creeper Profissional...${NC}"

# Garantir que as dependências estão instaladas
if [ ! -d "node_modules" ]; then
    echo "Instalando dependências..."
    pnpm install
fi

# Limpar sessões antigas do tmux se necessário
tmux kill-session -t panel-server 2>/dev/null

# Iniciar o Next.js em uma sessão tmux para persistência
echo "Iniciando servidor web em background..."
tmux new-session -d -s panel-server 'pnpm dev'

echo -e "${GREEN}Painel pronto! Acesse via porta 3000.${NC}"
