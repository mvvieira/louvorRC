#!/bin/zsh -l
cd "$(dirname "$0")"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh"
export PATH="$HOME/.homebrew/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v npm >/dev/null; then
  echo "Node.js não encontrado. Instale em https://nodejs.org e rode de novo."; read; exit 1
fi
echo "Node $(node -v)"
[ -d node_modules ] || npm install
(sleep 8; open http://localhost:3000) &
npm run dev
