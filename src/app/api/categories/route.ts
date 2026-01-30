import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUser, unauthorizedResponse, errorResponse } from "@/lib/api-helpers"

// GET /api/categories - Get all categories
export async function GET() {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedResponse()

    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(categories)
  } catch (error) {
    console.error("GET categories error:", error)
    return errorResponse("Failed to fetch categories")
  }
}

// POST /api/categories - Create a new category
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedResponse()

    const data = await req.json()
    const { name, description, active } = data

    if (!name) {
      return errorResponse("Category name is required", 400)
    }

    // Check if category already exists
    const existing = await prisma.category.findUnique({
      where: { name }
    })

    if (existing) {
      return errorResponse("Category with this name already exists", 400)
    }

    const category = await prisma.category.create({
      data: {
        name,
        description: description || null,
        active: active !== undefined ? active : true,
      }
    })

    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    console.error("POST category error:", error)
    return errorResponse("Failed to create category")
  }
}

// PATCH /api/categories - Update a category
export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedResponse()

    const data = await req.json()
    const { id, ...updateData } = data

    if (!id) return errorResponse("Category ID is required", 400)

    const existing = await prisma.category.findUnique({ where: { id } })
    if (!existing) {
      return errorResponse("Category not found", 404)
    }

    // If updating name, check for uniqueness
    if (updateData.name && updateData.name !== existing.name) {
      const nameExists = await prisma.category.findUnique({
        where: { name: updateData.name }
      })
      if (nameExists) {
        return errorResponse("Category with this name already exists", 400)
      }
    }

    const category = await prisma.category.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json(category)
  } catch (error) {
    console.error("PATCH category error:", error)
    return errorResponse("Failed to update category")
  }
}

// DELETE /api/categories - Delete a category
export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return unauthorizedResponse()

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (!id) return errorResponse("Category ID is required", 400)

    const existing = await prisma.category.findUnique({ where: { id } })
    if (!existing) {
      return errorResponse("Category not found", 404)
    }

    await prisma.category.delete({ where: { id } })
    return NextResponse.json({ message: "Category deleted successfully" })
  } catch (error) {
    console.error("DELETE category error:", error)
    return errorResponse("Failed to delete category")
  }
}
