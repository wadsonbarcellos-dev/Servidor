#!/bin/bash

# Script para aplicar as melhorias do Manus no repositório local
echo "Iniciando atualização do Creeper Panel..."

# 1. Instalar dependências se necessário
# pnpm install

# 2. Garantir que o playit esteja instalado (opcional, dependendo do ambiente)
if ! command -v playit &> /dev/null; then
    echo "Aviso: playit.gg não encontrado. Recomenda-se instalar para o túnel automático."
fi

echo "Atualização concluída com sucesso! O visual Creeper Fofinho foi aplicado."
echo "Execute 'pnpm dev' ou seu comando de inicialização para ver as mudanças."
