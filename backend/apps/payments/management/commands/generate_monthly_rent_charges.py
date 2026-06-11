from datetime import date

from django.core.management.base import BaseCommand

from apps.payments.services import generate_rent_charges_for_month


class Command(BaseCommand):
    help = "Generate monthly rent charges for active leases."

    def add_arguments(self, parser):
        parser.add_argument("--year", type=int)
        parser.add_argument("--month", type=int)

    def handle(self, *args, **options):
        today = date.today()
        target_month = date(options["year"] or today.year, options["month"] or today.month, 1)
        created = generate_rent_charges_for_month(target_month)
        self.stdout.write(self.style.SUCCESS(f"Created {len(created)} rent charge(s) for {target_month:%B %Y}."))
