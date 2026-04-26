# Minecraft Codespaces Panel

Painel privado para gerenciar servidores Minecraft dentro do GitHub Codespaces.

## O que acontece automaticamente no Codespaces

Ao abrir o repositório em um Codespace:

- Node.js 20 e Java 17 sao instalados pelo `devcontainer`
- `pnpm` e ativado com `corepack`
- as dependencias do projeto sao instaladas
- `tmux` e instalado se ainda nao existir
- o servidor Next.js sobe automaticamente na porta `3000`
- a porta `3000` e encaminhada como privada e aberta no preview

## Se quiser reiniciar manualmente

```bash
pnpm dev --hostname 0.0.0.0 --port 3000
```

## Logs do painel

```bash
tail -f .codespaces/next-dev.log
```
