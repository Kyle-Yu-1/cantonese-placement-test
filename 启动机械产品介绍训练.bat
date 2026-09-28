@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "NODE=C:\Users\19461\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not exist "%NODE%" set "NODE=node"
echo ??????????????????
start "" http://127.0.0.1:8123/pitch-training.html
"%NODE%" tools\serve.js
pause
