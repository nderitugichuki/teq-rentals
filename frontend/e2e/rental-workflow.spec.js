import { expect, test } from "@playwright/test";

const API_BASE_URL = process.env.E2E_API_BASE_URL || "http://backend:8000/api/v1";
const LANDLORD_EMAIL = process.env.E2E_LANDLORD_EMAIL || "e2e.landlord@example.com";
const LANDLORD_PASSWORD = process.env.E2E_LANDLORD_PASSWORD || "StrongPass123!";

function uniqueRunId() {
  return Date.now().toString(36).toUpperCase();
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function monthStart(offset = 0) {
  const date = new Date();
  date.setUTCMonth(date.getUTCMonth() + offset, 1);
  return isoDate(date);
}

function today() {
  return isoDate(new Date());
}

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

async function expectApiOk(response, label) {
  expect(response.ok(), `${label}: ${response.status()} ${await response.text()}`).toBeTruthy();
  return response.json();
}

async function apiLogin(request) {
  const response = await request.post(`${API_BASE_URL}/auth/token/`, {
    data: {
      email: LANDLORD_EMAIL,
      password: LANDLORD_PASSWORD,
    },
  });
  const data = await expectApiOk(response, "API landlord login");
  return data.access;
}

async function listAll(request, path, token) {
  let url = `${API_BASE_URL}${path}`;
  const rows = [];

  while (url) {
    const response = await request.get(url, { headers: authHeaders(token) });
    const data = await expectApiOk(response, `GET ${path}`);
    if (Array.isArray(data)) {
      rows.push(...data);
      break;
    }
    rows.push(...(data.results || []));
    url = data.next;
  }

  return rows;
}

async function findRequired(request, path, token, predicate, label) {
  const rows = await listAll(request, path, token);
  const row = rows.find(predicate);
  expect(row, `Expected to find ${label}`).toBeTruthy();
  return row;
}

async function selectTenantFromSearch(panel, tenantName) {
  const tenantSearch = panel.getByPlaceholder("Search by name, phone, or unit");
  await tenantSearch.fill(tenantName);
  await panel.getByRole("button", { name: new RegExp(tenantName, "i") }).click();
  await expect(panel.locator("span").filter({ hasText: new RegExp(tenantName, "i") }).first()).toBeVisible();
}

test("landlord rental workflow records a partial payment and protects logged-out routes", async ({ page, request }) => {
  test.setTimeout(120000);

  const runId = uniqueRunId();
  const propertyName = `E2E COURT ${runId}`;
  const unitNumber = `E2E-${runId}`;
  const tenantFirstName = `E2E${runId}`;
  const tenantLastName = "TENANT";
  const tenantName = `${tenantFirstName} ${tenantLastName}`;
  const phoneNumber = `079${Date.now().toString().slice(-7)}`;
  const rentAmount = "10000";
  const partialPayment = "3000";

  await page.goto("/login");
  await page.getByLabel("Email").fill(LANDLORD_EMAIL);
  await page.getByLabel("Password").fill(LANDLORD_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();

  await page.goto("/properties");
  await page.getByLabel("Name", { exact: true }).fill(propertyName);
  await page.getByLabel("Town", { exact: true }).fill("NAIROBI");
  await page.getByLabel("Property type").selectOption("apartment");
  await page.getByRole("button", { name: "Save property" }).click();
  await expect(page.getByText("Property created.")).toBeVisible();
  await expect(page.getByText(propertyName)).toBeVisible();

  await page.goto("/units");
  const unitForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Save unit" }) });
  await unitForm.getByRole("combobox", { name: "Property" }).selectOption({ label: propertyName });
  await unitForm.getByLabel("Unit number").fill(unitNumber);
  await unitForm.getByLabel("Unit type").selectOption("bedsitter");
  await unitForm.getByLabel("Floor").fill("1");
  await unitForm.getByLabel("Rent amount").fill(rentAmount);
  await unitForm.getByLabel("Deposit amount").fill(rentAmount);
  await unitForm.getByLabel("Status").selectOption("vacant");
  await unitForm.getByRole("button", { name: "Save unit" }).click();
  await expect(page.getByText("Unit created.")).toBeVisible();
  await expect(page.getByText(unitNumber)).toBeVisible();

  await page.goto("/tenants");
  await page.getByLabel("First name").fill(tenantFirstName);
  await page.getByLabel("Last name").fill(tenantLastName);
  await page.getByLabel("Phone number").fill(phoneNumber);
  await page.getByLabel("Emergency contact", { exact: true }).fill("NEXT OF KIN");
  await page.getByLabel("Emergency phone").fill(`078${Date.now().toString().slice(-7)}`);
  await page.getByLabel("Move-in date").fill(today());
  await page.getByRole("button", { name: "Save tenant" }).click();
  await expect(page.getByText("Tenant created.")).toBeVisible();
  await expect(page.getByText(tenantName)).toBeVisible();

  const token = await apiLogin(request);
  const property = await findRequired(request, "/properties/", token, (row) => row.name === propertyName, propertyName);
  const unit = await findRequired(request, "/units/", token, (row) => row.unit_number === unitNumber, unitNumber);
  const tenant = await findRequired(request, "/tenants/", token, (row) => row.phone_number === phoneNumber, phoneNumber);

  expect(unit.property).toBe(property.id);
  const leaseResponse = await request.post(`${API_BASE_URL}/leases/`, {
    headers: authHeaders(token),
    data: {
      tenant: tenant.id,
      unit: unit.id,
      start_date: monthStart(-1),
      rent_amount: rentAmount,
      deposit_amount: rentAmount,
      billing_day: "1",
      grace_period_days: "0",
      late_fee_type: "none",
      late_fee_value: "0",
      status: "active",
    },
  });
  const lease = await expectApiOk(leaseResponse, "Create lease through landlord API");

  await page.goto("/payments");
  await page.getByRole("button", { name: "Generate current month" }).click();
  await expect(page.getByText(/rent charge\(s\) generated for the current month/i)).toBeVisible();

  const currentCharge = await findRequired(
    request,
    "/rent-charges/",
    token,
    (row) => row.lease === lease.id && row.billing_month === monthStart(0),
    "current month rent charge"
  );
  expect(Number(currentCharge.amount)).toBe(10000);
  expect(Number(currentCharge.balance)).toBe(10000);
  expect(currentCharge.status).toMatch(/unpaid|overdue/);

  const paymentPanel = page.locator("form").filter({ has: page.getByRole("button", { name: "Record payment" }) });
  await selectTenantFromSearch(paymentPanel, tenantName);
  await paymentPanel.getByLabel("Linked rent charge").selectOption(String(currentCharge.id));
  await paymentPanel.locator('input[type="number"]').first().fill(partialPayment);
  await paymentPanel.getByLabel("Method").selectOption("mpesa");
  await paymentPanel.getByLabel("Reference").fill(`E2E-${runId}`);
  await paymentPanel.getByLabel("M-Pesa phone").fill(phoneNumber);
  await paymentPanel.getByLabel("Payment date").fill(today());
  await paymentPanel.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByText("Payment recorded and linked charge updated.")).toBeVisible();

  const updatedCharge = await findRequired(
    request,
    "/rent-charges/",
    token,
    (row) => row.id === currentCharge.id,
    "updated current charge"
  );
  expect(Number(updatedCharge.amount_paid)).toBe(3000);
  expect(Number(updatedCharge.balance)).toBe(7000);
  expect(updatedCharge.status).toBe("partial");

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();

  await page.goto("/payments");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText("Sign in to your workspace")).toBeVisible();
});
