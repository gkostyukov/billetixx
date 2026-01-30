import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('📊 Verifying migrated data in PostgreSQL...\n')

  const users = await prisma.user.count()
  const bills = await prisma.bill.count()
  const payments = await prisma.payment.count()
  const expenses = await prisma.expense.count()
  const incomes = await prisma.income.count()
  const debts = await prisma.debt.count()
  const creditCards = await prisma.creditCard.count()

  console.log('Record Counts:')
  console.log('═══════════════════════════════')
  console.log(`👤 Users:        ${users}`)
  console.log(`📄 Bills:        ${bills}`)
  console.log(`💳 Payments:     ${payments}`)
  console.log(`💰 Expenses:     ${expenses}`)
  console.log(`💵 Incomes:      ${incomes}`)
  console.log(`📊 Debts:        ${debts}`)
  console.log(`💳 Credit Cards: ${creditCards}`)
  console.log('═══════════════════════════════')
  console.log(`📈 Total:        ${users + bills + payments + expenses + incomes + debts + creditCards}`)

  // Show sample data
  console.log('\n📋 Sample Bills:')
  const sampleBills = await prisma.bill.findMany({
    take: 3,
    select: {
      title: true,
      amount: true,
      dueDate: true,
      status: true,
    }
  })
  console.table(sampleBills)

  console.log('\n💰 Sample Expenses:')
  const sampleExpenses = await prisma.expense.findMany({
    take: 3,
    select: {
      description: true,
      amount: true,
      category: true,
      date: true,
    }
  })
  console.table(sampleExpenses)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
