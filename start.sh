#!/usr/bin/env bash
# اجرای برنامه مدیریت سوراخ‌های DTF روی یک سرور محلی
cd "$(dirname "$0")"
PORT=8420

open_browser() {
  sleep 1
  if command -v xdg-open >/dev/null; then xdg-open "http://localhost:$PORT/index.html";
  elif command -v open >/dev/null; then open "http://localhost:$PORT/index.html";
  fi
}

if command -v python3 >/dev/null; then
  open_browser &
  python3 -m http.server "$PORT"
elif command -v python >/dev/null; then
  open_browser &
  python -m http.server "$PORT"
else
  echo "پایتون روی این سیستم نصب نیست. لطفاً ابتدا Python 3 را نصب کنید."
  exit 1
fi
