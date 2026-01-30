import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email = 'gkostyukov@yahoo.com'
  const newPassword = '12345'

  console.log(`🔐 Updating password for ${email}...`)

  // Hash the new password
  const hashedPassword = await bcrypt.hash(newPassword, 10)

  // Update the user
  const updatedUser = await prisma.user.update({
    where: { email },
    data: { password: hashedPassword },
    select: {
      email: true,
      name: true,
    }
  })

  console.log('✅ Password updated successfully!')
  console.log(`   Email: ${updatedUser.email}`)
  console.log(`   Name: ${updatedUser.name}`)
  console.log(`   New Password: ${newPassword}`)
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
