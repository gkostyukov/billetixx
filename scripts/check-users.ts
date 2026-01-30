import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    select: {
      email: true,
      name: true,
      password: true,
    }
  })

  console.log('\n👥 Migrated Users:')
  console.log('═══════════════════════════════════════════')
  users.forEach((user, index) => {
    console.log(`${index + 1}. Email: ${user.email}`)
    console.log(`   Name: ${user.name || 'N/A'}`)
    console.log(`   Has Password: ${user.password ? '✅ Yes' : '❌ No'}`)
    console.log('───────────────────────────────────────────')
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
