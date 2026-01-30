
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    const user = await prisma.user.findFirst()
    if (!user) {
        console.log('No user found')
        return
    }
    console.log('User found:', user.email)

    const account = await prisma.bankAccount.create({
      data: {
        name: 'Test Account',
        bankName: 'Test Bank',
        accountLast4: '1234',
        cardLast4: '5678',
        active: true,
        userId: user.id,
      },
    })
    console.log('Account created:', account)
  } catch (error) {
    console.error('Error creating account:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
