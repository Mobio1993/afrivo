@echo off
:: Lance le serveur Django depuis la racine du projet
cd /d "%~dp0.."
call .venv\Scripts\activate.bat
cd backend
python manage.py runserver
