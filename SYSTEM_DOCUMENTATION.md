# Teq Rentals System Documentation

Teq Rentals is a residential rental management system built for Kenyan landlords, property owners, and caretakers. It helps manage units, tenants, leases, rent charges, payments, maintenance issues, notifications, and reports from one web-based dashboard.

The system is designed for real landlord workflows in Kenya, where caretakers may be on the ground collecting information, confirming M-Pesa or bank messages, receiving cash, and reporting maintenance issues, while the landlord keeps control over financial verification and oversight.

## 1. System Overview

Teq Rentals helps landlords answer the daily operational questions that usually cause stress:

- Which units are vacant or occupied?
- Which tenants have paid rent?
- Which tenants still have balances or arrears?
- Which caretaker submitted which payment claim?
- Which maintenance issues need approval?
- How much rent was expected, collected, and outstanding?
- Which tenant moved in, moved out, or transferred units?

The system works on both desktop and mobile browsers. Landlords can use a laptop or PC for management and reporting, while caretakers can use a phone while moving around the property.

## 2. Main User Roles

### Landlord

The landlord is the account owner and has full access to the property records, tenants, leases, payments, reports, expenses, utilities, notifications, and caretaker management.

The landlord can:

- Add and manage properties.
- Create rental units and set rent/deposit amounts.
- Create and manage caretaker accounts.
- Assign caretakers to the property.
- View dashboard totals and graphs.
- Verify or reject payment claims from caretakers.
- Confirm cash collections.
- Record official payments.
- View arrears and follow-up lists.
- Manage tenant vacating and unit transfers.
- Approve/reject maintenance issues.
- Record expenses and utilities.
- View reports and transaction history.

### Caretaker

The caretaker is the on-ground user. Their access is limited so they only see what they need to perform their work.

The caretaker can:

- View assigned property/unit occupancy.
- Add new tenants.
- Assign tenants to vacant units through leases.
- Submit M-Pesa or bank payment claims.
- Record cash collections for landlord confirmation.
- Log maintenance issues.
- Mark approved maintenance as resolved.
- Receive system notifications from the landlord.

The caretaker should not see sensitive landlord financial dashboards, rent collection trend graphs, profit reports, or full landlord-level reports.

## 3. Core Features

### Dashboard

The dashboard gives a quick summary of the rental business.

Typical landlord dashboard information includes:

- Total units.
- Occupied units.
- Vacant units.
- Rent expected.
- Rent collected.
- Outstanding balances.
- Payment claims awaiting verification.
- Open maintenance issues.
- Recent notifications.
- Rent collection trend visuals.

This helps the landlord quickly know whether the property is performing well.

### Property Management

The landlord can create and manage properties. For the current business direction, the system is optimized for landlords who mainly manage one property, but it can still support multiple properties where needed.

Property filtering allows the landlord to view:

- All properties combined.
- A specific property only.
- Units, tenants, leases, reports, and payments for one selected property.

### Unit Management

Units are created by the landlord. The caretaker does not create units unless the landlord gives that responsibility in future customization.

Each unit can store:

- Unit number or name.
- Unit type, such as bedsitter, one bedroom, two bedroom, shop, house, etc.
- Rent amount.
- Deposit amount.
- Occupancy status.

Unit status is updated automatically:

- When a tenant is assigned through a lease, the unit becomes occupied.
- When a tenant vacates, the unit becomes vacant.
- When a tenant transfers, the old unit becomes vacant and the new unit becomes occupied.

The system sorts units naturally, so units appear in a human-friendly order like:

```text
1, 2, 3, 10, 11
1A, 1B, 1C, 2A, 3B
```

instead of:

```text
1, 10, 11, 2
```

### Tenant Management

Tenants are registered with the details needed for daily property management.

The system tracks:

- Tenant name.
- Phone number.
- Emergency contact.
- Assigned unit.
- Active/vacated status.
- Lease history.
- Payment history.
- Balance/arrears history.

New tenants are active by default. Vacating is handled later through the tenant status/update workflow, not during new tenant creation.

