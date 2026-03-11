import Database from 'better-sqlite3';

export interface Department {
  departmentId: string;
  name: string;
  costCenter: string;
  siteLocation: string;
}

export interface Employee {
  employeeId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  email: string;
  departmentId: string;
  employmentStartDate: string;
  employmentType: 'full-time' | 'part-time' | 'seasonal';
  position: string;
  salary: number;
  taxTable: string;
  taxPercentage: number;
  bankAccount: string;
  active: number;
}

export interface PayCode {
  payCodeId: string;
  code: string;
  name: string;
  type: 'addition' | 'deduction';
  description: string;
  unit: string;
  rate: number | null;
}

export interface VariableTransaction {
  transactionId: string;
  employeeId: string;
  payCodeId: string;
  periodId: string;
  amount: number;
  quantity: number | null;
  unit: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'processed';
  submittedAt: string;
  description: string | null;
}

export interface Expense {
  expenseId: string;
  employeeId: string;
  type: 'travel' | 'mileage' | 'expense';
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'reimbursed';
  submittedAt: string;
  approvedAt: string | null;
  totalAmount: number;
  currency: string;
  description: string;
  periodId: string;
}

export interface ExpenseLineItem {
  lineItemId: string;
  expenseId: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  receiptUrl: string | null;
  mileageKm: number | null;
  mileageRate: number | null;
}

export interface AccountingTransaction {
  transactionId: string;
  periodId: string;
  accountCode: string;
  departmentId: string;
  description: string;
  debitAmount: number;
  creditAmount: number;
  payCodeId: string | null;
  transactionDate: string;
}

export function createDatabase(filename: string = ':memory:'): Database.Database {
  const db = new Database(filename);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS departments (
      departmentId TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      costCenter TEXT,
      siteLocation TEXT
    );

    CREATE TABLE IF NOT EXISTS employees (
      employeeId TEXT PRIMARY KEY,
      firstName TEXT NOT NULL,
      lastName TEXT NOT NULL,
      dateOfBirth TEXT NOT NULL,
      email TEXT NOT NULL,
      departmentId TEXT NOT NULL,
      employmentStartDate TEXT NOT NULL,
      employmentType TEXT NOT NULL CHECK(employmentType IN ('full-time', 'part-time', 'seasonal')),
      position TEXT NOT NULL,
      salary REAL NOT NULL,
      taxTable TEXT NOT NULL DEFAULT '7100',
      taxPercentage REAL NOT NULL DEFAULT 30.0,
      bankAccount TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (departmentId) REFERENCES departments(departmentId)
    );

    CREATE TABLE IF NOT EXISTS pay_codes (
      payCodeId TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('addition', 'deduction')),
      description TEXT NOT NULL,
      unit TEXT NOT NULL DEFAULT 'NOK',
      rate REAL
    );

    CREATE TABLE IF NOT EXISTS variable_transactions (
      transactionId TEXT PRIMARY KEY,
      employeeId TEXT NOT NULL,
      payCodeId TEXT NOT NULL,
      periodId TEXT NOT NULL,
      amount REAL NOT NULL,
      quantity REAL,
      unit TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'processed')),
      submittedAt TEXT NOT NULL,
      description TEXT,
      FOREIGN KEY (employeeId) REFERENCES employees(employeeId),
      FOREIGN KEY (payCodeId) REFERENCES pay_codes(payCodeId)
    );

    CREATE TABLE IF NOT EXISTS expenses (
      expenseId TEXT PRIMARY KEY,
      employeeId TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('travel', 'mileage', 'expense')),
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'submitted', 'approved', 'rejected', 'reimbursed')),
      submittedAt TEXT NOT NULL,
      approvedAt TEXT,
      totalAmount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'NOK',
      description TEXT NOT NULL,
      periodId TEXT NOT NULL,
      FOREIGN KEY (employeeId) REFERENCES employees(employeeId)
    );

    CREATE TABLE IF NOT EXISTS expense_line_items (
      lineItemId TEXT PRIMARY KEY,
      expenseId TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      date TEXT NOT NULL,
      receiptUrl TEXT,
      mileageKm REAL,
      mileageRate REAL,
      FOREIGN KEY (expenseId) REFERENCES expenses(expenseId)
    );

    CREATE TABLE IF NOT EXISTS accounting_transactions (
      transactionId TEXT PRIMARY KEY,
      periodId TEXT NOT NULL,
      accountCode TEXT NOT NULL,
      departmentId TEXT NOT NULL,
      description TEXT NOT NULL,
      debitAmount REAL NOT NULL DEFAULT 0,
      creditAmount REAL NOT NULL DEFAULT 0,
      payCodeId TEXT,
      transactionDate TEXT NOT NULL,
      FOREIGN KEY (departmentId) REFERENCES departments(departmentId)
    );

    CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(departmentId);
    CREATE INDEX IF NOT EXISTS idx_variable_transactions_period ON variable_transactions(periodId);
    CREATE INDEX IF NOT EXISTS idx_variable_transactions_employee ON variable_transactions(employeeId);
    CREATE INDEX IF NOT EXISTS idx_expenses_employee ON expenses(employeeId);
    CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);
    CREATE INDEX IF NOT EXISTS idx_accounting_period ON accounting_transactions(periodId);
    CREATE INDEX IF NOT EXISTS idx_accounting_department ON accounting_transactions(departmentId);
  `);

  return db;
}
