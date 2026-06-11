from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import Account, Role
from apps.leases.models import Lease
from apps.maintenance.models import MaintenanceRequest
from apps.notifications.models import Notification
from apps.expenses.models import Expense
from apps.payments.models import CashCollection, Payment, PaymentClaim, RentCharge, UtilityCharge
from apps.payments.services import generate_rent_charges_for_month
from apps.properties.models import Property, Unit
from apps.tenants.models import Tenant

User = get_user_model()


class AuthenticationCrudAndApiTests(APITestCase):
    def setUp(self):
        self.landlord_role, _ = Role.objects.get_or_create(name=Role.Names.LANDLORD)
        self.caretaker_role, _ = Role.objects.get_or_create(name=Role.Names.CARETAKER)
        self.landlord, self.account = self.create_landlord("api-owner@example.com", "API Owner Account")
        self.other_landlord, self.other_account = self.create_landlord("api-other@example.com", "API Other Account")
        self.caretaker = User.objects.create_user(
            email="api-caretaker@example.com",
            password="StrongPass123!",
            account=self.account,
            role=self.caretaker_role,
        )
        self.property = self.create_property(self.landlord, self.account, "API HEIGHTS")
        self.property.caretakers.add(self.caretaker)
        self.unit = self.create_unit(self.property, "A1", "7500.00")
        self.tenant = self.create_tenant(self.account, self.landlord, "0700000001", "API", "TENANT")
        self.lease = Lease.objects.create(
            account=self.account,
            tenant=self.tenant,
            unit=self.unit,
            start_date=date(2026, 1, 1),
            rent_amount=Decimal("7500.00"),
            deposit_amount=Decimal("7500.00"),
            billing_day=5,
            created_by=self.landlord,
        )
        self.other_property = self.create_property(self.other_landlord, self.other_account, "OTHER API HEIGHTS")
        self.other_unit = self.create_unit(self.other_property, "B1", "8500.00")
        self.other_tenant = self.create_tenant(self.other_account, self.other_landlord, "0700000002", "OTHER", "TENANT")
        self.other_lease = Lease.objects.create(
            account=self.other_account,
            tenant=self.other_tenant,
            unit=self.other_unit,
            start_date=date(2026, 1, 1),
            rent_amount=Decimal("8500.00"),
            deposit_amount=Decimal("8500.00"),
            billing_day=5,
            created_by=self.other_landlord,
        )

    def create_landlord(self, email, account_name):
        user = User.objects.create_user(email=email, password="StrongPass123!", role=self.landlord_role)
        account = Account.objects.create(name=account_name, owner=user)
        user.account = account
        user.save(update_fields=["account"])
        return user, account

    def create_property(self, landlord, account, name):
        return Property.objects.create(
            landlord=landlord,
            account=account,
            name=name,
            property_type=Property.PropertyType.APARTMENT,
            address=name,
            county="",
            town="NAIROBI",
        )

    def create_unit(self, property_obj, unit_number, rent):
        return Unit.objects.create(
            property=property_obj,
            unit_number=unit_number,
            unit_type=Unit.UnitType.ONE_BEDROOM,
            rent_amount=Decimal(rent),
            deposit_amount=Decimal(rent),
        )

    def create_tenant(self, account, created_by, phone, first_name, last_name):
        return Tenant.objects.create(
            account=account,
            created_by=created_by,
            first_name=first_name,
            last_name=last_name,
            phone_number=phone,
            emergency_contact_name="KIN",
            emergency_contact_phone=f"{phone}9",
            move_in_date=date(2026, 1, 1),
        )

    def test_jwt_login_refresh_and_current_user_flow(self):
        login_response = self.client.post(
            "/api/v1/auth/token/",
            {"email": "api-owner@example.com", "password": "StrongPass123!"},
            format="json",
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        self.assertIn("access", login_response.data)
        self.assertIn("refresh", login_response.data)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")
        me_response = self.client.get("/api/v1/auth/me/")
        self.assertEqual(me_response.status_code, status.HTTP_200_OK)
        self.assertEqual(me_response.data["email"], "api-owner@example.com")
        self.assertEqual(me_response.data["role_name"], Role.Names.LANDLORD)
        self.assertEqual(me_response.data["account"], self.account.id)
        self.assertTrue(me_response.data["account_features"]["maintenance"])

        refresh_response = self.client.post(
            "/api/v1/auth/token/refresh/",
            {"refresh": login_response.data["refresh"]},
            format="json",
        )
        self.assertEqual(refresh_response.status_code, status.HTTP_200_OK)
        self.assertIn("access", refresh_response.data)

    def test_invalid_jwt_credentials_and_unauthenticated_business_api_are_rejected(self):
        bad_login = self.client.post(
            "/api/v1/auth/token/",
            {"email": "api-owner@example.com", "password": "wrong-password"},
            format="json",
        )
        self.assertEqual(bad_login.status_code, status.HTTP_401_UNAUTHORIZED)

        tenants_response = self.client.get("/api/v1/tenants/")
        self.assertEqual(tenants_response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(Tenant.objects.count(), 2)

    def test_landlord_tenant_crud_stays_inside_account(self):
        self.client.force_authenticate(self.landlord)
        create_response = self.client.post(
            "/api/v1/tenants/",
            {
                "first_name": "MARY",
                "last_name": "WAMBUI",
                "phone_number": "0700000003",
                "emergency_contact_name": "KIN",
                "emergency_contact_phone": "07000000039",
                "move_in_date": "2026-02-01",
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        tenant_id = create_response.data["id"]
        created_tenant = Tenant.objects.get(pk=tenant_id)
        self.assertEqual(created_tenant.account_id, self.account.id)
        self.assertEqual(created_tenant.created_by_id, self.landlord.id)
        self.assertEqual(created_tenant.status, Tenant.Status.ACTIVE)

        detail_response = self.client.get(f"/api/v1/tenants/{tenant_id}/")
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_response.data["account"], self.account.id)

        update_response = self.client.patch(
            f"/api/v1/tenants/{tenant_id}/",
            {"emergency_contact_name": "UPDATED KIN"},
            format="json",
        )
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assertEqual(update_response.data["emergency_contact_name"], "UPDATED KIN")
        created_tenant.refresh_from_db()
        self.assertEqual(created_tenant.emergency_contact_name, "UPDATED KIN")

        other_detail = self.client.get(f"/api/v1/tenants/{self.other_tenant.id}/")
        self.assertEqual(other_detail.status_code, status.HTTP_404_NOT_FOUND)

        blocked_update = self.client.patch(
            f"/api/v1/tenants/{self.other_tenant.id}/",
            {"emergency_contact_name": "LEAKED UPDATE"},
            format="json",
        )
        self.assertEqual(blocked_update.status_code, status.HTTP_404_NOT_FOUND)
        self.other_tenant.refresh_from_db()
        self.assertNotEqual(self.other_tenant.emergency_contact_name, "LEAKED UPDATE")

    def test_property_and_unit_management_permissions(self):
        self.client.force_authenticate(self.landlord)
        property_response = self.client.post(
            "/api/v1/properties/",
            {
                "name": "SECOND API COURT",
                "property_type": Property.PropertyType.APARTMENT,
                "town": "NAIROBI",
                "caretakers": [self.caretaker.id],
            },
            format="json",
        )
        self.assertEqual(property_response.status_code, status.HTTP_201_CREATED)
        created_property = Property.objects.get(pk=property_response.data["id"])
        self.assertEqual(created_property.account_id, self.account.id)
        self.assertEqual(created_property.landlord_id, self.landlord.id)
        self.assertTrue(created_property.caretakers.filter(id=self.caretaker.id).exists())

        unit_response = self.client.post(
            "/api/v1/units/",
            {
                "property": property_response.data["id"],
                "unit_number": "C1",
                "unit_type": Unit.UnitType.TWO_BEDROOM,
                "floor": "1",
                "rent_amount": "12000.00",
                "deposit_amount": "12000.00",
                "status": Unit.Status.VACANT,
            },
            format="json",
        )
        self.assertEqual(unit_response.status_code, status.HTTP_201_CREATED)
        created_unit = Unit.objects.get(pk=unit_response.data["id"])
        self.assertEqual(created_unit.property_id, created_property.id)
        self.assertEqual(created_unit.rent_amount, Decimal("12000.00"))

        self.client.force_authenticate(self.caretaker)
        unit_count_before = Unit.objects.count()
        blocked_unit = self.client.post(
            "/api/v1/units/",
            {
                "property": self.property.id,
                "unit_number": "C2",
                "unit_type": Unit.UnitType.ONE_BEDROOM,
                "rent_amount": "9000.00",
                "deposit_amount": "9000.00",
                "status": Unit.Status.VACANT,
            },
            format="json",
        )
        self.assertEqual(blocked_unit.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(Unit.objects.count(), unit_count_before)

    def test_rent_charge_generation_endpoint_creates_monthly_bills_once(self):
        self.client.force_authenticate(self.landlord)
        billing_month = timezone.localdate().replace(day=1)
        before_count = RentCharge.objects.filter(account=self.account, billing_month=billing_month).count()
        first_response = self.client.post("/api/v1/rent-charges/generate_current_month/")
        self.assertEqual(first_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(first_response.data["created"], 1 if before_count == 0 else 0)
        self.assertEqual(RentCharge.objects.filter(account=self.account, lease=self.lease, billing_month=billing_month).count(), 1)
        charge = RentCharge.objects.get(account=self.account, lease=self.lease, billing_month=billing_month)
        self.assertEqual(charge.amount, self.lease.rent_amount)
        self.assertEqual(charge.balance, self.lease.rent_amount)

        second_response = self.client.post("/api/v1/rent-charges/generate_current_month/")
        self.assertEqual(second_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second_response.data["created"], 0)

        charge_count = RentCharge.objects.filter(account=self.account, lease=self.lease, billing_month=billing_month).count()
        self.assertEqual(charge_count, 1)

    def test_payment_processing_partial_duplicate_and_cross_account_protection(self):
        charge = RentCharge.objects.get(lease=self.lease, billing_month=date(2026, 1, 1))
        self.client.force_authenticate(self.landlord)
        partial_response = self.client.post(
            "/api/v1/payments/",
            {
                "tenant": self.tenant.id,
                "lease": self.lease.id,
                "rent_charge": charge.id,
                "amount": "2500.00",
                "payment_method": Payment.Method.MPESA,
                "reference_number": "API-PAY-001",
                "payment_date": "2026-01-06",
            },
            format="json",
        )
        self.assertEqual(partial_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Payment.objects.filter(account=self.account, reference_number="API-PAY-001").count(), 1)
        self.assertTrue(Notification.objects.filter(account=self.account, user=self.landlord, tenant=self.tenant, title="Payment received").exists())
        charge.refresh_from_db()
        self.assertEqual(charge.amount_paid, Decimal("2500.00"))
        self.assertEqual(charge.balance, Decimal("5000.00"))
        self.assertEqual(charge.status, RentCharge.Status.PARTIAL)

        duplicate_response = self.client.post(
            "/api/v1/payments/",
            {
                "tenant": self.tenant.id,
                "lease": self.lease.id,
                "rent_charge": charge.id,
                "amount": "1000.00",
                "payment_method": Payment.Method.MPESA,
                "reference_number": "api-pay-001",
                "payment_date": "2026-01-07",
            },
            format="json",
        )
        self.assertEqual(duplicate_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("reference_number", duplicate_response.data)
        self.assertEqual(Payment.objects.filter(account=self.account).count(), 1)

        cross_account_response = self.client.post(
            "/api/v1/payments/",
            {
                "tenant": self.other_tenant.id,
                "lease": self.other_lease.id,
                "amount": "8500.00",
                "payment_method": Payment.Method.MPESA,
                "reference_number": "API-CROSS-PAY",
                "payment_date": "2026-01-08",
            },
            format="json",
        )
        self.assertEqual(cross_account_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(Payment.objects.filter(reference_number="API-CROSS-PAY").exists())

    def test_key_api_endpoints_are_authenticated_and_account_scoped(self):
        self.client.force_authenticate(self.landlord)
        endpoints = [
            "/api/v1/accounts/",
            "/api/v1/properties/",
            "/api/v1/units/",
            "/api/v1/tenants/",
            "/api/v1/leases/",
            "/api/v1/rent-charges/",
            "/api/v1/payments/",
            "/api/v1/payment-claims/",
            "/api/v1/cash-collections/",
            "/api/v1/maintenance-requests/",
            "/api/v1/notifications/",
            "/api/v1/reports/rent-collection/",
            "/api/v1/reports/occupancy/",
            "/api/v1/reports/aged-receivables/",
        ]
        for endpoint in endpoints:
            response = self.client.get(endpoint)
            self.assertEqual(response.status_code, status.HTTP_200_OK, endpoint)

        forbidden_property = self.client.get(f"/api/v1/properties/{self.other_property.id}/")
        self.assertEqual(forbidden_property.status_code, status.HTTP_404_NOT_FOUND)

        tenant_ids = {row["id"] for row in self.client.get("/api/v1/tenants/").data["results"]}
        self.assertIn(self.tenant.id, tenant_ids)
        self.assertNotIn(self.other_tenant.id, tenant_ids)

        property_ids = {row["id"] for row in self.client.get("/api/v1/properties/").data["results"]}
        self.assertIn(self.property.id, property_ids)
        self.assertNotIn(self.other_property.id, property_ids)

    def test_caretaker_cannot_create_lease_for_unassigned_unit_or_view_landlord_payments(self):
        self.client.force_authenticate(self.caretaker)
        unassigned_tenant = self.create_tenant(self.account, self.landlord, "0700000004", "UNASSIGNED", "TENANT")
        blocked_lease = self.client.post(
            "/api/v1/leases/",
            {
                "tenant": unassigned_tenant.id,
                "unit": self.other_unit.id,
                "start_date": "2026-02-01",
                "rent_amount": "8500.00",
                "deposit_amount": "8500.00",
                "billing_day": 5,
                "grace_period_days": 0,
                "late_fee_type": "none",
                "late_fee_value": "0.00",
            },
            format="json",
        )
        self.assertEqual(blocked_lease.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(Lease.objects.filter(tenant=unassigned_tenant, unit=self.other_unit).exists())

        Payment.objects.create(
            tenant=self.tenant,
            lease=self.lease,
            rent_charge=RentCharge.objects.get(lease=self.lease, billing_month=date(2026, 1, 1)),
            amount=Decimal("1000.00"),
            payment_method=Payment.Method.CASH,
            reference_number="LANDLORD-ONLY-PAYMENT",
            payment_date=date(2026, 1, 9),
            received_by=self.landlord,
        )
        payments_response = self.client.get("/api/v1/payments/")
        self.assertEqual(payments_response.status_code, status.HTTP_200_OK)
        self.assertEqual(payments_response.data["results"], [])

    def test_lease_move_in_total_includes_required_onboarding_deposit(self):
        self.client.force_authenticate(self.landlord)
        new_tenant = self.create_tenant(self.account, self.landlord, "0700000005", "MOVEIN", "TENANT")
        new_unit = self.create_unit(self.property, "MOVEIN-1", "12000.00")

        move_in_response = self.client.post(
            "/api/v1/leases/",
            {
                "tenant": new_tenant.id,
                "unit": new_unit.id,
                "start_date": "2026-02-01",
                "rent_amount": "12000.00",
                "deposit_amount": "12000.00",
                "deposit_required": True,
                "billing_day": 5,
                "grace_period_days": 0,
                "late_fee_type": "none",
                "late_fee_value": "0.00",
            },
            format="json",
        )
        self.assertEqual(move_in_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(move_in_response.data["move_in_total"], "24000.00")
        self.assertTrue(move_in_response.data["deposit_required"])

    def test_tenant_transfer_closes_old_lease_and_occupies_new_unit(self):
        self.client.force_authenticate(self.landlord)
        new_unit = self.create_unit(self.property, "TRANSFER-20", "9000.00")

        response = self.client.post(
            f"/api/v1/tenants/{self.tenant.id}/transfer/",
            {
                "new_unit": new_unit.id,
                "transfer_date": "2026-03-01",
                "deposit_handling": "carry_forward",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.lease.refresh_from_db()
        self.unit.refresh_from_db()
        new_unit.refresh_from_db()
        new_lease = Lease.objects.get(id=response.data["id"])

        self.assertEqual(self.lease.status, Lease.Status.TERMINATED)
        self.assertEqual(self.lease.end_date, date(2026, 3, 1))
        self.assertEqual(self.unit.status, Unit.Status.VACANT)
        self.assertEqual(new_unit.status, Unit.Status.OCCUPIED)
        self.assertEqual(new_lease.tenant_id, self.tenant.id)
        self.assertEqual(new_lease.status, Lease.Status.ACTIVE)
        self.assertFalse(new_lease.deposit_required)
        self.assertEqual(response.data["move_in_total"], "9000.00")
        self.assertTrue(Notification.objects.filter(user=self.landlord, title="Tenant transferred", tenant=self.tenant).exists())

    def test_advance_payment_credit_applies_to_future_generated_charges(self):
        january_charge = RentCharge.objects.get(lease=self.lease, billing_month=date(2026, 1, 1))
        Payment.objects.create(
            tenant=self.tenant,
            lease=self.lease,
            rent_charge=january_charge,
            amount=(january_charge.amount * Decimal("3.00")).quantize(Decimal("0.01")),
            payment_method=Payment.Method.MPESA,
            reference_number="TXN-ADVANCE-FUTURE",
            payment_date=date(2026, 1, 10),
            received_by=self.landlord,
        )

        january_charge.refresh_from_db()
        self.assertEqual(january_charge.balance, -january_charge.amount * Decimal("2.00"))

        generate_rent_charges_for_month(date(2026, 2, 1))
        february_charge = RentCharge.objects.get(lease=self.lease, billing_month=date(2026, 2, 1))
        january_charge.refresh_from_db()
        self.assertEqual(february_charge.balance, Decimal("0.00"))
        self.assertEqual(january_charge.balance, -january_charge.amount)

        generate_rent_charges_for_month(date(2026, 3, 1))
        march_charge = RentCharge.objects.get(lease=self.lease, billing_month=date(2026, 3, 1))
        january_charge.refresh_from_db()
        self.assertEqual(march_charge.balance, Decimal("0.00"))
        self.assertEqual(january_charge.balance, Decimal("0.00"))

    def test_caretaker_cannot_transfer_tenant_to_unassigned_property(self):
        self.client.force_authenticate(self.caretaker)
        response = self.client.post(
            f"/api/v1/tenants/{self.tenant.id}/transfer/",
            {
                "new_unit": self.other_unit.id,
                "transfer_date": "2026-03-01",
                "deposit_handling": "carry_forward",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class RentalWorkflowTests(APITestCase):
    def setUp(self):
        self.landlord_role, _ = Role.objects.get_or_create(name=Role.Names.LANDLORD)
        self.caretaker_role, _ = Role.objects.get_or_create(name=Role.Names.CARETAKER)
        self.landlord, self.account = self.create_landlord("owner@example.com", "Owner Account")
        self.other_landlord, self.other_account = self.create_landlord("other@example.com", "Other Account")
        self.caretaker = User.objects.create_user(
            email="caretaker@example.com",
            password="StrongPass123!",
            account=self.account,
            role=self.caretaker_role,
        )
        self.property = self.create_property(self.landlord, self.account, "GREEN HEIGHTS")
        self.property.caretakers.add(self.caretaker)
        self.unit = self.create_unit(self.property, "A1", "6000.00")
        self.tenant = self.create_tenant(self.account, self.landlord, "0711000001", "JOHN", "MWANGI")
        self.lease = Lease.objects.create(
            account=self.account,
            tenant=self.tenant,
            unit=self.unit,
            start_date=date(2026, 1, 1),
            rent_amount=Decimal("6000.00"),
            deposit_amount=Decimal("6000.00"),
            billing_day=5,
            created_by=self.landlord,
        )

        self.other_property = self.create_property(self.other_landlord, self.other_account, "OTHER HEIGHTS")
        self.other_unit = self.create_unit(self.other_property, "B1", "9000.00")
        self.other_tenant = self.create_tenant(self.other_account, self.other_landlord, "0711000002", "JANE", "WAMBUI")
        self.other_lease = Lease.objects.create(
            account=self.other_account,
            tenant=self.other_tenant,
            unit=self.other_unit,
            start_date=date(2026, 1, 1),
            rent_amount=Decimal("9000.00"),
            deposit_amount=Decimal("9000.00"),
            billing_day=5,
            created_by=self.other_landlord,
        )

    def create_landlord(self, email, account_name):
        user = User.objects.create_user(email=email, password="StrongPass123!", role=self.landlord_role)
        account = Account.objects.create(name=account_name, owner=user)
        user.account = account
        user.save(update_fields=["account"])
        return user, account

    def create_property(self, landlord, account, name):
        return Property.objects.create(
            landlord=landlord,
            account=account,
            name=name,
            property_type=Property.PropertyType.APARTMENT,
            address=name,
            county="",
            town="NAIROBI",
        )

    def create_unit(self, property_obj, unit_number, rent):
        return Unit.objects.create(
            property=property_obj,
            unit_number=unit_number,
            unit_type=Unit.UnitType.ONE_BEDROOM,
            rent_amount=Decimal(rent),
            deposit_amount=Decimal(rent),
        )

    def create_tenant(self, account, created_by, phone, first_name, last_name):
        return Tenant.objects.create(
            account=account,
            created_by=created_by,
            first_name=first_name,
            last_name=last_name,
            phone_number=phone,
            emergency_contact_name="KIN",
            emergency_contact_phone=f"{phone}9",
            move_in_date=date(2026, 1, 1),
        )

    def test_monthly_rent_charge_generation_is_unique_and_multi_month_payment_allocates(self):
        january_charge = RentCharge.objects.get(lease=self.lease, billing_month=date(2026, 1, 1))

        self.assertEqual(generate_rent_charges_for_month(date(2026, 1, 15)), [])
        february_created = generate_rent_charges_for_month(date(2026, 2, 1))
        self.assertEqual(len(february_created), 2)
        self.assertEqual(
            RentCharge.objects.filter(lease=self.lease, billing_month=date(2026, 2, 1)).count(),
            1,
        )

        Payment.objects.create(
            tenant=self.tenant,
            lease=self.lease,
            rent_charge=january_charge,
            amount=Decimal("8000.00"),
            payment_method=Payment.Method.MPESA,
            reference_number="TXN-PARTIAL-MULTI",
            payment_date=date(2026, 1, 10),
            received_by=self.landlord,
        )

        january_charge.refresh_from_db()
        february_charge = RentCharge.objects.get(lease=self.lease, billing_month=date(2026, 2, 1))
        self.assertEqual(january_charge.amount_paid, Decimal("6000.00"))
        self.assertEqual(january_charge.balance, Decimal("0.00"))
        self.assertEqual(january_charge.status, RentCharge.Status.PAID)
        self.assertEqual(february_charge.amount_paid, Decimal("2000.00"))
        self.assertEqual(february_charge.balance, Decimal("4000.00"))
        self.assertEqual(february_charge.status, RentCharge.Status.PARTIAL)

    def test_landlord_cannot_record_payment_against_another_account_lease(self):
        self.client.force_authenticate(self.landlord)
        response = self.client.post(
            "/api/v1/payments/",
            {
                "tenant": self.other_tenant.id,
                "lease": self.other_lease.id,
                "rent_charge": RentCharge.objects.get(lease=self.other_lease, billing_month=date(2026, 1, 1)).id,
                "amount": "9000.00",
                "payment_method": "mpesa",
                "reference_number": "CROSS-ACCOUNT",
                "payment_date": "2026-01-10",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_tenant_phone_number_is_unique_per_landlord_account_only(self):
        Tenant.objects.create(
            account=self.other_account,
            created_by=self.other_landlord,
            first_name="JOHN",
            last_name="OTHER",
            phone_number=self.tenant.phone_number,
            emergency_contact_name="KIN",
            emergency_contact_phone="0799999999",
            move_in_date=date(2026, 1, 1),
        )

        self.client.force_authenticate(self.landlord)
        response = self.client.post(
            "/api/v1/tenants/",
            {
                "first_name": "DUPLICATE",
                "last_name": "TENANT",
                "phone_number": self.tenant.phone_number,
                "emergency_contact_name": "KIN",
                "emergency_contact_phone": "0799999998",
                "move_in_date": "2026-01-01",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("phone_number", response.data)

    def test_landlord_cannot_assign_caretaker_from_another_account(self):
        external_caretaker = User.objects.create_user(
            email="external-caretaker@example.com",
            password="StrongPass123!",
            account=self.other_account,
            role=self.caretaker_role,
        )

        self.client.force_authenticate(self.landlord)
        response = self.client.patch(
            f"/api/v1/properties/{self.property.id}/",
            {"caretakers": [external_caretaker.id]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.property.refresh_from_db()
        self.assertFalse(self.property.caretakers.filter(id=external_caretaker.id).exists())

    def test_caretaker_cannot_report_maintenance_for_unassigned_property(self):
        self.client.force_authenticate(self.caretaker)
        response = self.client.post(
            "/api/v1/maintenance-requests/",
            {
                "property": self.other_property.id,
                "unit": self.other_unit.id,
                "tenant": self.other_tenant.id,
                "title": "BROKEN LOCK",
                "description": "DOOR LOCK IS DAMAGED",
                "priority": MaintenanceRequest.Priority.HIGH,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_occupancy_and_vacating_create_landlord_notifications(self):
        new_tenant = self.create_tenant(self.account, self.landlord, "0711000003", "MARY", "ATIENO")
        new_unit = self.create_unit(self.property, "A2", "7000.00")
        self.client.force_authenticate(self.landlord)
        response = self.client.post(
            "/api/v1/leases/",
            {
                "tenant": new_tenant.id,
                "unit": new_unit.id,
                "start_date": "2026-03-01",
                "rent_amount": "7000.00",
                "deposit_amount": "7000.00",
                "billing_day": 5,
                "grace_period_days": 0,
                "late_fee_type": "none",
                "late_fee_value": "0.00",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        new_unit.refresh_from_db()
        self.assertEqual(new_unit.status, Unit.Status.OCCUPIED)
        self.assertTrue(Notification.objects.filter(user=self.landlord, title="Unit occupied", tenant=new_tenant).exists())

        response = self.client.patch(
            f"/api/v1/tenants/{new_tenant.id}/",
            {
                "status": Tenant.Status.VACATED,
                "move_out_date": "2026-03-20",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        new_unit.refresh_from_db()
        self.assertEqual(new_unit.status, Unit.Status.VACANT)
        self.assertTrue(Notification.objects.filter(user=self.landlord, title="Tenant vacated", tenant=new_tenant).exists())

    def test_caretaker_gets_feedback_when_landlord_verifies_claim(self):
        january_charge = RentCharge.objects.get(lease=self.lease, billing_month=date(2026, 1, 1))
        claim = PaymentClaim.objects.create(
            account=self.account,
            tenant=self.tenant,
            lease=self.lease,
            rent_charge=january_charge,
            amount_claimed=Decimal("3000.00"),
            payment_method=PaymentClaim.Method.MPESA,
            confirmation_code="CLAIM123",
            claimed_payment_date=date(2026, 1, 12),
            submitted_by=self.caretaker,
        )

        self.client.force_authenticate(self.landlord)
        response = self.client.post(f"/api/v1/payment-claims/{claim.id}/verify/", {"verification_notes": "OK"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(Notification.objects.filter(user=self.caretaker, title="Payment confirmed", tenant=self.tenant).exists())

    def test_tenant_statement_does_not_reveal_other_account_tenant(self):
        self.client.force_authenticate(self.landlord)
        response = self.client.get(f"/api/v1/reports/tenant-statement/?tenant={self.other_tenant.id}")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class FullPanelSmokeTests(APITestCase):
    def setUp(self):
        self.landlord_role, _ = Role.objects.get_or_create(name=Role.Names.LANDLORD)
        self.caretaker_role, _ = Role.objects.get_or_create(name=Role.Names.CARETAKER)
        self.landlord, self.account = self.create_landlord("smoke-owner@example.com", "Smoke Owner Account")
        self.other_landlord, self.other_account = self.create_landlord("smoke-other@example.com", "Smoke Other Account")
        self.caretaker = User.objects.create_user(
            email="smoke-caretaker@example.com",
            password="StrongPass123!",
            account=self.account,
            role=self.caretaker_role,
        )
        self.property = self.create_property(self.landlord, self.account, "GREEN HEIGHTS")
        self.property.caretakers.add(self.caretaker)
        self.unit = self.create_unit(self.property, "A1", "6000.00")
        self.tenant = self.create_tenant(self.account, self.landlord, "0733000001", "JOHN", "MWANGI")
        self.lease = Lease.objects.create(
            account=self.account,
            tenant=self.tenant,
            unit=self.unit,
            start_date=date(2026, 1, 1),
            rent_amount=Decimal("6000.00"),
            deposit_amount=Decimal("6000.00"),
            billing_day=5,
            created_by=self.landlord,
        )
        self.other_property = self.create_property(self.other_landlord, self.other_account, "OTHER HEIGHTS")
        self.other_unit = self.create_unit(self.other_property, "B1", "9000.00")
        self.other_tenant = self.create_tenant(self.other_account, self.other_landlord, "0733000002", "JANE", "WAMBUI")
        self.extra_leases = []
        for index in range(2, 32):
            unit = self.create_unit(self.property, f"A{index}", f"{6000 + index * 100}.00")
            tenant = self.create_tenant(
                self.account,
                self.landlord,
                f"0722{index:06d}",
                f"TENANT{index:02d}",
                "TEST",
            )
            lease = Lease.objects.create(
                account=self.account,
                tenant=tenant,
                unit=unit,
                start_date=date(2026, 1, 1),
                rent_amount=unit.rent_amount,
                deposit_amount=unit.deposit_amount,
                billing_day=5,
                created_by=self.landlord,
            )
            self.extra_leases.append(lease)

        generate_rent_charges_for_month(date(2026, 2, 1))
        generate_rent_charges_for_month(date(2026, 3, 1))

    def create_landlord(self, email, account_name):
        user = User.objects.create_user(email=email, password="StrongPass123!", role=self.landlord_role)
        account = Account.objects.create(name=account_name, owner=user)
        user.account = account
        user.save(update_fields=["account"])
        return user, account

    def create_property(self, landlord, account, name):
        return Property.objects.create(
            landlord=landlord,
            account=account,
            name=name,
            property_type=Property.PropertyType.APARTMENT,
            address=name,
            county="",
            town="NAIROBI",
        )

    def create_unit(self, property_obj, unit_number, rent):
        return Unit.objects.create(
            property=property_obj,
            unit_number=unit_number,
            unit_type=Unit.UnitType.ONE_BEDROOM,
            rent_amount=Decimal(rent),
            deposit_amount=Decimal(rent),
        )

    def create_tenant(self, account, created_by, phone, first_name, last_name):
        return Tenant.objects.create(
            account=account,
            created_by=created_by,
            first_name=first_name,
            last_name=last_name,
            phone_number=phone,
            emergency_contact_name="KIN",
            emergency_contact_phone=f"{phone}9",
            move_in_date=date(2026, 1, 1),
        )

    def assert_list_response(self, path, user, minimum=1):
        self.client.force_authenticate(user)
        response = self.client.get(path)
        self.assertEqual(response.status_code, status.HTTP_200_OK, path)
        rows = response.data.get("results", response.data)
        self.assertGreaterEqual(len(rows), minimum, path)
        return response

    def test_landlord_panel_data_sources_return_large_paginated_data(self):
        endpoints = [
            "/api/v1/properties/",
            "/api/v1/units/",
            "/api/v1/tenants/",
            "/api/v1/leases/",
            "/api/v1/rent-charges/",
            "/api/v1/notifications/",
        ]
        for endpoint in endpoints[:-1]:
            self.assert_list_response(endpoint, self.landlord)

        notifications_response = self.assert_list_response("/api/v1/notifications/", self.landlord, minimum=0)
        self.assertEqual(notifications_response.status_code, status.HTTP_200_OK)

        maintenance_response = self.assert_list_response("/api/v1/maintenance-requests/", self.landlord, minimum=0)
        self.assertEqual(maintenance_response.status_code, status.HTTP_200_OK)

        tenants_response = self.client.get("/api/v1/tenants/")
        self.assertIsNotNone(tenants_response.data.get("next"))

    def test_caretaker_panel_is_scoped_to_assigned_property(self):
        assigned_endpoints = [
            "/api/v1/properties/",
            "/api/v1/units/",
            "/api/v1/tenants/",
            "/api/v1/leases/",
            "/api/v1/rent-charges/",
        ]
        for endpoint in assigned_endpoints:
            response = self.assert_list_response(endpoint, self.caretaker)
            rows = response.data.get("results", response.data)
            self.assertTrue(rows)

        self.client.force_authenticate(self.caretaker)
        payments_response = self.client.get("/api/v1/payments/")
        self.assertEqual(payments_response.status_code, status.HTTP_200_OK)
        self.assertEqual(payments_response.data["results"], [])

        arrears_response = self.client.get("/api/v1/reports/rent-collection/")
        self.assertEqual(arrears_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_reports_and_transactions_support_landlord_dashboard(self):
        january_charge = RentCharge.objects.get(lease=self.lease, billing_month=date(2026, 1, 1))
        Payment.objects.create(
            tenant=self.tenant,
            lease=self.lease,
            rent_charge=january_charge,
            amount=Decimal("6000.00"),
            payment_method=Payment.Method.MPESA,
            reference_number="RPTPAY001",
            payment_date=date(2026, 1, 7),
            received_by=self.landlord,
        )
        Expense.objects.create(
            account=self.account,
            property=self.property,
            unit=self.unit,
            category=Expense.Category.REPAIRS,
            amount=Decimal("1200.00"),
            expense_date=date(2026, 1, 9),
            description="LOCK REPAIR",
            recorded_by=self.landlord,
        )

        report_paths = [
            "/api/v1/reports/rent-collection/",
            "/api/v1/reports/occupancy/",
            "/api/v1/reports/income-expense/",
            "/api/v1/reports/property-summary/",
            "/api/v1/reports/rent-roll/",
            "/api/v1/reports/aged-receivables/",
            "/api/v1/reports/transactions/",
            f"/api/v1/reports/property-detail/?property={self.property.id}",
            f"/api/v1/reports/tenant-statement/?tenant={self.tenant.id}",
        ]
        self.client.force_authenticate(self.landlord)
        for path in report_paths:
            response = self.client.get(path)
            self.assertEqual(response.status_code, status.HTTP_200_OK, path)

        ledger = self.client.get("/api/v1/reports/transactions/")
        self.assertGreaterEqual(len(ledger.data["results"]), 2)

    def test_utilities_expenses_and_notifications_work_for_landlord(self):
        self.client.force_authenticate(self.landlord)
        utility_response = self.client.post(
            "/api/v1/utility-charges/",
            {
                "tenant": self.tenant.id,
                "lease": self.lease.id,
                "utility_type": UtilityCharge.UtilityType.WATER,
                "billing_month": "2026-02-01",
                "amount": "500.00",
                "amount_paid": "100.00",
                "due_date": "2026-02-05",
                "notes": "FEB WATER",
            },
            format="json",
        )
        self.assertEqual(utility_response.status_code, status.HTTP_201_CREATED)

        expense_response = self.client.post(
            "/api/v1/expenses/",
            {
                "property": self.property.id,
                "unit": self.unit.id,
                "category": Expense.Category.CLEANING,
                "amount": "800.00",
                "expense_date": "2026-02-02",
                "description": "STAIRCASE CLEANING",
            },
            format="json",
        )
        self.assertEqual(expense_response.status_code, status.HTTP_201_CREATED)

        notification = Notification.objects.create(
            account=self.account,
            user=self.landlord,
            tenant=self.tenant,
            title="Action test",
            message="Review action",
            notification_type=Notification.Type.TENANT_UPDATE,
        )
        mark_response = self.client.post(f"/api/v1/notifications/{notification.id}/mark_read/")
        self.assertEqual(mark_response.status_code, status.HTTP_200_OK)
        notification.refresh_from_db()
        self.assertTrue(notification.is_read)

    def test_caretaker_payment_claim_cash_and_maintenance_feedback_workflows(self):
        january_charge = RentCharge.objects.get(lease=self.lease, billing_month=date(2026, 1, 1))

        self.client.force_authenticate(self.caretaker)
        claim_response = self.client.post(
            "/api/v1/payment-claims/",
            {
                "tenant": self.tenant.id,
                "lease": self.lease.id,
                "rent_charge": january_charge.id,
                "amount_claimed": "2000.00",
                "payment_method": PaymentClaim.Method.MPESA,
                "confirmation_code": "QA-CLAIM-001",
                "claimed_payment_date": "2026-01-11",
            },
            format="json",
        )
        self.assertEqual(claim_response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Notification.objects.filter(user=self.landlord, title="Payment claim needs verification").exists())

        cash_response = self.client.post(
            "/api/v1/cash-collections/",
            {
                "tenant": self.tenant.id,
                "lease": self.lease.id,
                "rent_charge": january_charge.id,
                "amount": "1000.00",
                "collection_date": "2026-01-12",
            },
            format="json",
        )
        self.assertEqual(cash_response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Notification.objects.filter(user=self.landlord, title="Cash collection needs confirmation").exists())

        maintenance_response = self.client.post(
            "/api/v1/maintenance-requests/",
            {
                "property": self.property.id,
                "unit": self.unit.id,
                "tenant": self.tenant.id,
                "title": "LEAKING TAP",
                "description": "KITCHEN TAP LEAKING",
                "priority": MaintenanceRequest.Priority.MEDIUM,
            },
            format="json",
        )
        self.assertEqual(maintenance_response.status_code, status.HTTP_201_CREATED)
        maintenance_id = maintenance_response.data["id"]
        self.assertTrue(Notification.objects.filter(user=self.landlord, title="New maintenance issue").exists())

        self.client.force_authenticate(self.landlord)
        self.assertEqual(
            self.client.post(f"/api/v1/payment-claims/{claim_response.data['id']}/verify/", {"verification_notes": "OK"}, format="json").status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            self.client.post(f"/api/v1/cash-collections/{cash_response.data['id']}/confirm/", {"verification_notes": "OK"}, format="json").status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            self.client.post(f"/api/v1/maintenance-requests/{maintenance_id}/approve/").status_code,
            status.HTTP_200_OK,
        )
        self.assertTrue(Notification.objects.filter(user=self.caretaker, title="Payment confirmed").exists())
        self.assertTrue(Notification.objects.filter(user=self.caretaker, title="Cash payment confirmed").exists())
        self.assertTrue(Notification.objects.filter(user=self.caretaker, title="Maintenance approved").exists())


class HundredTenantStressTests(APITestCase):
    def setUp(self):
        self.landlord_role, _ = Role.objects.get_or_create(name=Role.Names.LANDLORD)
        self.caretaker_role, _ = Role.objects.get_or_create(name=Role.Names.CARETAKER)
        self.landlord = User.objects.create_user(email="stress-owner@example.com", password="StrongPass123!", role=self.landlord_role)
        self.account = Account.objects.create(name="Stress Account", owner=self.landlord)
        self.landlord.account = self.account
        self.landlord.save(update_fields=["account"])
        self.caretaker = User.objects.create_user(
            email="stress-caretaker@example.com",
            password="StrongPass123!",
            account=self.account,
            role=self.caretaker_role,
        )
        self.property = Property.objects.create(
            landlord=self.landlord,
            account=self.account,
            name="STRESS COURT",
            property_type=Property.PropertyType.APARTMENT,
            address="STRESS COURT",
            county="",
            town="NAIROBI",
        )
        self.property.caretakers.add(self.caretaker)
        self.leases = []
        for index in range(1, 101):
            unit = Unit.objects.create(
                property=self.property,
                unit_number=f"A{index}",
                unit_type=Unit.UnitType.BEDSITTER if index % 2 else Unit.UnitType.ONE_BEDROOM,
                floor=str((index - 1) // 10 + 1),
                rent_amount=Decimal("5000.00") + Decimal(index * 20),
                deposit_amount=Decimal("5000.00") + Decimal(index * 20),
            )
            tenant = Tenant.objects.create(
                account=self.account,
                created_by=self.landlord,
                first_name=f"TENANT{index:03d}",
                last_name="STRESS",
                phone_number=f"0799{index:06d}",
                emergency_contact_name="KIN",
                emergency_contact_phone=f"0788{index:06d}",
                move_in_date=date(2026, 1, 1),
            )
            self.leases.append(
                Lease.objects.create(
                    account=self.account,
                    tenant=tenant,
                    unit=unit,
                    start_date=date(2026, 1, 1),
                    rent_amount=unit.rent_amount,
                    deposit_amount=unit.deposit_amount,
                    billing_day=5,
                    created_by=self.landlord,
                )
            )

    def test_one_hundred_tenants_six_months_and_mixed_payment_workflows(self):
        for month in range(2, 7):
            created = generate_rent_charges_for_month(date(2026, month, 1))
            self.assertEqual(len(created), 100)
            self.assertEqual(generate_rent_charges_for_month(date(2026, month, 15)), [])

        self.assertEqual(Unit.objects.filter(property=self.property, status=Unit.Status.OCCUPIED).count(), 100)
        self.assertEqual(RentCharge.objects.filter(account=self.account).count(), 600)

        january_charges = list(RentCharge.objects.filter(account=self.account, billing_month=date(2026, 1, 1)).order_by("id"))
        for index, charge in enumerate(january_charges[:40], start=1):
            Payment.objects.create(
                tenant=charge.tenant,
                lease=charge.lease,
                rent_charge=charge,
                amount=charge.amount,
                payment_method=Payment.Method.MPESA,
                reference_number=f"STRESS-FULL-{index:03d}",
                payment_date=date(2026, 1, 5) + timedelta(days=index % 10),
                received_by=self.landlord,
            )

        for index, charge in enumerate(january_charges[40:70], start=41):
            Payment.objects.create(
                tenant=charge.tenant,
                lease=charge.lease,
                rent_charge=charge,
                amount=(charge.amount / Decimal("2.00")).quantize(Decimal("0.01")),
                payment_method=Payment.Method.BANK,
                reference_number=f"STRESS-PART-{index:03d}",
                payment_date=date(2026, 1, 12),
                received_by=self.landlord,
            )

        multi_charge = january_charges[70]
        Payment.objects.create(
            tenant=multi_charge.tenant,
            lease=multi_charge.lease,
            rent_charge=multi_charge,
            amount=(multi_charge.amount * Decimal("3.00")).quantize(Decimal("0.01")),
            payment_method=Payment.Method.MPESA,
            reference_number="STRESS-MULTI-001",
            payment_date=date(2026, 1, 15),
            received_by=self.landlord,
        )

        multi_charge.refresh_from_db()
        february_multi = RentCharge.objects.get(lease=multi_charge.lease, billing_month=date(2026, 2, 1))
        march_multi = RentCharge.objects.get(lease=multi_charge.lease, billing_month=date(2026, 3, 1))
        self.assertEqual(multi_charge.balance, Decimal("0.00"))
        self.assertEqual(february_multi.balance, Decimal("0.00"))
        self.assertEqual(march_multi.balance, Decimal("0.00"))

        claim_charge = january_charges[71]
        cash_charge = january_charges[72]
        claim = PaymentClaim.objects.create(
            account=self.account,
            tenant=claim_charge.tenant,
            lease=claim_charge.lease,
            rent_charge=claim_charge,
            amount_claimed=Decimal("1500.00"),
            payment_method=PaymentClaim.Method.MPESA,
            confirmation_code="STRESS-CLAIM-001",
            claimed_payment_date=date(2026, 1, 18),
            submitted_by=self.caretaker,
        )
        cash = CashCollection.objects.create(
            account=self.account,
            tenant=cash_charge.tenant,
            lease=cash_charge.lease,
            rent_charge=cash_charge,
            amount=Decimal("1800.00"),
            collection_date=date(2026, 1, 18),
            collected_by=self.caretaker,
        )
        claim.verify(self.landlord, "OK")
        cash.confirm(self.landlord, "OK")

        self.client.force_authenticate(self.landlord)
        endpoints = [
            "/api/v1/tenants/",
            "/api/v1/units/",
            "/api/v1/leases/",
            "/api/v1/rent-charges/",
            "/api/v1/payments/",
            "/api/v1/reports/rent-collection/",
            "/api/v1/reports/occupancy/",
            "/api/v1/reports/rent-roll/",
            "/api/v1/reports/aged-receivables/",
            "/api/v1/reports/transactions/",
        ]
        for endpoint in endpoints:
            response = self.client.get(endpoint)
            self.assertEqual(response.status_code, status.HTTP_200_OK, endpoint)

        tenant_response = self.client.get("/api/v1/tenants/")
        self.assertEqual(tenant_response.data["count"], 100)
        self.assertIsNotNone(tenant_response.data["next"])

        collection_report = self.client.get("/api/v1/reports/rent-collection/").data
        self.assertGreater(Decimal(str(collection_report["expected"])), Decimal("0.00"))
        self.assertGreater(Decimal(str(collection_report["collected"])), Decimal("0.00"))
        self.assertGreater(Decimal(str(collection_report["balance"])), Decimal("0.00"))

        self.client.force_authenticate(self.caretaker)
        caretaker_tenants = self.client.get("/api/v1/tenants/")
        self.assertEqual(caretaker_tenants.status_code, status.HTTP_200_OK)
        self.assertEqual(caretaker_tenants.data["count"], 100)
        caretaker_payments = self.client.get("/api/v1/payments/")
        self.assertEqual(caretaker_payments.status_code, status.HTTP_200_OK)
        self.assertEqual(caretaker_payments.data["results"], [])
        caretaker_financial_report = self.client.get("/api/v1/reports/rent-collection/")
        self.assertEqual(caretaker_financial_report.status_code, status.HTTP_403_FORBIDDEN)
