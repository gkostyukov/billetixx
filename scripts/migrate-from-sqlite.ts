import { PrismaClient } from '@prisma/client';
import Database from 'better-sqlite3';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const sqlite = new Database('./tgts.sqlite3', { readonly: true });

interface SQLiteUser {
  id: number;
  username: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  date_joined: string;
}

interface SQLiteCategory {
  id: number;
  name: string;
  active: boolean;
  description: string | null;
}

interface SQLiteBill {
  id: number;
  from_source: string;
  balance: number;
  statement_balance: number;
  min_payment: number;
  available_to_spend: number;
  credit_limit: number;
  autopay: boolean;
  apr: number;
  due_day_of_month: number;
  active: boolean;
  fully_paid: boolean;
  description: string;
  comment: string | null;
  category_id: number;
  user_id: number;
}

interface SQLiteCreditCard {
  id: number;
  name: string;
  number: string;
  balance: number;
  credit_limit: number;
  available_amount: number;
  due_date: string;
  apr: number;
  active: boolean;
  notes: string | null;
  min_payment: number;
  autopay: boolean;
  user_id: number;
}

interface SQLiteDebt {
  id: number;
  due_date: string | null;
  amount: number;
  active: boolean;
  notes: string | null;
  balance: number;
  post_date: string | null;
  trans_date: string | null;
  whom_i_owe: string;
  description: string;
  user_id: number;
}

interface SQLiteExpense {
  id: number;
  date: string;
  amount: number;
  type: string;
  active: boolean;
  category_id: number;
  description: string;
  user_id: number;
  from_source: string | null;
}

interface SQLiteIncome {
  id: number;
  source: string;
  amount: number;
  date: string;
  active: boolean;
  user_id: number;
}

interface SQLitePayment {
  id: number;
  due_date: string;
  amount: number;
  from_source: string;
  balance: number;
  min_payment: number;
  autopay: boolean;
  bill_id: number | null;
  paid: boolean;
  is_income: boolean;
  active: boolean;
  description: string;
  comment: string | null;
  category_id: number;
  user_id: number;
  source_type: string | null;
  source_ref_id: number | null;
}

const userIdMap = new Map<number, string>();
const categoryMap = new Map<number, string>();

async function migrateUsers() {
  console.log('Migrating users...');
  const users = sqlite.prepare('SELECT * FROM auth_user').all() as SQLiteUser[];

  for (const user of users) {
    try {
      const newUser = await prisma.user.create({
        data: {
          email: user.email || `user${user.id}@example.com`,
          name: `${user.first_name} ${user.last_name}`.trim() || user.username,
          password: user.password, // Already hashed in Django
        },
      });
      userIdMap.set(user.id, newUser.id);
      console.log(`✓ Migrated user: ${user.username} (${user.id} -> ${newUser.id})`);
    } catch (error) {
      console.error(`✗ Failed to migrate user ${user.username}:`, error);
    }
  }
  console.log(`Migrated ${userIdMap.size} users\n`);
}

async function migrateCategories() {
  console.log('Analyzing categories...');
  const categories = sqlite.prepare('SELECT * FROM budget_category').all() as SQLiteCategory[];

  for (const cat of categories) {
    categoryMap.set(cat.id, cat.name);
    console.log(`  Category ${cat.id}: ${cat.name}`);
  }
  console.log(`Found ${categoryMap.size} categories\n`);
}

async function migrateBills() {
  console.log('Migrating bills...');
  const bills = sqlite.prepare('SELECT * FROM budget_bill').all() as SQLiteBill[];
  let count = 0;

  for (const bill of bills) {
    try {
      const newUserId = userIdMap.get(bill.user_id);
      if (!newUserId) {
        console.log(`⚠ Skipping bill ${bill.id}: user not found`);
        continue;
      }

      await prisma.bill.create({
        data: {
          title: bill.from_source,
          amount: Number(bill.min_payment),  // Using min_payment as the main amount
          dueDate: new Date(new Date().getFullYear(), new Date().getMonth(), bill.due_day_of_month),
          dueDayOfMonth: bill.due_day_of_month,
          status: bill.fully_paid ? 'paid' : 'pending',
          category: categoryMap.get(bill.category_id) || 'Uncategorized',
          description: bill.description || '',
          comment: bill.comment,
          fromSource: bill.from_source,
          balance: Number(bill.balance),
          minPayment: Number(bill.min_payment),
          active: bill.active,
          fullyPaid: bill.fully_paid,
          userId: newUserId,
        },
      });
      count++;
    } catch (error) {
      console.error(`✗ Failed to migrate bill ${bill.id}:`, error);
    }
  }
  console.log(`✓ Migrated ${count} bills\n`);
}

