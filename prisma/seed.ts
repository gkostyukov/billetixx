import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Create demo user
  const hashedPassword = await bcrypt.hash('demo123', 10)
  
  const user = await prisma.user.upsert({
    where: { email: 'demo@billetixx.com' },
    update: {},
    create: {
      email: 'demo@billetixx.com',
      name: 'Demo User',
      password: hashedPassword,
    },
  })

  console.log('Created user:', user.email)

  // Create sample bills
  await prisma.bill.createMany({
    data: [
      {
        title: 'Electric Bill',
        amount: 120.50,
        dueDate: new Date('2024-12-15'),
        status: 'pending',
        category: 'Utilities',
        userId: user.id,
      },
      {
        title: 'Internet Service',
        amount: 79.99,
        dueDate: new Date('2024-12-10'),
        status: 'paid',
        category: 'Utilities',
        userId: user.id,
      },
      {
        title: 'Rent',
        amount: 1500.00,
        dueDate: new Date('2024-12-01'),
        status: 'paid',
        category: 'Housing',
        userId: user.id,
      },
    ],
  })

  // Create sample expenses
  await prisma.expense.createMany({
    data: [
      {
        title: 'Groceries',
        amount: 85.30,
        date: new Date('2024-11-20'),
        category: 'Food',
        recurring: false,
        userId: user.id,
      },
      {
        title: 'Gas',
        amount: 45.00,
        date: new Date('2024-11-22'),
        category: 'Transportation',
        recurring: false,
        userId: user.id,
      },
      {
        title: 'Gym Membership',
        amount: 50.00,
        date: new Date('2024-11-01'),
        category: 'Health',
        recurring: true,
        userId: user.id,
      },
    ],
  })

  // Create sample incomes
  await prisma.income.createMany({
    data: [
      {
        title: 'Monthly Salary',
        amount: 5000.00,
        date: new Date('2024-11-30'),
        source: 'Employment',
        recurring: true,
        userId: user.id,
      },
      {
        title: 'Freelance Project',
        amount: 750.00,
        date: new Date('2024-11-15'),
        source: 'Freelance',
        recurring: false,
        userId: user.id,
      },
    ],
  })

  // Create sample credit cards
  await prisma.creditCard.createMany({
    data: [
      {
        name: 'Chase Sapphire',
        lastFourDigits: '1234',
        creditLimit: 10000.00,
        currentBalance: 2500.00,
        dueDate: 15,
        bank: 'Chase',
        cardType: 'Visa',
        userId: user.id,
      },
      {
        name: 'AmEx Gold',
        lastFourDigits: '5678',
        creditLimit: 5000.00,
        currentBalance: 1200.00,
        dueDate: 20,
        bank: 'American Express',
        cardType: 'AmEx',
        userId: user.id,
      },
    ],
  })

  // Create sample debts
  await prisma.debt.createMany({
    data: [
      {
        title: 'Student Loan',
        totalAmount: 25000.00,
        remainingAmount: 18000.00,
        interestRate: 4.5,
        minimumPayment: 250.00,
        creditor: 'Federal Student Aid',
        status: 'active',
        userId: user.id,
      },
      {
        title: 'Car Loan',
        totalAmount: 15000.00,
        remainingAmount: 8000.00,
        interestRate: 3.9,
        minimumPayment: 350.00,
        creditor: 'Auto Finance Co',
        status: 'active',
        userId: user.id,
      },
    ],
  })

  // Create sample payments
  await prisma.payment.createMany({
    data: [
      {
        title: 'Electric Bill Payment',
        amount: 120.50,
        paymentDate: new Date('2024-11-15'),
        method: 'card',
        category: 'Utilities',
        userId: user.id,
      },
      {
        title: 'Rent Payment',
        amount: 1500.00,
        paymentDate: new Date('2024-11-01'),
        method: 'transfer',
        category: 'Housing',
        userId: user.id,
      },
    ],
  })

  console.log('Seed data created successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
