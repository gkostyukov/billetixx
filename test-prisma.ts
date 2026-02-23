import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    try {
        const user = await prisma.user.findFirst()
        console.log("Success! Found user:", JSON.stringify(user, null, 2))
    } catch (error: any) {
        console.error("Prisma Error:", error.message)
    } finally {
        await prisma.$disconnect()
    }
}

main()