### Lease Management

A lease connects a tenant to a unit.

The lease defines:

- Tenant.
- Unit.
- Start date.
- Monthly rent.
- Deposit amount.
- Billing day or due date.

When a lease is created:

- The tenant becomes assigned to the unit.
- The unit becomes occupied.
- The first rent charge can be created.
- The landlord can see the total onboarding amount: rent plus deposit.

The system prevents duplicate active leases where they would cause conflicts.

### Tenant Onboarding

The normal onboarding process is:

1. Landlord creates the unit and sets rent/deposit.
2. Caretaker or landlord adds the tenant.
3. Tenant is assigned to a vacant unit through a lease.
4. The system calculates onboarding amount:

```text
Total required = monthly rent + deposit
```

5. Unit becomes occupied.
6. Landlord receives a system notification.
7. Rent charge/payment tracking begins.

This helps the landlord know whether the caretaker has collected or submitted the expected move-in amounts.

### Tenant Vacating

When a tenant leaves:

- The tenant status is updated to vacated.
- The unit becomes vacant.
- The landlord receives a notification.
- If the tenant still has a balance, the system warns the user before completing the process.

Vacated tenants remain in the database for history and reporting. They are not deleted because landlords may need old records for disputes, receipts, balances, or audit trails.

### Tenant Transfer

If a tenant moves from one unit to another:

1. Select the existing tenant.
2. Choose the new vacant unit.
3. Confirm transfer date.
4. Choose deposit handling where applicable.
5. System closes the old active lease.
6. System creates the new lease.
7. Old unit becomes vacant.
8. New unit becomes occupied.
9. Landlord receives a notification.

This is useful when tenants upgrade, downgrade, or move to another unit within the same property.

## 4. Rent Charges And Payments

### Rent Charges

A rent charge is the monthly bill raised against a tenant’s lease.

Example:

```text
Tenant: John Mwangi
Unit: 4A
Monthly rent: KES 12,000
Month: June 2026
Charge: KES 12,000
```

The lease is the agreement. The rent charge is the monthly bill created from that agreement.

The system prevents duplicate charges for the same lease and month. If the landlord clicks generate current month twice, it should not create duplicate bills.

### Automatic Monthly Rent Charges

The system includes a command for generating monthly rent charges automatically:

```bash
python manage.py generate_monthly_rent_charges
```

In production, this should be scheduled to run every month, for example on the 2nd day of each month. Tenant due dates still follow the lease billing day, such as the 5th, 8th, or 10th.

On Render free testing, monthly charges can be generated manually from the app. On a real VPS or paid hosting, this should run as a cron job.

### Payment Processing

Payments reduce the tenant’s outstanding balance.

The system supports:

- Full payments.
- Partial payments.
- Multiple payments for one charge.
- Overpayments/advance payments.
- M-Pesa references.
- Bank references.
- Cash collection confirmation.

Example partial payment:

```text
Rent charge: KES 10,000
Payment 1: KES 4,000
Balance: KES 6,000
Payment 2: KES 6,000
Balance: KES 0
```

The rent charge remains visible until fully cleared.

### Overpayments And Advance Payments

If a tenant pays more than the current rent charge, the extra amount is treated as credit.

Example:

```text
Monthly rent: KES 10,000
Tenant pays: KES 25,000
Current month cleared: KES 10,000
Remaining credit: KES 15,000
```

Future rent charges can consume that credit.

### Duplicate Payment Protection

The system blocks duplicate payment references. If the same M-Pesa or bank reference is entered twice, the second entry should fail cleanly.

This helps prevent double-counting.

## 5. Caretaker Payment Workflows

### Payment Claims

Payment claims are used when a caretaker confirms that a tenant has paid by M-Pesa or bank but the landlord still needs to verify.

Caretaker flow:

1. Search/select tenant.
2. Paste M-Pesa or bank message.
3. System extracts amount/reference where possible.
4. Submit claim.
5. Landlord receives notification.

Landlord flow:

1. Open notification or verification tab.
2. Review claim.
3. Verify or reject.
4. If verified, official payment is recorded.
5. Caretaker receives feedback notification.

### Cash Collections

Cash collections are used when the tenant pays cash to the caretaker.

Caretaker submits:

- Tenant.
- Amount.
- Date.
- Notes/reference if available.

Landlord verifies when the cash is handed over or accepted. Until then, it remains pending.

This helps avoid confusion where a caretaker has collected money but the landlord has not confirmed receipt.

## 6. M-Pesa And Bank Message Parsing

The system can help extract information from pasted payment messages.

For M-Pesa and bank messages, it attempts to detect:

- Amount.
- Transaction/reference code.
- Date/time where available.
- Payment method clues.

The system is designed to avoid treating generic words like `Completed` as the confirmation code.

Real M-Pesa integration is not yet connected. Current workflow is manual confirmation assisted by message parsing. Future premium integration can connect Safaricom Daraja API for automatic payment matching.

## 7. Maintenance Management

Maintenance helps caretakers report repair issues and landlords approve work.

Typical flow:

1. Caretaker logs issue.
2. Landlord receives notification.
3. Landlord approves or rejects.
4. Caretaker proceeds if approved.
5. Caretaker marks it resolved.
6. Landlord is notified and can close/follow up.

The caretaker does not decide repair cost inside the caretaker form. The landlord can later record the cost as an expense if needed.

## 8. Expenses And Utilities

### Expenses

The landlord can record property expenses such as:

- Repairs.
- Materials.
- Labour.
- Cleaning.
- Security.
- Management costs.
- Other property expenses.

Expenses help with profit tracking and future reports.

### Utilities

The system supports optional utilities because different landlords handle them differently.

Utilities may include:

- Water.
- Electricity.
- Garbage.
- Security.
- Service charge.
- Other charges.

If a landlord includes utilities in rent, the utilities module can be ignored or disabled in future customization.

## 9. Notifications

The system has internal system notifications.

Landlords can be notified when:

- New tenant is onboarded.
- Tenant vacates.
- Unit becomes occupied/vacant.
- Payment claim requires verification.
- Cash collection requires confirmation.
- Maintenance issue requires action.
- Maintenance issue is resolved.
- Tenant is transferred.

Caretakers can be notified when:

- Payment claim is verified.
- Payment claim is rejected.
- Cash collection is confirmed/rejected.
- Maintenance issue is approved/rejected.

Notifications that require action include a button directing the user to the correct tab.

SMS notifications are planned for a future module. For now, notifications are system-to-system inside the app.

## 10. Reports And Analytics

The system supports reporting views for:

- Dashboard summary.
- Rent collection.
- Arrears.
- Rent roll.
- Transactions.
- Expenses.
- Utilities.
- Tenant statements.
- Maintenance activity.

Transactions are sorted with the most recent first.

Rent roll and tenant/unit lists are sorted by unit number naturally.

Reports help landlords understand:

- Expected income.
- Collected income.
- Outstanding balances.
- Tenant payment behavior.
- Property performance.
- Maintenance workload.

## 11. Global Search

The system includes tenant search to help with large properties.

A landlord or caretaker can search using:

- Tenant name.
- Phone number.
- Unit number.
- Emergency contact.

This is important for properties with many tenants, for example 80 to 120 units, where dropdown lists become slow and inconvenient.

## 12. Security And Data Isolation

The system is designed with role-based access and account scoping.

Important protections:

- A landlord only sees their own account data.
- A caretaker only sees assigned property information.
- Caretakers are restricted from sensitive landlord financial reports.
- JWT authentication is used.
- Passwords are hashed.
- Duplicate payment references are blocked.
- API endpoints require authentication.
- Production settings require environment-based secrets.
- CORS and allowed hosts are configurable for production domains.

For real SaaS usage, each landlord should have a separate account context so their data does not mix with another landlord’s data.

## 13. Mobile Usage

The system is designed to work well on phones because caretakers are likely to use it while moving around the property.

