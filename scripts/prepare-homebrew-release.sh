#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <tag>"
  echo "Example: $0 v1.0.1"
  exit 1
fi

TAG="$1"
REPO="Mensa-Philosophical-Circle/archifind"
ARCHIVE_URL="https://github.com/${REPO}/archive/refs/tags/${TAG}.tar.gz"
TMP_FILE="/tmp/archifind-${TAG}.tar.gz"

if ! git ls-remote --tags "https://github.com/${REPO}.git" "refs/tags/${TAG}" | grep -q .; then
  echo "[archifind] Tag ${TAG} was not found on GitHub."
  echo "[archifind] Create and push the tag first, then rerun this script."
  echo "[archifind] Example:"
  echo "  git tag ${TAG}"
  echo "  git push origin ${TAG}"
  exit 1
fi

echo "[archifind] Downloading ${ARCHIVE_URL}"
curl -L --fail -o "${TMP_FILE}" "${ARCHIVE_URL}"

echo "[archifind] SHA256"
SHA256="$(shasum -a 256 "${TMP_FILE}" | awk '{print $1}')"
echo "${SHA256}"

echo ""
echo "[archifind] Formula fields"
echo "url \"${ARCHIVE_URL}\""
echo "sha256 \"${SHA256}\""
echo "version \"${TAG#v}\""
