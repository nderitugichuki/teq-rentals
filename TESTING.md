# Testing and Production Readiness

This project uses Django tests for backend behavior and Playwright for browser E2E coverage.

## Backend Tests

Run the full Django suite:

```bash
docker compose exec backend python manage.py test --noinput
```

Check for missing migrations:

```bash
docker compose exec backend python manage.py makemigrations --check --dry-run
docker compose exec backend python manage.py migrate --check
```

Run Django deployment checks with production-like environment values:

```bash
docker compose exec \
  -e DJANGO_SECRET_KEY=replace-with-a-50-plus-character-random-secret-key \
  -e DJANGO_ALLOWED_HOSTS=api.example.com \
  -e DJANGO_CORS_ALLOWED_ORIGINS=https://app.example.com \
  -e DJANGO_CSRF_TRUSTED_ORIGINS=https://app.example.com \
  backend python manage.py check --deploy --settings=config.settings.prod
```

## Frontend Build

```bash
docker compose exec frontend npm run build
```

## Playwright E2E

Seed a dedicated landlord account:

```bash
docker compose exec backend python manage.py seed_initial_data --email e2e.landlord@example.com --password StrongPass123! --role landlord --account-name "E2E Account"
```

Preferred Docker E2E runner, using the official Microsoft Playwright image with Chromium preinstalled:

```bash
docker compose -f docker-compose.yml -f docker-compose.e2e.yml run --rm e2e npm run test:e2e
```

This mounts `./frontend` into the E2E container, installs frontend dependencies into the `e2e_node_modules` Docker volume, starts a test Vite server at `http://127.0.0.1:5174`, and uses `http://backend:8000/api/v1` for backend API access.

Keep Chromium out of the lightweight frontend container; the E2E service uses the official Microsoft Playwright image with Chromium already installed.

## Docker Commands

Development:

```bash
docker compose up --build
docker compose exec backend python manage.py migrate
```

Production-style:

```bash
docker compose -f docker-compose.prod.yml up --build -d
docker compose -f docker-compose.prod.yml ps
```

The production backend command runs migrations, collects static files, then starts Gunicorn.

Local production smoke test without colliding with development ports:

```bash
BACKEND_PORT=18000 FRONTEND_PORT=18080 docker compose -p rms-prod-smoke -f docker-compose.prod.yml up --build -d
```

## Deployment Checklist

- Set `DJANGO_DEBUG=False`.
- Use a 50+ character random `DJANGO_SECRET_KEY`.
- Set exact `DJANGO_ALLOWED_HOSTS`.
- Set exact HTTPS `DJANGO_CORS_ALLOWED_ORIGINS` and `DJANGO_CSRF_TRUSTED_ORIGINS`.
- Use strong PostgreSQL credentials.
- Set `VITE_API_BASE_URL` to the deployed API URL ending in `/api/v1`.
- Run migrations before exposing the app to users.
- Confirm `/health/` responds on the backend.
- Confirm frontend login works over HTTPS.
- Create landlord users through the seed command or an admin-only onboarding process.
- Schedule `python manage.py generate_monthly_rent_charges` for the 2nd day of every month.
- Keep backups enabled before real tenant/payment data is entered.

## Manual QA Before Real Users

- Browser E2E workflow once Chromium is available.
- Login and logout on desktop and mobile.
- Landlord creates property, unit, tenant, lease, rent charge, and partial payment.
- Caretaker submits payment claim, cash collection, and maintenance issue.
- Landlord verifies/rejects caretaker submissions.
- Tenant vacating flow marks the unit vacant and notifies the landlord.
- Reports totals match rent charges, payments, expenses, and utilities.
