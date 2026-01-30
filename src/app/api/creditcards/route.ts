import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUser, unauthorizedResponse, errorResponse } from "@/lib/api-helpers"

export async function GET() {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedResponse()

    const creditCards = await prisma.creditCard.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(creditCards)
  } catch (error) {
    console.error("GET creditcards error:", error)
    return errorResponse("Failed to fetch credit cards")
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedResponse()

    const data = await req.json()
    const { 
      name, lastFourDigits, creditLimit, balance, currentBalance, dueDate, bank, cardType,
      minPayment, apr, statementBalance, autopay, autopayAccountId 
    } = data

    if (!name || !lastFourDigits || !creditLimit || !dueDate) {
      return errorResponse("Name, last four digits, credit limit, and due date are required", 400)
    }

    const creditCard = await prisma.creditCard.create({
      data: {
        name,
        lastFourDigits,
        creditLimit: parseFloat(creditLimit),
        balance: balance ? parseFloat(balance) : (currentBalance ? parseFloat(currentBalance) : 0),
        dueDate: parseInt(dueDate),
        bank,
        cardType,
        minPayment: minPayment ? parseFloat(minPayment) : 0,
        apr: apr ? parseFloat(apr) : 0,
        statementBalance: statementBalance ? parseFloat(statementBalance) : 0,
        autopay: autopay ? Boolean(autopay) : false,
        autopayAccountId: autopayAccountId || null,
        userId: user.id,
      }
    })

    return NextResponse.json(creditCard, { status: 201 })
  } catch (error) {
    console.error("POST creditcard error:", error)
    return errorResponse("Failed to create credit card")
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedResponse()

    const data = await req.json()
    const { 
      id, 
      name, 
      lastFourDigits, 
      creditLimit, 
      balance, 
      dueDate, 
      bank, 
      cardType, 
      minPayment, 
      apr, 
      statementBalance, 
      autopay,
      autopayAccountId 
    } = data

    if (!id) return errorResponse("Credit card ID is required", 400)

    const existing = await prisma.creditCard.findUnique({ where: { id } })
    if (!existing || existing.userId !== user.id) {
      return errorResponse("Credit card not found", 404)
    }

    const creditCard = await prisma.creditCard.update({
      where: { id },
      data: {
        name,
        lastFourDigits,
        creditLimit,
        balance,
        dueDate,
        bank,
        cardType,
        minPayment,
        apr,
        statementBalance,
        autopay,
        autopayAccountId: autopayAccountId || null
      }
    })

    return NextResponse.json(creditCard)
  } catch (error) {
    console.error("PUT creditcard error:", error)
    return errorResponse("Failed to update credit card")
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedResponse()

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (!id) return errorResponse("Credit card ID is required", 400)

    const existing = await prisma.creditCard.findUnique({ where: { id } })
    if (!existing || existing.userId !== user.id) {
      return errorResponse("Credit card not found", 404)
    }

    await prisma.creditCard.delete({ where: { id } })
    return NextResponse.json({ message: "Credit card deleted successfully" })
  } catch (error) {
    console.error("DELETE creditcard error:", error)
    return errorResponse("Failed to delete credit card")
  }
}
