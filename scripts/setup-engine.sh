#!/bin/bash
set -euo pipefail

install_root="${1:-${HOME}/Library/Application Support/Remixer/engine}"
script_root="$(cd "$(dirname "$0")" && pwd)"
worker_root="$(cd "${script_root}/../worker" && pwd)"
venv_path="${install_root}/.venv"
python_path="${venv_path}/bin/python"

export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/local/sbin:/opt/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

if [[ ! -d "${worker_root}" ]]; then
  echo "Worker sources were not found at ${worker_root}" >&2
  exit 1
fi

uv_path="$(command -v uv || true)"
if [[ -z "${uv_path}" ]]; then
  echo "uv is required. Install it with 'brew install uv', then try again." >&2
  exit 1
fi
if ! command -v ffmpeg >/dev/null 2>&1 || ! command -v ffprobe >/dev/null 2>&1; then
  echo "FFmpeg and FFprobe are required. Install them with 'brew install ffmpeg', then try again." >&2
  exit 1
fi

mkdir -p "${install_root}"

echo 'Installing the managed arm64 Python 3.11 runtime...'
"${uv_path}" python install 3.11

if [[ ! -x "${python_path}" ]]; then
  echo 'Creating the Remixer virtual environment...'
  "${uv_path}" venv "${venv_path}" --python 3.11 --managed-python
fi

echo 'Installing the pinned macOS compute runtime...'
if [[ "$(uname -m)" == 'arm64' ]]; then
  "${uv_path}" pip install --python "${python_path}" --requirements "${worker_root}/requirements-macos.txt"
else
  "${uv_path}" pip install --python "${python_path}" 'torch==2.11.0'
fi

echo 'Installing audio download and analysis packages...'
"${uv_path}" pip install --python "${python_path}" --requirements "${worker_root}/requirements-core.txt"

echo 'Installing the pinned BS-RoFormer inference engine...'
"${uv_path}" pip install --python "${python_path}" --requirements "${worker_root}/requirements-engine.txt"

echo 'Verifying the engine and available Mac compute backends...'
PYTHONPATH="${worker_root}" REMIXER_DATA_DIR="${install_root}/../data" \
  "${python_path}" -c 'import json; from remixer_worker.health import health; result = health(); print(json.dumps(result, indent=2)); raise SystemExit(0 if result["ready"] else 1)'

echo 'Downloading and verifying the core six-stem model (~700 MB)...'
PYTHONPATH="${worker_root}" REMIXER_DATA_DIR="${install_root}/../data" REMIXER_MODELS_DIR="${install_root}/../models" \
  "${python_path}" -c 'from remixer_worker.separation import prepare_model; prepare_model("full", lambda stage, progress, message: print(message, flush=True))'

echo 'Remixer audio engine and core model are ready.'
