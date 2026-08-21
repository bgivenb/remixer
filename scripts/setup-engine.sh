#!/bin/bash
set -euo pipefail

install_root="${1:-${HOME}/Library/Application Support/Remixer/engine}"
script_root="$(cd "$(dirname "$0")" && pwd)"
worker_root="$(cd "${script_root}/../worker" && pwd)"
venv_path="${install_root}/.venv"
python_path="${venv_path}/bin/python"
tools_path="${install_root}/tools"
bundled_tools_dir="${REMIXER_BUNDLED_TOOLS_DIR:-}"

export PATH="${tools_path}:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

if [[ ! -d "${worker_root}" ]]; then
  echo "Worker sources were not found at ${worker_root}" >&2
  exit 1
fi

mkdir -p "${install_root}"
export UV_PYTHON_INSTALL_DIR="${install_root}/python"
export UV_PYTHON_INSTALL_BIN=0
export UV_CACHE_DIR="${install_root}/.uv-cache"

if [[ -n "${bundled_tools_dir}" && -x "${bundled_tools_dir}/uv" && -x "${bundled_tools_dir}/ffmpeg" && -x "${bundled_tools_dir}/ffprobe" && -x "${bundled_tools_dir}/realpath" ]]; then
  echo 'Installing Remixer private setup and audio tools...'
  mkdir -p "${tools_path}"
  install -m 755 "${bundled_tools_dir}/ffmpeg" "${tools_path}/ffmpeg"
  install -m 755 "${bundled_tools_dir}/ffprobe" "${tools_path}/ffprobe"
  install -m 755 "${bundled_tools_dir}/realpath" "${tools_path}/realpath"
  uv_path="${bundled_tools_dir}/uv"
else
  export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/local/sbin:/opt/local/bin:${PATH}"
  uv_path="$(command -v uv || true)"
  if [[ -z "${uv_path}" ]] || ! command -v ffmpeg >/dev/null 2>&1 || ! command -v ffprobe >/dev/null 2>&1; then
    echo 'The packaged setup tools are missing. Reinstall Remixer and try again.' >&2
    exit 1
  fi
  echo 'Using developer-provided setup tools...'
fi

echo 'Downloading the private Python 3.11 runtime...'
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
