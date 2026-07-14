# Linvo Desktop

Cliente desktop do Linvo — assistente de atendimento com barra flutuante, painel de chat e autenticação.

Repositório **público**. O backend vive no repositório privado [linvo-api](https://github.com/RenanMev/linvo-api).

---

## Estrutura

```
linvo-desktop/
├── apps/desktop/       # App Tauri + React
├── packages/shared/    # Contratos Zod da API (fonte canônica)
├── scripts/dev.sh      # Inicia o desktop em modo dev
└── .github/workflows/  # CI do desktop e shared
```

| Pacote | Descrição |
|--------|-----------|
| `@linvo/desktop` | UI Tauri + React (barra flutuante, painel, auth, chat) |
| `@linvo/shared` | Schemas Zod e tipos compartilhados com a API |

---

## Pré-requisitos

- Node.js 22 (`.nvmrc`)
- pnpm 11
- Rust + toolchain Tauri ([guia oficial](https://v2.tauri.app/start/prerequisites/))
- API Linvo rodando localmente ([linvo-api](https://github.com/RenanMev/linvo-api))

---

## Setup local

```bash
git clone https://github.com/RenanMev/linvo-desktop.git
cd linvo-desktop

pnpm install

cp .env.example .env

pnpm tauri dev
```

Atalho: `pnpm dev:desktop`

### API em paralelo

O desktop consome a API via `VITE_API_URL`. Para desenvolvimento completo, clone o backend como repositório irmão:

```
GitHub/
├── linvo-desktop/   ← este repo
└── linvo-api/       ← backend privado
```

---

## Scripts

| Comando | Descrição |
|---------|-----------|
| `pnpm tauri dev` | Desktop Tauri em modo dev |
| `pnpm dev:desktop` | Wrapper com checagem de `.env` |
| `pnpm build` | Build de produção (desktop + shared) |
| `pnpm test` | Testes (Vitest) |
| `pnpm --filter @linvo/shared build` | Compila contratos Zod |

---

## Variáveis de ambiente

| Variável | Descrição |
|----------|-----------|
| `VITE_API_URL` | URL base da API (padrão: `http://localhost:3001`) |

---

## Contratos compartilhados

O pacote `@linvo/shared` em `packages/shared/` é a **fonte canônica** dos schemas Zod e tipos da API. O `linvo-api` consome este pacote via dependência local — não duplique os contratos no backend.

Antes de publicar ou consumir externamente, compile o pacote:

```bash
pnpm --filter @linvo/shared build
```

---

## Licença

MIT — veja [LICENSE](LICENSE).
