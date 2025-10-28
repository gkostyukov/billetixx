import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

export async function getAuthenticatedUser() {
  const session = await auth()
  
  if (!session?.user?.id) {
    return null
  }
  
  return session.user
}

export function unauthorizedResponse() {
  return NextResponse.json(
    { error: "Unauthorized" },
    { status: 401 }
  )
}

export function errorResponse(message: string, status: number = 500) {
  return NextResponse.json(
    { error: message },
    { status }
  )
}
