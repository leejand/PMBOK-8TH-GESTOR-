@echo off
rem ============================================================
rem  postgres.cmd - Arranca, detiene o consulta PostgreSQL local
rem  Uso: scripts\postgres.cmd [iniciar^|detener^|estado]
rem  Carpeta por defecto: %USERPROFILE%\pgsql  (cambiala con PGROOT)
rem ============================================================
setlocal
if "%PGROOT%"=="" set "PGROOT=%USERPROFILE%\pgsql"
set "PGCTL=%PGROOT%\bin\pg_ctl.exe"
set "PGDATA=%PGROOT%\data"
if not exist "%PGCTL%" (
  echo No se encuentra %PGCTL%. Ajusta la variable PGROOT.
  exit /b 1
)
set "ACCION=%~1"
if "%ACCION%"=="" set "ACCION=iniciar"
if /i "%ACCION%"=="estado" (
  "%PGCTL%" -D "%PGDATA%" status
  exit /b
)
if /i "%ACCION%"=="detener" (
  "%PGCTL%" -D "%PGDATA%" -m fast -w stop
  exit /b
)
"%PGCTL%" -D "%PGDATA%" status >nul 2>&1
if not errorlevel 1 (
  echo PostgreSQL ya esta en marcha.
  exit /b 0
)
"%PGCTL%" -D "%PGDATA%" -l "%PGROOT%\servidor.log" -w start
