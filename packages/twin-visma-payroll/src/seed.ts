import Database from 'better-sqlite3';
import { ode, generatePerson } from '@ode/twin-foundation';
import { faker } from '@faker-js/faker/locale/nb_NO';
import crypto from 'node:crypto';

// Department definitions for Ode
const DEPARTMENTS = [
  { departmentId: 'dept-hatchery', name: 'Hatchery', costCenter: 'CC-100', siteLocation: 'Hjelmeland' },
  { departmentId: 'dept-sea-ops', name: 'Sea Operations', costCenter: 'CC-200', siteLocation: 'Nordfjord' },
  { departmentId: 'dept-processing', name: 'Processing/Vartdal', costCenter: 'CC-300', siteLocation: 'Vartdal' },
  { departmentId: 'dept-sales', name: 'Sales', costCenter: 'CC-400', siteLocation: 'Ålesund' },
  { departmentId: 'dept-admin', name: 'Admin/HQ', costCenter: 'CC-500', siteLocation: 'Ålesund' },
  { departmentId: 'dept-rnd', name: 'R&D', costCenter: 'CC-600', siteLocation: 'Ålesund' },
] as const;

// Employee count targets per department
const DEPT_EMPLOYEE_COUNTS: Record<string, number> = {
  'dept-hatchery': 15,
  'dept-sea-ops': 60,
  'dept-processing': 45,
  'dept-sales': 10,
  'dept-admin': 15,
  'dept-rnd': 10,
};

// Salary ranges (yearly NOK) per department
const SALARY_RANGES: Record<string, { min: number; max: number }> = {
  'dept-hatchery': { min: 380000, max: 520000 },
  'dept-sea-ops': { min: 450000, max: 550000 },
  'dept-processing': { min: 350000, max: 450000 },
  'dept-sales': { min: 480000, max: 650000 },
  'dept-admin': { min: 500000, max: 800000 },
  'dept-rnd': { min: 500000, max: 650000 },
};

// Positions per department
const POSITIONS: Record<string, string[]> = {
  'dept-hatchery': ['Hatchery Technician', 'Hatchery Manager', 'Feed Technician', 'Water Quality Specialist', 'Broodstock Manager'],
  'dept-sea-ops': ['Site Manager', 'Net Pen Operator', 'Diver', 'Wellboat Crew', 'Feed Operator', 'Environmental Monitor', 'Shift Leader', 'Sea Site Technician'],
  'dept-processing': ['Processing Worker', 'Quality Inspector', 'Line Supervisor', 'Cold Storage Operator', 'Packing Operator', 'Machine Operator', 'Processing Manager'],
  'dept-sales': ['Sales Manager', 'Account Executive', 'Export Coordinator', 'Customer Service Representative'],
  'dept-admin': ['CEO', 'CFO', 'HR Manager', 'Office Administrator', 'IT Manager', 'Controller', 'Accountant', 'Receptionist'],
  'dept-rnd': ['R&D Manager', 'Marine Biologist', 'Feed Researcher', 'Data Analyst', 'Lab Technician'],
};

// Pay codes
const PAY_CODES = [
  { payCodeId: 'pc-fastlonn', code: '1000', name: 'Fastlønn', type: 'addition', description: 'Base monthly salary', unit: 'NOK', rate: null },
  { payCodeId: 'pc-overtid-50', code: '1020', name: 'Overtid 50%', type: 'addition', description: 'Overtime at 50% premium', unit: 'hours', rate: 1.5 },
  { payCodeId: 'pc-overtid-100', code: '1030', name: 'Overtid 100%', type: 'addition', description: 'Overtime at 100% premium', unit: 'hours', rate: 2.0 },
  { payCodeId: 'pc-sjotillegg', code: '1040', name: 'Sjøtillegg', type: 'addition', description: 'Sea allowance for offshore work', unit: 'days', rate: 450 },
  { payCodeId: 'pc-skifttillegg', code: '1050', name: 'Skifttillegg', type: 'addition', description: 'Shift premium for non-standard hours', unit: 'hours', rate: 55 },
  { payCodeId: 'pc-feriepenger', code: '1060', name: 'Feriepenger', type: 'addition', description: 'Holiday pay accrual (10.2%)', unit: 'NOK', rate: null },
  { payCodeId: 'pc-cold-storage', code: '1070', name: 'Kuldetillegg', type: 'addition', description: 'Cold storage premium', unit: 'hours', rate: 35 },
  { payCodeId: 'pc-offshore-bonus', code: '1080', name: 'Offshore/sjøtillegg bonus', type: 'addition', description: 'Offshore/sea site bonus', unit: 'NOK', rate: null },
  { payCodeId: 'pc-skattetrekk', code: '5000', name: 'Skattetrekk', type: 'deduction', description: 'Tax deduction based on tax card', unit: 'NOK', rate: null },
  { payCodeId: 'pc-pensjon', code: '5100', name: 'Pensjon', type: 'deduction', description: 'Pension contribution (2%)', unit: 'NOK', rate: null },
  { payCodeId: 'pc-fagforening', code: '5200', name: 'Fagforeningskontingent', type: 'deduction', description: 'Union membership fees', unit: 'NOK', rate: null },
] as const;