async function migrateCreditCards() {
  console.log('Migrating credit cards...');
  const cards = sqlite.prepare('SELECT * FROM budget_creditcard').all() as SQLiteCreditCard[];
  let count = 0;

  for (const card of cards) {
    try {
      const newUserId = userIdMap.get(card.user_id);
      if (!newUserId) {
        console.log(`⚠ Skipping credit card ${card.id}: user not found`);
        continue;
      }

      const lastFour = card.number.slice(-4);
      await prisma.creditCard.create({
        data: {
          name: card.name,
          lastFourDigits: lastFour,
          creditLimit: Number(card.credit_limit),
          currentBalance: Number(card.balance),
          dueDate: new Date(card.due_date).getDate(),
          userId: newUserId,
        },
      });
      count++;
    } catch (error) {
      console.error(`✗ Failed to migrate credit card ${card.id}:`, error);
    }
  }
  console.log(`✓ Migrated ${count} credit cards\n`);
}

async function migrateDebts() {
  console.log('Migrating debts...');
  const debts = sqlite.prepare('SELECT * FROM budget_debt').all() as SQLiteDebt[];
  let count = 0;

  for (const debt of debts) {
    try {
      const newUserId = userIdMap.get(debt.user_id);
      if (!newUserId) {
        console.log(`⚠ Skipping debt ${debt.id}: user not found`);
        continue;
      }

      await prisma.debt.create({
        data: {
          title: debt.description,
          totalAmount: Number(debt.amount),
          remainingAmount: Number(debt.balance),
          creditor: debt.whom_i_owe,
          dueDate: debt.due_date ? new Date(debt.due_date) : null,
          status: debt.active ? 'active' : 'paid',
          userId: newUserId,
        },
      });
      count++;
    } catch (error) {
      console.error(`✗ Failed to migrate debt ${debt.id}:`, error);
    }
  }
  console.log(`✓ Migrated ${count} debts\n`);
}

async function migrateExpenses() {
  console.log('Migrating expenses...');
  const expenses = sqlite.prepare('SELECT * FROM budget_expense WHERE active = 1').all() as SQLiteExpense[];
  let count = 0;

  for (const expense of expenses) {
    try {
      const newUserId = userIdMap.get(expense.user_id);
      if (!newUserId) {
        console.log(`⚠ Skipping expense ${expense.id}: user not found`);
        continue;
      }

      await prisma.expense.create({
        data: {
          title: expense.description,
          amount: Number(expense.amount),
          date: new Date(expense.date),
          category: categoryMap.get(expense.category_id) || expense.type || 'Uncategorized',
          description: expense.from_source || undefined,
          userId: newUserId,
        },
      });
      count++;
    } catch (error) {
      console.error(`✗ Failed to migrate expense ${expense.id}:`, error);
    }
  }
  console.log(`✓ Migrated ${count} expenses\n`);
}

async function migrateIncomes() {
  console.log('Migrating incomes...');
  const incomes = sqlite.prepare('SELECT * FROM budget_income WHERE active = 1').all() as SQLiteIncome[];
  let count = 0;

  for (const income of incomes) {
    try {
      const newUserId = userIdMap.get(income.user_id);
      if (!newUserId) {
        console.log(`⚠ Skipping income ${income.id}: user not found`);
        continue;
      }

      await prisma.income.create({
        data: {
          title: income.source,
          amount: Number(income.amount),
          date: new Date(income.date),
          source: income.source,
          userId: newUserId,
        },
      });
      count++;
    } catch (error) {
      console.error(`✗ Failed to migrate income ${income.id}:`, error);
    }
  }
  console.log(`✓ Migrated ${count} incomes\n`);
}

async function migratePayments() {
  console.log('Migrating payments...');
  const payments = sqlite.prepare('SELECT * FROM budget_payment WHERE active = 1').all() as SQLitePayment[];
  let count = 0;

  for (const payment of payments) {
    try {
      const newUserId = userIdMap.get(payment.user_id);
      if (!newUserId) {
        console.log(`⚠ Skipping payment ${payment.id}: user not found`);
        continue;
      }

      await prisma.payment.create({
        data: {
          title: payment.description,
          amount: Number(payment.amount),
          paymentDate: new Date(payment.due_date),
          method: payment.from_source,
          category: categoryMap.get(payment.category_id) || 'Uncategorized',
          description: payment.comment || undefined,
          userId: newUserId,
        },
      });
      count++;
    } catch (error) {
      console.error(`✗ Failed to migrate payment ${payment.id}:`, error);
    }
  }
  console.log(`✓ Migrated ${count} payments\n`);
}

async function main() {
  console.log('🚀 Starting migration from SQLite to PostgreSQL\n');
  console.log('=' .repeat(60));

  try {
    await migrateUsers();
    await migrateCategories();
    await migrateBills();
    await migrateCreditCards();
    await migrateDebts();
    await migrateExpenses();
    await migrateIncomes();
    await migratePayments();

    console.log('=' .repeat(60));
    console.log('✅ Migration completed successfully!\n');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    sqlite.close();
  }
}

main();
