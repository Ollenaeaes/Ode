# Feature Spec: Visma Payroll + Expense Twin

**Slug:** `twin-visma-payroll`
**Created:** 2026-03-11
**Status:** draft
**Priority:** high

---

## Overview

A digital twin that simulates the Visma Payroll REST API and Expense API, allowing Ode's integration layer to develop and test against realistic payroll data without connecting to the live Visma environment. The twin mirrors the real API's OAuth 2.0 authentication pattern, REST endpoints documented at docs.payrollapi.no.visma.net, and generates 6 months of payroll history for 150+ employees across Ode's departments.

## Problem Statement

Ode needs to integrate with Visma Payroll for employee data, salary processing, variable transactions (overtime, hourly work), and expense management. Developing against the live API is slow (rate limits, auth complexity, no test data control) and risky (accidental writes to production payroll). A digital twin provides a fast, deterministic, resettable development target with realistic Ode-specific data.

## Out of Scope

- NOT: Actual OAuth 2.0 flow with Visma Connect (twin uses simplified bearer token auth from foundation library)
- NOT: Webhook/callback support for payroll run completion
- NOT: Salary slip PDF generation
- NOT: Multi-tenant support (twin serves only Ode's simulated data)
- NOT: Payroll calculation engine (twin stores and returns pre-generated payroll results)
- NOT: Real currency conversion or tax calculation
- NOT: Integration with other Visma products (e.g., Visma Business, Visma.net ERP)

---

## User Stories

### Story 1: Employee Endpoint

**As a** developer integrating with Visma Payroll
**I want to** list employees with their departments and employment details
**So that** I can build features that display and filter employee information

**Acceptance Criteria:**

- GIVEN the twin is running WHEN I GET /api/v1/employees THEN I receive a paginated list of all employees with fields: employeeId, firstName, lastName, dateOfBirth, email, department, employmentStartDate, employmentType, position, salary, taxCard, bankAccount (masked), active
- GIVEN the twin has data WHEN I GET /api/v1/employees?departmentId=:id THEN I receive only employees in that department
- GIVEN the twin has data WHEN I GET /api/v1/employees/:id THEN I receive the full employee record
- GIVEN a non-existent employee WHEN I GET /api/v1/employees/999999 THEN I receive 404 with Visma-style error response
- GIVEN valid auth WHEN I GET /api/v1/employees?page=2&pageSize=25 THEN pagination works correctly with totalCount, page, pageSize in response

**Test Requirements:**

- [ ] Test: GET /employees returns 150+ employees with all required fields populated
- [ ] Test: Filtering by departmentId returns only matching employees
- [ ] Test: GET /employees/:id returns a single complete employee record
- [ ] Test: Pagination returns correct totalCount and respects pageSize
- [ ] Test: 404 for non-existent employee with proper error shape
- [ ] Test: Departments match Ode structure (Hatchery, Sea Operations, Processing/Vartdal, Sales, Admin/HQ, R&D)

**Technical Notes:**

Visma employee response shape includes nested objects for employment details and tax info. Department structure should reflect Ode's actual organization: hatcheries, 10 sea sites, Vartdal processing, sales, admin. Employment types: full-time, part-time, seasonal (processing workers often seasonal).

---

### Story 2: Pay Codes Endpoint

**As a** developer integrating with Visma Payroll
**I want to** retrieve the catalog of pay codes (salary components, additions, deductions)
**So that** I can correctly categorize and display payroll line items

**Acceptance Criteria:**

- GIVEN the twin is running WHEN I GET /api/v1/pay-codes THEN I receive a list of all pay codes with fields: payCodeId, code, name, type (salary/addition/deduction), category, taxable, active
- GIVEN the twin has data WHEN I GET /api/v1/pay-codes?type=addition THEN I receive only addition-type pay codes
- GIVEN the twin has data WHEN I GET /api/v1/pay-codes/:id THEN I receive a single pay code record

**Test Requirements:**

- [ ] Test: GET /pay-codes returns all pay codes including base salary, overtime rates, sea allowance, shift premiums, holiday pay, tax deductions
- [ ] Test: Filtering by type returns correct subset
- [ ] Test: Pay codes include aquaculture-specific items (sea site bonus, processing shift premium, cold storage allowance)
- [ ] Test: Each pay code has correct taxable flag

**Technical Notes:**

Norwegian payroll has specific codes for: base salary (fastlonn), overtime 50% (overtid 50%), overtime 100% (overtid 100%), sea allowance (sjotillegg), shift premium (skifttillegg), holiday pay (feriepenger), tax deduction (skattetrekk), pension contribution (pensjon), union fees (fagforeningskontingent). Include cod-farming-specific additions like offshore/sea site bonus and cold processing premium.

---

### Story 3: Variable Transactions

**As a** developer integrating with Visma Payroll
**I want to** submit and read variable transactions (overtime, hourly work, expense items)
**So that** I can build time registration and expense submission flows

**Acceptance Criteria:**

- GIVEN valid auth WHEN I GET /api/v1/variable-transactions?periodId=:period THEN I receive all variable transactions for that payroll period
- GIVEN valid auth WHEN I GET /api/v1/variable-transactions?employeeId=:id THEN I receive transactions for a specific employee
- GIVEN valid transaction data WHEN I POST /api/v1/variable-transactions THEN the transaction is created and returned with an id and status "pending"
- GIVEN an existing transaction WHEN I GET /api/v1/variable-transactions/:id THEN I receive the full transaction record
- GIVEN invalid data (missing required fields) WHEN I POST /api/v1/variable-transactions THEN I receive 400 with field-level validation errors

**Test Requirements:**

- [ ] Test: GET variable transactions returns records with fields: transactionId, employeeId, payCodeId, periodId, amount, quantity, unit, status, submittedAt, description
- [ ] Test: POST creates a transaction and returns 201 with the created record
- [ ] Test: Filtering by periodId returns only matching period transactions
- [ ] Test: Filtering by employeeId returns only that employee's transactions
- [ ] Test: Validation rejects missing employeeId, payCodeId, or amount
- [ ] Test: Generated history includes overtime entries for sea site workers and processing shift workers

**Technical Notes:**

Variable transactions represent anything that varies per pay period: overtime hours, hourly work for part-timers, one-off bonuses, expense reimbursements. Period format follows Norwegian payroll periods (typically monthly: 2026-01, 2026-02, etc.). Status values: pending, approved, rejected, processed.

---

### Story 4: Accounting Transactions

**As a** developer integrating with Visma Payroll
**I want to** retrieve accounting transactions (payroll results) for ERP reconciliation
**So that** I can build financial reporting and reconciliation features

**Acceptance Criteria:**

- GIVEN the twin has data WHEN I GET /api/v1/accounting-transactions?periodId=:period THEN I receive aggregated payroll results for that period
- GIVEN the twin has data WHEN I GET /api/v1/accounting-transactions?periodId=:period&departmentId=:dept THEN I receive results filtered by department
- GIVEN the twin has data WHEN I GET /api/v1/accounting-transactions/:id THEN I receive a single accounting transaction with full debit/credit details

**Test Requirements:**

- [ ] Test: GET accounting transactions returns records with fields: transactionId, periodId, accountCode, departmentId, description, debitAmount, creditAmount, payCodeId, transactionDate
- [ ] Test: Filtering by period returns only matching transactions
- [ ] Test: Filtering by department returns correct subset
- [ ] Test: Debit and credit amounts balance within each period
- [ ] Test: Account codes follow Norwegian standard chart of accounts (kontoplan) patterns
- [ ] Test: Each department's total salary cost is proportional to its headcount

**Technical Notes:**

Accounting transactions are the output of a payroll run -- they represent journal entries for the ERP/accounting system. Each entry has a debit and credit side. Typical accounts: 5000-series (salary costs), 5400-series (employer social contributions/arbeidsgiveravgift), 2600-series (tax withholding liability), 2700-series (pension liability). The twin pre-generates these per period for all 6 months of history.

---

### Story 5: Expense Transactions (Read-Only)

**As a** developer integrating with Visma Expense
**I want to** retrieve travel, mileage, and expense reports with their workflow status
**So that** I can display expense data and track approval workflows

**Acceptance Criteria:**

- GIVEN the twin has data WHEN I GET /api/v1/expenses THEN I receive a paginated list of expense reports
- GIVEN the twin has data WHEN I GET /api/v1/expenses?employeeId=:id THEN I receive expenses for a specific employee
- GIVEN the twin has data WHEN I GET /api/v1/expenses?status=approved THEN I receive only approved expenses
- GIVEN the twin has data WHEN I GET /api/v1/expenses/:id THEN I receive the full expense report with line items
- GIVEN valid auth WHEN I POST /api/v1/expenses THEN I receive 405 Method Not Allowed (read-only twin for expenses)

**Test Requirements:**

- [ ] Test: GET expenses returns records with fields: expenseId, employeeId, type (travel/mileage/expense), description, totalAmount, currency, status, submittedAt, approvedAt, approverName, lineItems
- [ ] Test: Line items include: lineItemId, description, amount, category, receiptAttached, date
- [ ] Test: Expense types include travel (site visits between sea sites), mileage (Alesund to Vartdal trips), and general expenses
- [ ] Test: Status values include: draft, submitted, approved, rejected, reimbursed
- [ ] Test: POST returns 405 (expenses are read-only in the twin)
- [ ] Test: Filtering by status and employeeId works correctly

**Technical Notes:**

Expense API is read-only because the real integration only reads expense data (expense submission happens in Visma Expense app). Common expenses for Ode: travel between Alesund HQ and sea sites (boat/helicopter), mileage Alesund-Vartdal (~30 km), site inspection travel, conference attendance, safety equipment purchases. Currency is NOK.

---

### Story 6: Data Generation

**As a** developer
**I want to** have realistic pre-generated data matching Ode's organization
**So that** the twin provides a believable development environment

**Acceptance Criteria:**

- GIVEN the twin starts WHEN the data generator runs THEN it creates 150+ employees distributed across Ode departments
- GIVEN the generated data WHEN I inspect employees THEN departments match: Hatchery (~15), Sea Operations (~60 across 10 sites), Processing/Vartdal (~45), Sales (~10), Admin/HQ (~15), R&D (~10)
- GIVEN the generated data WHEN I inspect payroll history THEN 6 months of payroll periods exist with realistic amounts
- GIVEN the generated data WHEN I inspect variable transactions THEN overtime patterns reflect operational reality (more overtime during harvest seasons)
- GIVEN the generated data WHEN I inspect expenses THEN travel patterns reflect Alesund-based operations
- GIVEN the twin restarts WHEN data is regenerated with the same seed THEN identical data is produced

**Test Requirements:**

- [ ] Test: Employee count is 150+ distributed correctly across departments
- [ ] Test: Norwegian names are used (not English placeholder names)
- [ ] Test: Salary ranges are realistic for Norwegian aquaculture (base salary ~350,000-700,000 NOK/year depending on role)
- [ ] Test: 6 months of payroll history exists (e.g., 2025-10 through 2026-03)
- [ ] Test: Variable transactions include realistic overtime patterns
- [ ] Test: Expense data includes site-visit travel and Alesund-Vartdal mileage
- [ ] Test: Deterministic seeding produces identical output on re-run

**Technical Notes:**

Use the foundation data generation library. Norwegian naming conventions. Salary ranges: processing workers ~350,000-450,000 NOK/year, sea site operators ~450,000-550,000, technical/R&D ~500,000-650,000, management ~600,000-800,000. Seasonal variation in processing staff (higher headcount Oct-Mar for cod season). Overtime concentrated in sea operations and processing. Mileage rates follow Norwegian state rates (currently ~3.50 NOK/km for own car).

---

## Technical Design

### Data Model Changes

**Tables:**

| Table | Key Columns | Purpose |
|-------|------------|---------|
| employees | employeeId, firstName, lastName, departmentId, position, salary, employmentType, active | Employee master data |
| departments | departmentId, name, costCenter, siteLocation | Ode department structure |
| pay_codes | payCodeId, code, name, type, category, taxable | Salary component catalog |
| variable_transactions | transactionId, employeeId, payCodeId, periodId, amount, quantity, status | Per-period variable items |
| accounting_transactions | transactionId, periodId, accountCode, departmentId, debitAmount, creditAmount | Payroll journal entries |
| expenses | expenseId, employeeId, type, totalAmount, status, submittedAt | Expense reports |
| expense_line_items | lineItemId, expenseId, description, amount, category, date | Expense details |

### API Changes

Base path: `/api/v1`

| Method | Path | Description |
|--------|------|-------------|
| GET | /employees | List employees (paginated, filterable) |
| GET | /employees/:id | Get single employee |
| GET | /pay-codes | List pay codes (filterable by type) |
| GET | /pay-codes/:id | Get single pay code |
| GET | /variable-transactions | List variable transactions (filterable) |
| POST | /variable-transactions | Create variable transaction |
| GET | /variable-transactions/:id | Get single variable transaction |
| GET | /accounting-transactions | List accounting transactions (filterable) |
| GET | /accounting-transactions/:id | Get single accounting transaction |
| GET | /expenses | List expense reports (filterable) |
| GET | /expenses/:id | Get single expense with line items |

All endpoints return Visma-style response envelopes with pagination metadata where applicable.

### Dependencies

- Foundation auth library (bearer token authentication)
- Foundation data generation library (seeded random data)
- SQLite (data storage)
- Express.js (HTTP framework)

### Security Considerations

- All endpoints require valid bearer token (foundation auth)
- Bank account numbers in employee records are masked (show last 4 digits only)
- No real personal data -- all generated
- Rate limiting mimics Visma's production limits (informational, not enforced strictly)

---

## Implementation Order

### Group 1 (parallel -- foundational data and structure)
- Story 2: Pay codes endpoint -- creates the pay code catalog, no dependencies
- Story 1: Employee endpoint -- creates department + employee structure

### Group 2 (parallel -- depends on Group 1 for employees and pay codes)
- Story 3: Variable transactions -- depends on employees and pay codes existing
- Story 5: Expense transactions -- depends on employees existing

### Group 3 (sequential -- depends on Group 2 for variable transactions)
- Story 4: Accounting transactions -- depends on variable transactions and pay codes to generate realistic aggregations

### Group 4 (sequential -- depends on all above)
- Story 6: Data generation -- generates full 6-month history using all models, final integration

**Parallel safety rules:**
- Stories in the same group must touch DIFFERENT files/folders
- If two stories might edit the same file, they go in different groups
- Database migrations must be sequential (never parallel)
- Shared utilities/helpers: the story that creates them goes first

---

## Development Approach

### Simplifications (what starts simple)

- Authentication: simple bearer token from foundation library, not full OAuth 2.0 + Visma Connect flow
- Pagination: basic offset/limit, not cursor-based
- Payroll calculations: pre-generated results, not computed from variable transactions
- Error responses: match Visma shape but simplified field-level detail

### Upgrade Path (what changes for production)

- "Add OAuth 2.0 with Visma Connect token exchange" would be a separate story
- "Add webhook notifications for payroll run completion" would be a separate story
- "Add real-time payroll calculation engine" would be a separate story
- "Add salary slip PDF generation" would be a separate story

### Architecture Decisions

- Mirrored Visma's REST resource naming and response envelope structure so integration code works against both twin and real API
- Used SQLite for simplicity -- payroll data is read-heavy and the dataset is small enough
- Pre-generate accounting transactions rather than computing them on-read, since real Visma also returns pre-computed results from payroll runs
- Expense API is intentionally read-only to match real integration scope

---

## Verification Checklist

Before this feature is marked complete:

- [ ] All user stories implemented
- [ ] All acceptance criteria met
- [ ] All tests written and passing
- [ ] Tests verify real behavior (not just status codes)
- [ ] Edge cases handled
- [ ] No regressions in existing tests
- [ ] Code committed with proper messages
- [ ] Response shapes match documented Visma API patterns
- [ ] 150+ employees with realistic Norwegian data
- [ ] 6 months payroll history generated
- [ ] Ready for human review
