#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
if ! command -v python3 >/dev/null 2>&1; then
  echo "没有找到 Python 3，请先安装 Python 3 后再运行。"
  exit 1
fi
python3 server.py