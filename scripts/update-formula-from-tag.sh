#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo "Usage: $0 <tag> [version]"
  echo "Example: $0 v1.0.1 1.0.1"
  exit 1
fi

TAG="$1"
VERSION="${2:-}"
REPO="${REPO:-Mensa-Philosophical-Circle/archifind}"
FORMULA_PATH="Formula/archifind.rb"
ARCHIVE_URL="https://github.com/${REPO}/archive/refs/tags/${TAG}.tar.gz"
TMP_FILE="/tmp/archifind-${TAG}.tar.gz"

if [[ ! -f "${FORMULA_PATH}" ]]; then
  echo "[archifind] Formula file not found at ${FORMULA_PATH}."
  exit 1
fi

if ! git ls-remote --tags "https://github.com/${REPO}.git" "refs/tags/${TAG}" | grep -q .; then
  echo "[archifind] Tag ${TAG} was not found on GitHub for ${REPO}."
  exit 1
fi

echo "[archifind] Downloading ${ARCHIVE_URL}"
curl -L --fail -o "${TMP_FILE}" "${ARCHIVE_URL}"

SHA256="$(shasum -a 256 "${TMP_FILE}" | awk '{print $1}')"

echo "[archifind] Updating ${FORMULA_PATH}"
TMP_FORMULA="${FORMULA_PATH}.tmp"
rm -f "${TMP_FORMULA}"

while IFS= read -r line; do
  case "${line}" in
    "  url "*)
      echo "  url \"${ARCHIVE_URL}\"" >> "${TMP_FORMULA}"
      ;;
    "  sha256 "*)
      echo "  sha256 \"${SHA256}\"" >> "${TMP_FORMULA}"
      ;;
    "  version "*)
      if [[ -n "${VERSION}" ]]; then
        echo "  version \"${VERSION}\"" >> "${TMP_FORMULA}"
      else
        echo "${line}" >> "${TMP_FORMULA}"
      fi
      ;;
    *)
      echo "${line}" >> "${TMP_FORMULA}"
      ;;
  esac
done < "${FORMULA_PATH}"

mv "${TMP_FORMULA}" "${FORMULA_PATH}"

echo "[archifind] Done"
echo "url \"${ARCHIVE_URL}\""
echo "sha256 \"${SHA256}\""
if [[ -n "${VERSION}" ]]; then
  echo "version \"${VERSION}\""
fi
