import { PrismaClient } from '@prisma/client';
import Database from 'better-sqlite3';

const prisma = new PrismaClient();
const sqlite = new Database('./tgts.sqlite3', { readonly: true });

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

interface SQLiteCategory {
  id: number;
  name: string;
}

interface SQLiteUser {
  id: number;
  email: string;
}

async function main() {
  console.log('🔄 Migrating bills from SQLite to PostgreSQL...\n');

  // Get user mapping
  const userIdMap = new Map<number, string>();
  const users = await prisma.user.findMany();
  const sqliteUsers = sqlite.prepare('SELECT * FROM auth_user').all() as SQLiteUser[];
  
  for (const sqlUser of sqliteUsers) {
    const newUser = users.find(u => u.email === sqlUser.email);
    if (newUser) {
      userIdMap.set(sqlUser.id, newUser.id);
    }
  }

  // Get category mapping
  const categoryMap = new Map<number, string>();
  const categories = sqlite.prepare('SELECT * FROM budget_category').all() as SQLiteCategory[];
  for (const cat of categories) {
    categoryMap.set(cat.id, cat.name);
  }

  // Migrate bills
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
          amount: Number(bill.min_payment),
          dueDate: new Date(new Date().getFullYear(), new Date().getMonth(), bill.due_day_of_month),
          dueDayOfMonth: bill.due_day_of_month,
          status: bill.fully_paid ? 'paid' : 'pending',
          category: categoryMap.get(bill.category_id) || 'Uncategorized',
          description: bill.description || '',
          comment: bill.comment,
          fromSource: bill.from_source,
          balance: Number(bill.balance),
          minPayment: Number(bill.min_payment),
          active: Boolean(bill.active),
          fullyPaid: Boolean(bill.fully_paid),
          userId: newUserId,
        },
      });
      count++;
    } catch (error) {
      console.error(`✗ Failed to migrate bill ${bill.id}:`, error);
    }
  }
  
  console.log(`\n✓ Migrated ${count} bills\n`);
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    sqlite.close()
  })
