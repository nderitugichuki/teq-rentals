#!/bin/sh
set -e

python manage.py migrate
python manage.py collectstatic --noinput

if [ -n "$INITIAL_LANDLORD_EMAIL" ] && [ -n "$INITIAL_LANDLORD_PASSWORD" ]; then
  python manage.py seed_initial_data \
    --email "$INITIAL_LANDLORD_EMAIL" \
    --password "$INITIAL_LANDLORD_PASSWORD" \
    --role landlord \
    --account-name "${INITIAL_ACCOUNT_NAME:-Main Property}"
fi

gunicorn config.wsgi:application --bind "0.0.0.0:${PORT:-8000}" --workers "${WEB_CONCURRENCY:-2}" --timeout 60
