#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

if ! command -v python3 >/dev/null 2>&1; then
  echo "没有找到 Python 3。"
  exit 1
fi
if ! command -v ssh >/dev/null 2>&1; then
  echo "没有找到 ssh，无法建立公网隧道。"
  exit 1
fi

if curl -sS --max-time 3 http://127.0.0.1:8000/api/status >/dev/null 2>&1; then
  echo "本地服务已在运行。"
else
  echo "正在启动本地服务…"
  if systemctl --user cat xiyou-youwen.service >/dev/null 2>&1; then
    systemctl --user start xiyou-youwen.service >/dev/null 2>&1 || true
  elif ! ss -ltn 2>/dev/null | grep -q ':8000 '; then
    nohup python3 server.py > server.log 2>&1 &
    echo $! > server.pid
  fi
  for _ in $(seq 1 30); do
    if curl -sS --max-time 2 http://127.0.0.1:8000/api/status >/dev/null 2>&1; then
      break
    fi
    sleep 0.4
  done
fi

if ! curl -sS --max-time 5 http://127.0.0.1:8000/api/status >/dev/null 2>&1; then
  echo "本地服务没有在 8000 端口响应。请检查 systemctl --user status xiyou-youwen，或运行 bash start.sh。"
  exit 1
fi

resolve_pinggy_ip() {
  ip=$(curl -sS --max-time 10 \
    -H 'accept: application/dns-json' \
    'https://cloudflare-dns.com/dns-query?name=a.pinggy.io&type=A' 2>/dev/null \
    | python3 -c 'import json,sys; d=json.load(sys.stdin); print(next((a.get("data","") for a in d.get("Answer",[]) if a.get("type")==1), ""))' 2>/dev/null || true)
  case "$ip" in
    10.*|127.*|192.168.*|198.18.*|"") ip="172.235.48.89" ;;
  esac
  echo "$ip"
}

start_tunnel() {
  local port="$1"
  local log="$2"
  local pidfile="$3"
  TUNNEL_URL=""
  if [ -f "$pidfile" ] && kill -0 "$(cat "$pidfile")" 2>/dev/null; then
    TUNNEL_URL=$(grep -oE 'https://[a-z0-9.-]+\.(run\.pinggy-free\.link|free\.pinggy\.net)' "$log" 2>/dev/null | head -1 || true)
    if [ -n "$TUNNEL_URL" ]; then
      echo "隧道已在运行：$port"
      return
    fi
  fi
  rm -f "$log"
  nohup ssh -T -p 443 \
    -o StrictHostKeyChecking=no \
    -o UserKnownHostsFile=/dev/null \
    -o ServerAliveInterval=20 \
    -o ServerAliveCountMax=3 \
    -o ExitOnForwardFailure=yes \
    -o ConnectTimeout=12 \
    -o LogLevel=ERROR \
    -R0:localhost:"$port" "$ssh_ip" > "$log" 2>&1 &
  echo $! > "$pidfile"
  for _ in $(seq 1 30); do
    TUNNEL_URL=$(grep -oE 'https://[a-z0-9.-]+\.(run\.pinggy-free\.link|free\.pinggy\.net)' "$log" 2>/dev/null | head -1 || true)
    if [ -n "$TUNNEL_URL" ]; then
      return
    fi
    sleep 1
  done
  echo "端口 $port 的公网隧道没有建立成功，请查看 $log。"
  return 1
}

ssh_ip=$(resolve_pinggy_ip)
echo "正在建立或检查公网隧道（直连 $ssh_ip）…"
start_tunnel 8000 pinggy.log pinggy.pid
student_url="$TUNNEL_URL"
student_backup=$(grep -oE 'https://[a-z0-9.-]+\.(run\.pinggy-free\.link|free\.pinggy\.net)' pinggy.log 2>/dev/null | sed -n '2p' || true)
start_tunnel 8001 pinggy-admin.log pinggy-admin.pid
admin_url="$TUNNEL_URL"
admin_backup=$(grep -oE 'https://[a-z0-9.-]+\.(run\.pinggy-free\.link|free\.pinggy\.net)' pinggy-admin.log 2>/dev/null | sed -n '2p' || true)

admin_port=$(grep -E '^ADMIN_PORT=' .env 2>/dev/null | tail -1 | cut -d= -f2 | tr -d ' ' || true)
if [ -z "$admin_port" ]; then
  admin_port=8001
fi

echo ""
echo "=============================================="
echo "  学生端（公网）：$student_url/"
if [ -n "$student_backup" ]; then
  echo "  学生设备用：  $student_backup/"
fi
echo "  管理端（公网）：$admin_url/admin"
if [ -n "$admin_backup" ]; then
  echo "  管理端备用：  $admin_backup/admin"
fi
echo "  本机学生端：  http://127.0.0.1:8000/"
echo "  本机管理端：  http://127.0.0.1:$admin_port/admin"
echo "=============================================="
echo "  公网学生端和公网管理端使用 60 分钟免费隧道，到期后重新运行本脚本。"
echo "  第一次打开若出现英文 Caution 页面，点红色 Enter site 即可进入。"
echo "  管理端公网地址只发给维护者，必须输入管理密钥；学生不要转发。"
echo "  登录失败 8 次会锁定 5 分钟；请保持电脑开机，不要关闭 SSH 进程。"
echo ""