const PERIODS = ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03'];

// Accounting codes
const ACCOUNT_CODES = {
  salary: '5000',
  overtimePay: '5010',
  seaAllowance: '5020',
  shiftPremium: '5030',
  holidayPay: '5080',
  coldStorage: '5040',
  offshoreBonus: '5050',
  employerSocial: '5400',
  taxWithholding: '2600',
  pensionContrib: '2700',
  unionFees: '2710',
};

function generateBankAccount(): string {
  // Norwegian bank account: 4 digit bank code + 7 digits
  const bankCode = faker.string.numeric(4);
  const account = faker.string.numeric(7);
  return `${bankCode}${account}`;
}

function maskBankAccount(account: string): string {
  return `****${account.slice(-4)}`;
}

export function seedDatabase(db: Database.Database, seed: number = 42): void {
  ode.seed(seed);
  faker.seed(seed);

  // Insert departments
  const insertDept = db.prepare(
    'INSERT INTO departments (departmentId, name, costCenter, siteLocation) VALUES (?, ?, ?, ?)'
  );
  for (const dept of DEPARTMENTS) {
    insertDept.run(dept.departmentId, dept.name, dept.costCenter, dept.siteLocation);
  }

  // Insert pay codes
  const insertPayCode = db.prepare(
    'INSERT INTO pay_codes (payCodeId, code, name, type, description, unit, rate) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  for (const pc of PAY_CODES) {
    insertPayCode.run(pc.payCodeId, pc.code, pc.name, pc.type, pc.description, pc.unit, pc.rate);
  }

  // Generate employees
  const insertEmployee = db.prepare(
    `INSERT INTO employees (employeeId, firstName, lastName, dateOfBirth, email, departmentId,
     employmentStartDate, employmentType, position, salary, taxTable, taxPercentage, bankAccount, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const allEmployeeIds: { employeeId: string; departmentId: string; salary: number }[] = [];

  for (const dept of DEPARTMENTS) {
    const count = DEPT_EMPLOYEE_COUNTS[dept.departmentId];
    const salaryRange = SALARY_RANGES[dept.departmentId];
    const positions = POSITIONS[dept.departmentId];

    for (let i = 0; i < count; i++) {
      const person = generatePerson();
      const employeeId = crypto.randomUUID();
      const dob = faker.date.between({ from: '1965-01-01', to: '2000-12-31' }).toISOString().split('T')[0];
      const startDate = faker.date.between({ from: '2018-01-01', to: '2025-09-01' }).toISOString().split('T')[0];
      const salary = Math.round(faker.number.int({ min: salaryRange.min, max: salaryRange.max }) / 1000) * 1000;
      const position = positions[i % positions.length];

      // Most are full-time, some part-time or seasonal
      let employmentType: string = 'full-time';
      if (dept.departmentId === 'dept-processing' && i >= count - 5) {
        employmentType = 'seasonal';
      } else if (i >= count - 2) {
        employmentType = 'part-time';
      }

      const taxTable = faker.helpers.arrayElement(['7100', '7101', '7102', '7150']);
      const taxPercentage = faker.number.float({ min: 25, max: 42, fractionDigits: 1 });
      const bankAccount = generateBankAccount();
      const active = i < count - 1 ? 1 : (faker.datatype.boolean(0.85) ? 1 : 0);

      // Generate a proper company email
      const normalizeChar = (s: string) =>
        s.toLowerCase().replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a');
      const email = `${normalizeChar(person.firstName)}.${normalizeChar(person.lastName)}@ode.no`;

      insertEmployee.run(
        employeeId, person.firstName, person.lastName, dob, email,
        dept.departmentId, startDate, employmentType, position,
        salary, taxTable, taxPercentage, bankAccount, active
      );

      allEmployeeIds.push({ employeeId, departmentId: dept.departmentId, salary });
    }
  }

  // Generate variable transactions
  const insertVarTx = db.prepare(
    `INSERT INTO variable_transactions (transactionId, employeeId, payCodeId, periodId, amount, quantity, unit, status, submittedAt, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const seaOpsEmployees = allEmployeeIds.filter(e => e.departmentId === 'dept-sea-ops');
  const processingEmployees = allEmployeeIds.filter(e => e.departmentId === 'dept-processing');

  for (const period of PERIODS) {
    const [year, month] = period.split('-').map(Number);

    // Sea ops overtime (most get some overtime)
    for (const emp of seaOpsEmployees) {
      if (faker.datatype.boolean(0.7)) {
        const hours50 = faker.number.float({ min: 2, max: 20, fractionDigits: 1 });
        const hourlyRate = emp.salary / 1950; // ~1950 working hours/year
        insertVarTx.run(
          crypto.randomUUID(), emp.employeeId, 'pc-overtid-50', period,
          Math.round(hourlyRate * 1.5 * hours50 * 100) / 100, hours50, 'hours',
          period < '2026-02' ? 'processed' : (period === '2026-02' ? 'approved' : 'pending'),
          new Date(year, month - 1, faker.number.int({ min: 25, max: 28 })).toISOString(),
          `Overtime work - ${period}`
        );
      }

      // Sea allowance for sea ops
      if (faker.datatype.boolean(0.6)) {
        const days = faker.number.int({ min: 5, max: 15 });
        insertVarTx.run(
          crypto.randomUUID(), emp.employeeId, 'pc-sjotillegg', period,
          days * 450, days, 'days',
          period < '2026-02' ? 'processed' : (period === '2026-02' ? 'approved' : 'pending'),
          new Date(year, month - 1, faker.number.int({ min: 25, max: 28 })).toISOString(),
          `Sea allowance - ${days} days offshore`
        );
      }
    }

    // Processing overtime and cold storage
    for (const emp of processingEmployees) {
      if (faker.datatype.boolean(0.5)) {
        const hours50 = faker.number.float({ min: 2, max: 15, fractionDigits: 1 });
        const hourlyRate = emp.salary / 1950;
        insertVarTx.run(
          crypto.randomUUID(), emp.employeeId, 'pc-overtid-50', period,
          Math.round(hourlyRate * 1.5 * hours50 * 100) / 100, hours50, 'hours',
          period < '2026-02' ? 'processed' : (period === '2026-02' ? 'approved' : 'pending'),
          new Date(year, month - 1, faker.number.int({ min: 25, max: 28 })).toISOString(),
          `Processing overtime - ${period}`
        );
      }

      // Cold storage premium
      if (faker.datatype.boolean(0.4)) {
        const hours = faker.number.float({ min: 10, max: 60, fractionDigits: 1 });
        insertVarTx.run(
          crypto.randomUUID(), emp.employeeId, 'pc-cold-storage', period,
          hours * 35, hours, 'hours',
          period < '2026-02' ? 'processed' : (period === '2026-02' ? 'approved' : 'pending'),
          new Date(year, month - 1, faker.number.int({ min: 25, max: 28 })).toISOString(),
          `Cold storage work - ${hours}h`
        );
      }

      // Shift premium
      if (faker.datatype.boolean(0.3)) {
        const hours = faker.number.float({ min: 10, max: 40, fractionDigits: 1 });
        insertVarTx.run(
          crypto.randomUUID(), emp.employeeId, 'pc-skifttillegg', period,
          hours * 55, hours, 'hours',
          period < '2026-02' ? 'processed' : (period === '2026-02' ? 'approved' : 'pending'),
          new Date(year, month - 1, faker.number.int({ min: 25, max: 28 })).toISOString(),
          `Shift premium - evening/night shifts`
        );
      }
    }
  }

  // Generate expenses
  const insertExpense = db.prepare(
    `INSERT INTO expenses (expenseId, employeeId, type, status, submittedAt, approvedAt, totalAmount, currency, description, periodId)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const insertLineItem = db.prepare(
    `INSERT INTO expense_line_items (lineItemId, expenseId, description, amount, category, date, receiptUrl, mileageKm, mileageRate)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const expenseDescriptions = {
    travel: [
      'Site visit to Nordfjord sea farm',
      'Customer meeting in Bergen',
      'Conference attendance - AquaNor Trondheim',
      'Supplier meeting in Oslo',
      'Quality audit at Vartdal plant',
      'Training course in Stavanger',
    ],
    mileage: [
      'Ålesund - Vartdal (processing plant visit)',
      'Ålesund - Hjelmeland (hatchery inspection)',
      'Site inspection - Nordfjord',
      'Equipment delivery to sea site',
    ],
    expense: [
      'Safety equipment - cold storage gear',
      'Office supplies',
      'Client dinner - Bergen',
      'Lab supplies - water testing kits',
      'Team building event',
      'Professional certification renewal',
    ],
  };

  // Generate expenses for a subset of employees across periods
  for (const period of PERIODS) {
    const [year, month] = period.split('-').map(Number);

    // ~20% of employees file expenses per period
    const expenseEmployees = faker.helpers.arrayElements(allEmployeeIds, Math.floor(allEmployeeIds.length * 0.2));

    for (const emp of expenseEmployees) {
      const expenseType = faker.helpers.weightedArrayElement([
        { weight: 40, value: 'travel' as const },
        { weight: 35, value: 'mileage' as const },
        { weight: 25, value: 'expense' as const },
      ]);

      const expenseId = crypto.randomUUID();
      const submitDate = new Date(year, month - 1, faker.number.int({ min: 1, max: 25 }));
      const description = faker.helpers.arrayElement(expenseDescriptions[expenseType]);

      let totalAmount = 0;
      const lineItems: Array<{
        description: string; amount: number; category: string;
        date: string; receiptUrl: string | null; mileageKm: number | null; mileageRate: number | null;
      }> = [];

      if (expenseType === 'mileage') {
        const km = faker.helpers.weightedArrayElement([
          { weight: 50, value: faker.number.float({ min: 25, max: 35, fractionDigits: 1 }) }, // Ålesund-Vartdal ~30km
          { weight: 30, value: faker.number.float({ min: 100, max: 300, fractionDigits: 1 }) },
          { weight: 20, value: faker.number.float({ min: 300, max: 600, fractionDigits: 1 }) },
        ]);
        const mileageRate = 3.50;
        const amount = Math.round(km * mileageRate * 100) / 100;
        totalAmount = amount;
        lineItems.push({
          description, amount, category: 'mileage',
          date: submitDate.toISOString().split('T')[0],
          receiptUrl: null, mileageKm: km, mileageRate,
        });
      } else if (expenseType === 'travel') {
        // Hotel
        const hotelNights = faker.number.int({ min: 1, max: 3 });
        const hotelCost = hotelNights * faker.number.int({ min: 900, max: 1800 });
        lineItems.push({
          description: `Hotel - ${hotelNights} night${hotelNights > 1 ? 's' : ''}`,
          amount: hotelCost, category: 'accommodation',
          date: submitDate.toISOString().split('T')[0],
          receiptUrl: `https://receipts.ode.no/${crypto.randomUUID()}.pdf`,
          mileageKm: null, mileageRate: null,
        });
        totalAmount += hotelCost;

        // Transport
        const transportCost = faker.number.int({ min: 200, max: 3500 });
        lineItems.push({
          description: 'Flight/transport', amount: transportCost, category: 'transport',
          date: submitDate.toISOString().split('T')[0],
          receiptUrl: `https://receipts.ode.no/${crypto.randomUUID()}.pdf`,
          mileageKm: null, mileageRate: null,
        });
        totalAmount += transportCost;

        // Meals
        const mealDays = hotelNights + 1;
        const mealCost = mealDays * faker.number.int({ min: 200, max: 500 });
        lineItems.push({
          description: `Meals - ${mealDays} days`, amount: mealCost, category: 'meals',
          date: submitDate.toISOString().split('T')[0],
          receiptUrl: `https://receipts.ode.no/${crypto.randomUUID()}.pdf`,
          mileageKm: null, mileageRate: null,
        });
        totalAmount += mealCost;
      } else {
        const amount = faker.number.int({ min: 200, max: 5000 });
        totalAmount = amount;
        lineItems.push({
          description, amount, category: 'general',
          date: submitDate.toISOString().split('T')[0],
          receiptUrl: `https://receipts.ode.no/${crypto.randomUUID()}.pdf`,
          mileageKm: null, mileageRate: null,
        });
      }

      // Determine status based on period
      let status: string;
      let approvedAt: string | null = null;
      if (period < '2025-12') {
        status = 'reimbursed';
        approvedAt = new Date(year, month - 1, faker.number.int({ min: 26, max: 28 })).toISOString();
      } else if (period === '2025-12') {
        status = faker.helpers.arrayElement(['approved', 'reimbursed']);
        approvedAt = new Date(year, month - 1, faker.number.int({ min: 26, max: 28 })).toISOString();
      } else if (period === '2026-01') {
        status = faker.helpers.arrayElement(['approved', 'submitted']);
        if (status === 'approved') {
          approvedAt = new Date(year, month - 1, faker.number.int({ min: 26, max: 28 })).toISOString();
        }
      } else {
        status = faker.helpers.weightedArrayElement([
          { weight: 30, value: 'submitted' },
          { weight: 20, value: 'draft' },
          { weight: 10, value: 'rejected' },
          { weight: 40, value: 'approved' },
        ]);
        if (status === 'approved') {
          approvedAt = new Date(year, month - 1, faker.number.int({ min: 26, max: 28 })).toISOString();
        }
      }

      insertExpense.run(
        expenseId, emp.employeeId, expenseType, status,
        submitDate.toISOString(), approvedAt,
        totalAmount, 'NOK', description, period
      );

      for (const item of lineItems) {
        insertLineItem.run(
          crypto.randomUUID(), expenseId, item.description, item.amount,
          item.category, item.date, item.receiptUrl, item.mileageKm, item.mileageRate
        );
      }
    }
  }

  // Generate accounting transactions
  const insertAcctTx = db.prepare(
    `INSERT INTO accounting_transactions (transactionId, periodId, accountCode, departmentId, description, debitAmount, creditAmount, payCodeId, transactionDate)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const period of PERIODS) {
    const [year, month] = period.split('-').map(Number);
    const txDate = new Date(year, month - 1, 28).toISOString().split('T')[0];

    for (const dept of DEPARTMENTS) {
      const deptEmployees = allEmployeeIds.filter(e => e.departmentId === dept.departmentId);
      if (deptEmployees.length === 0) continue;

      // Total base salary for department
      const totalMonthlySalary = deptEmployees.reduce((sum, e) => sum + e.salary / 12, 0);
      const roundedSalary = Math.round(totalMonthlySalary * 100) / 100;

      // Debit: Salary expense (5000)
      insertAcctTx.run(
        crypto.randomUUID(), period, ACCOUNT_CODES.salary, dept.departmentId,
        `Monthly salary - ${dept.name}`, roundedSalary, 0, 'pc-fastlonn', txDate
      );

      // Credit: Tax withholding (2600) - ~30% average
      const taxAmount = Math.round(roundedSalary * 0.30 * 100) / 100;
      insertAcctTx.run(
        crypto.randomUUID(), period, ACCOUNT_CODES.taxWithholding, dept.departmentId,
        `Tax withholding - ${dept.name}`, 0, taxAmount, 'pc-skattetrekk', txDate
      );

      // Credit: Pension (2700) - 2%
      const pensionAmount = Math.round(roundedSalary * 0.02 * 100) / 100;
      insertAcctTx.run(
        crypto.randomUUID(), period, ACCOUNT_CODES.pensionContrib, dept.departmentId,
        `Pension contribution - ${dept.name}`, 0, pensionAmount, 'pc-pensjon', txDate
      );

      // Debit: Employer social contributions (5400) - 14.1%
      const socialAmount = Math.round(roundedSalary * 0.141 * 100) / 100;
      insertAcctTx.run(
        crypto.randomUUID(), period, ACCOUNT_CODES.employerSocial, dept.departmentId,
        `Employer social contributions - ${dept.name}`, socialAmount, 0, null, txDate
      );

      // Credit: Union fees (2710) - small amount
      const unionAmount = Math.round(deptEmployees.length * 350);
      insertAcctTx.run(
        crypto.randomUUID(), period, ACCOUNT_CODES.unionFees, dept.departmentId,
        `Union fees - ${dept.name}`, 0, unionAmount, 'pc-fagforening', txDate
      );

      // Credit: Net pay (balance to bank) - salary minus deductions
      const netPay = Math.round((roundedSalary + socialAmount - taxAmount - pensionAmount - unionAmount) * 100) / 100;
      insertAcctTx.run(
        crypto.randomUUID(), period, '1920', dept.departmentId,
        `Net salary payment - ${dept.name}`, 0, netPay, null, txDate
      );
    }
  }
}

export { DEPARTMENTS, PAY_CODES, PERIODS, DEPT_EMPLOYEE_COUNTS, maskBankAccount };
