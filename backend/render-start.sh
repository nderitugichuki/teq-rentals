#!/bin/sh
set -e

python manage.py migrate
python manage.py collectstatic --noinput
gunicorn config.wsgi:application --bind "0.0.0.0:${PORT:-8000}" --workers "${WEB_CONCURRENCY:-2}" --timeout 60
