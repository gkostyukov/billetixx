import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUser, unauthorizedResponse, errorResponse } from "@/lib/api-helpers"

// GET /api/payments - Get all payments ordered by due date
export async function GET() {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedResponse()

    const payments = await prisma.payment.findMany({
      where: { userId: user.id },
      orderBy: { dueDate: 'asc' } as any
    })

    return NextResponse.json(payments)
  } catch (error) {
    console.error("GET payments error:", error)
    return errorResponse("Failed to fetch payments")
  }
}

// POST /api/payments - Create a new payment
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedResponse()

    const data = await req.json()

    const payment = await prisma.payment.create({
      data: {
        description: data.description || "",
        comment: data.comment,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        amount: parseFloat(data.amount) || 0,
        fromSource: data.fromSource,
        sourceType: data.sourceType,
        sourceRefId: data.sourceRefId,
        balance: data.balance ? parseFloat(data.balance) : 0,
        minPayment: data.minPayment ? parseFloat(data.minPayment) : 0,
        autopay: data.autopay || false,
        billId: data.billId,
        paid: data.paid || false,
        isIncome: data.isIncome || false,
        active: data.active !== undefined ? data.active : true,
        category: data.category,
        userId: user.id,
      }
    })

    return NextResponse.json(payment, { status: 201 })
  } catch (error) {
    console.error("POST payment error:", error)
    return errorResponse("Failed to create payment")
  }
}

// PATCH /api/payments - Update a payment (partial update)
export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedResponse()

    const data = await req.json()
    const { id, ...updateData } = data

    if (!id) return errorResponse("Payment ID is required", 400)

    const existing = await prisma.payment.findUnique({ where: { id } })
    if (!existing || existing.userId !== user.id) {
      return errorResponse("Payment not found", 404)
    }

    // Prepare update data
    const dataToUpdate: any = {}
    
    if (updateData.description !== undefined) dataToUpdate.description = updateData.description
    if (updateData.comment !== undefined) dataToUpdate.comment = updateData.comment
    if (updateData.dueDate !== undefined) dataToUpdate.dueDate = updateData.dueDate ? new Date(updateData.dueDate) : null
    if (updateData.amount !== undefined) dataToUpdate.amount = parseFloat(updateData.amount)
    if (updateData.fromSource !== undefined) dataToUpdate.fromSource = updateData.fromSource
    if (updateData.sourceType !== undefined) dataToUpdate.sourceType = updateData.sourceType
    if (updateData.sourceRefId !== undefined) dataToUpdate.sourceRefId = updateData.sourceRefId
    if (updateData.balance !== undefined) dataToUpdate.balance = parseFloat(updateData.balance)
    if (updateData.minPayment !== undefined) dataToUpdate.minPayment = parseFloat(updateData.minPayment)
    if (updateData.autopay !== undefined) dataToUpdate.autopay = updateData.autopay
    if (updateData.billId !== undefined) dataToUpdate.billId = updateData.billId
    if (updateData.paid !== undefined) dataToUpdate.paid = updateData.paid
    if (updateData.isIncome !== undefined) dataToUpdate.isIncome = updateData.isIncome
    if (updateData.active !== undefined) dataToUpdate.active = updateData.active
    if (updateData.category !== undefined) dataToUpdate.category = updateData.category

    const payment = await prisma.payment.update({
      where: { id },
      data: dataToUpdate
    })

    return NextResponse.json(payment)
  } catch (error) {
    console.error("PATCH payment error:", error)
    return errorResponse("Failed to update payment")
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedResponse()

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (!id) return errorResponse("Payment ID is required", 400)

    const existing = await prisma.payment.findUnique({ where: { id } })
    if (!existing || existing.userId !== user.id) {
      return errorResponse("Payment not found", 404)
    }

    await prisma.payment.delete({ where: { id } })
    return NextResponse.json({ message: "Payment deleted successfully" })
  } catch (error) {
    console.error("DELETE payment error:", error)
    return errorResponse("Failed to delete payment")
  }
}

