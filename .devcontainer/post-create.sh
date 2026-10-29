#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

[ -f .env ] || cp .env.example .env

npm install
npm run migrate
