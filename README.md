# Linvo Desktop

Cliente desktop do Linvo — assistente de atendimento com barra flutuante, painel de chat e autenticação.

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
- Uma API disponível: rode um back local da forma que você quiser, ou utilize o back do projeto: `api.linvo.com.br`

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

O pacote `@linvo/shared` em `packages/shared/` é a **fonte canônica** dos schemas Zod e tipos da API.

Antes de publicar ou consumir externamente, compile o pacote:

```bash
pnpm --filter @linvo/shared build
```

---

## Licença

MIT — veja [LICENSE](LICENSE).
