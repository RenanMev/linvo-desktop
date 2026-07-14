# @linvo/shared

Contratos Zod e tipos TypeScript compartilhados entre o cliente desktop e a API.

## Módulos

| Arquivo | Conteúdo |
|---------|----------|
| `auth` | Login, registro, tokens, usuário público |
| `chat` | Conversas, mensagens, tool uses |
| `health` | Resposta de health check |
| `time` | Utilitários de data/hora |

Contratos do pipeline de assistente (`assist`) ficam apenas no repositório privado `linvo-api`.

## Uso no monorepo

```bash
pnpm --filter @linvo/shared build
pnpm --filter @linvo/shared test
```

## Consumo externo

O `linvo-api` referencia este pacote via `file:../linvo-desktop/packages/shared`. Os repositórios devem estar clonados lado a lado.