Mobile-friendly areas include:

- Login.
- Dashboard.
- Tenant onboarding.
- Payment claims.
- Cash collections.
- Maintenance issues.
- Notifications.
- Global search.

For best real-world use, caretakers should use a modern mobile browser like Chrome, Brave, or Safari.

## 14. Current Hosting Notes

The system is currently deployed for testing on Render.

Render free hosting has limitations:

- Backend can sleep after inactivity.
- First load may take several seconds.
- Login and first data loads may be slow.
- Free database is for testing only.
- Free database has no proper long-term backup.
- Shell access may not be available on free instances.

For real clients, move to a paid VPS or paid managed hosting.

Recommended production setup:

- Domain with HTTPS.
- VPS or paid hosting.
- PostgreSQL database.
- Automated database backups.
- Cron job for monthly rent charges.
- Secure environment variables.
- Monitoring/logging.

## 15. Recommended Client-Facing Feature List

When presenting to landlords, explain the system in simple benefit-focused language:

### Rental Unit Management

Manage all rooms, houses, shops, and apartments from one dashboard. Know instantly which units are vacant or occupied.

### Tenant Records

Keep tenant contacts, emergency details, lease history, and payment history in one organized system.

### Lease And Onboarding

Assign tenants to units, calculate required rent plus deposit, and track move-ins properly.

### Rent Tracking

Automatically track rent charges, payments, partial payments, balances, arrears, and overpayments.

### Caretaker Workflow

Caretakers can submit payment claims, record cash collections, add tenants, and report maintenance issues from their phones.

### Landlord Verification

Landlords remain in control by verifying payments, confirming cash collections, and approving maintenance issues.

### Notifications

The system alerts users when action is needed, such as payment verification, tenant move-in, tenant vacating, or maintenance approval.

### Reports

Landlords can view rent collection, arrears, rent roll, expenses, transactions, and overall property performance.

### Mobile Friendly

Designed for everyday use on phones and desktops.

### Secure Access

Different users see only what they are allowed to see. Caretakers do not access sensitive landlord financial reports.

## 16. Future Premium Features

The following features can be added later depending on client needs:

- SMS reminders to tenants.
- M-Pesa Daraja integration.
- Automatic payment matching.
- Email notifications.
- Tenant portal.
- Lease documents/templates.
- E-signatures.
- Maintenance photos.
- Vendor management.
- Advanced accounting reports.
- Owner statements for agencies.
- Custom landlord-specific workflows.
- Subscription billing for SaaS clients.

## 17. Suggested Demo Script For Landlords

Use this simple flow when demoing the system:

1. Login as landlord.
2. Show dashboard summary.
3. Add a property.
4. Add several units.
5. Login as caretaker on phone.
6. Add a tenant.
7. Create lease and assign unit.
8. Show unit status changing to occupied.
9. Submit a payment claim as caretaker.
10. Show landlord notification.
11. Verify the payment as landlord.
12. Show balance reducing.
13. Log a maintenance issue.
14. Approve/reject it as landlord.
15. Show reports and arrears.

This demo clearly shows the value: the landlord controls the business while the caretaker handles ground operations.

## 18. Important Operational Rules

- Do not delete tenants unless absolutely necessary. Use vacated status for history.
- Do not share landlord passwords with caretakers.
- Deactivate sacked caretakers instead of deleting them.
- Verify payment claims before treating them as official payments.
- Use unique payment references.
- Back up the database before real client use.
- Use HTTPS in production.
- Schedule rent charge generation monthly.
- Remove temporary bootstrap passwords from hosting environment variables after setup.

## 19. Summary

Teq Rentals is built to simplify rental management for Kenyan landlords by combining landlord oversight, caretaker field workflows, rent tracking, maintenance management, and reporting in one system.

The current version is suitable for demos, testing, and pilot clients. Before onboarding real paying landlords at scale, the system should be hosted on stable paid infrastructure with backups, HTTPS, cron jobs, and clear operational support procedures.
