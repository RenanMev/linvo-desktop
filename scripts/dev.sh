#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ ! -f ".env" ]; then
  echo "Arquivo .env não encontrado. Copie .env.example para .env:"
  echo "  cp .env.example .env"
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

echo "==> Iniciando Desktop (Tauri)..."
echo "    API esperada em: ${VITE_API_URL:-http://localhost:3001}"
echo ""
echo "    Para subir a API localmente, use o repositório privado linvo-api."
echo ""

pnpm --filter @linvo/desktop tauri dev
