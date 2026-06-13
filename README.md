# Rental Management System

Modern rental management platform for Kenyan landlords, focused on one-property-first workflows with caretakers, tenants, rent charges, optional utilities, payment verification, maintenance, reports, and dashboards.

## Local Development

1. Create your environment file:

```bash
cp .env.example .env
```

2. Start the app:

```bash
docker compose up --build
```

3. Run migrations and seed roles:

```bash
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py seed_initial_data
```

4. Create an initial landlord account:

```bash
docker compose exec backend python manage.py seed_initial_data --email landlord@example.com --password CedarStone482 --role landlord --account-name "Main Property"
```

Frontend: `http://localhost:5173/`  
Backend API: `http://localhost:8000/api/v1/`  
Health check: `http://localhost:8000/health/`

## Frontend End-to-End Tests

Playwright covers the core landlord workflow: login, dashboard, property, unit, tenant, rent charge generation, partial payment, balance update, logout, and protected route redirects.

Seed the E2E landlord account, install the browser once, then run the tests:

```bash
docker compose exec backend python manage.py seed_initial_data --email e2e.landlord@example.com --password StrongPass123! --role landlord --account-name "E2E Account"
docker compose -f docker-compose.yml -f docker-compose.e2e.yml run --rm e2e npm run test:e2e
```

The E2E runner uses the official Microsoft Playwright image with Chromium already installed, mounts `./frontend` into `/workspace`, starts a test Vite server at `http://127.0.0.1:5174`, and points the frontend/API calls at `http://backend:8000/api/v1`.

For host-based runs, override `PLAYWRIGHT_BASE_URL`, `E2E_API_BASE_URL`, or `E2E_FRONTEND_API_BASE_URL` as needed.

Keep Chromium out of the lightweight frontend container. Use the dedicated E2E service above whenever you need browser tests.

## Production Checklist

Set these in production:

```text
DJANGO_SETTINGS_MODULE=config.settings.prod
DJANGO_DEBUG=False
DJANGO_SECRET_KEY=<strong-secret>
DJANGO_ALLOWED_HOSTS=your-api-domain.com
DJANGO_CORS_ALLOWED_ORIGINS=https://your-frontend-domain.com
DJANGO_CSRF_TRUSTED_ORIGINS=https://your-frontend-domain.com
VITE_API_BASE_URL=https://your-api-domain.com/api/v1
POSTGRES_DB=<db>
POSTGRES_USER=<user>
POSTGRES_PASSWORD=<strong-password>
ANON_THROTTLE_RATE=60/minute
USER_THROTTLE_RATE=1000/hour
```

Run production Docker:

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

The production backend runs migrations, collects static files, and serves Django with Gunicorn. The production frontend is built with Vite and served by Nginx.

Schedule monthly rent charge generation for the 2nd day of each month. The command is idempotent, so it will skip charges that already exist for that lease and month:

```bash
docker compose exec backend python manage.py generate_monthly_rent_charges
```

On Render, use a Cron Job with the same Django command. On a VPS, schedule it with cron for the 2nd of every month. Tenant-specific due dates still come from each lease billing day, for example the 5th, 8th, or 10th.

See [TESTING.md](TESTING.md) for the full test commands, Playwright setup, migration checks, deploy checks, and manual QA checklist.

## Render Test Deployment

The repository includes `render.yaml` for a free-tier test deployment:

- `teq-rentals-api`: Django API as a Docker web service.
- `teq-rentals`: React frontend as a Render static site.
- `teq-rentals-db`: Render PostgreSQL database for testing.

Deploy from Render:

1. Push the latest code to GitHub.
2. In Render, choose **New > Blueprint**.
3. Connect this repository.
4. Render will read `render.yaml` and create the services.
5. If Render changes the generated service URLs, update:
   - backend `DJANGO_ALLOWED_HOSTS`
   - backend `DJANGO_CORS_ALLOWED_ORIGINS`
   - backend `DJANGO_CSRF_TRUSTED_ORIGINS`
   - frontend `VITE_API_BASE_URL`

Expected free test URLs:

```text
Frontend: https://teq-rentals.onrender.com
Backend:  https://teq-rentals-api.onrender.com
API:      https://teq-rentals-api.onrender.com/api/v1
```

Render free PostgreSQL is for testing only. Before real users, move to a paid managed database or your VPS database with backups.

For free testing, generate rent charges manually from the app. For production, create a scheduled job that runs this command monthly:

```bash
python manage.py generate_monthly_rent_charges
```

## Backups

For VPS Docker deployments, schedule daily PostgreSQL backups:

```bash
docker compose exec db pg_dump -U rental_user rental_management > backup-$(date +%F).sql
```

On Render or managed PostgreSQL, enable automated daily backups from the provider dashboard.

## First Production Flow

1. Seed roles and first landlord.
2. Landlord logs in.
3. Landlord creates the main property.
4. Landlord creates units.
5. Landlord creates caretaker accounts and assigns them to the property.
6. Caretaker adds tenants and assigns leases.
7. First rent charge is generated when a lease is created.
8. Monthly rent charges are generated by the scheduled command, or manually from the Payments page when testing.
9. If utilities are charged separately, the landlord records water, electricity, garbage, security, service charge, or other utility charges from the Utilities page.
10. Caretaker submits payment claims/cash collections.
11. Landlord verifies payments from the dashboard or Verification page.

## Optional Landlord Features

Landlords can enable or disable modules from Settings. Utilities are enabled by default, but can be turned off when water, electricity, garbage, or other services are already included in rent.

## Important Security Notes

- Passwords are hashed; never store real user passwords manually.
- Use HTTPS in production.
- Keep `DEBUG=False` in production.
- Use strong database and Django secret keys.
- Keep `DJANGO_ALLOWED_HOSTS` and `DJANGO_CORS_ALLOWED_ORIGINS` limited to your real production domains.
- Keep API throttling enabled to slow brute-force login and scraping attempts.
- Keep daily backups.
- Deactivate sacked caretakers instead of deleting them so audit history remains intact.
