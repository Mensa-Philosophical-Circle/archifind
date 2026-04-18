#!/usr/bin/env bash
set -euo pipefail

REPO_TAP="Mensa-Philosophical-Circle/archifind"
REPO_URL="https://github.com/Mensa-Philosophical-Circle/archifind.git"
FORMULA_NAME="archifind"

echo "[archifind] Checking for Homebrew..."
if ! command -v brew >/dev/null 2>&1; then
  echo "[archifind] Homebrew is not installed. Install it first:"
  echo "  /bin/bash -c \"$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
  exit 1
fi

echo "[archifind] Tapping ${REPO_TAP}..."
brew tap "${REPO_TAP}" "${REPO_URL}"

echo "[archifind] Installing ${FORMULA_NAME}..."
if ! brew install "mensa-philosophical-circle/archifind/${FORMULA_NAME}"; then
  if brew list --versions "${FORMULA_NAME}" >/dev/null 2>&1; then
    echo "[archifind] ${FORMULA_NAME} is installed, but brew reported a dependency link warning."
    echo "[archifind] This is usually safe when another Node installation (for example nvm) already owns /usr/local/bin/node."
    exit 0
  fi

  echo "[archifind] Installation failed before ${FORMULA_NAME} was installed."
  exit 1
fi

echo "[archifind] Done. Run 'archifind --help' to verify the install."
