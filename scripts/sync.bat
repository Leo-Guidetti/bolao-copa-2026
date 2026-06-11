@echo off
REM Atualiza os placares da Copa via API-Football. Agende este .bat no Agendador de Tarefas.
cd /d "%~dp0.."
call npm run sync
