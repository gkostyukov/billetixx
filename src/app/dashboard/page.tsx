"use client"

import { useEffect, useState } from "react"
import { signOut, useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

interface Bill {
  id: string
  title: string
  amount: number
  dueDate: string
  status: string
  category?: string
}

interface Expense {
  id: string
  title: string
  amount: number
  date: string
  category: string
}

interface Income {
  id: string
  amount: number
}

interface Debt {
  id: string
  remainingAmount: number
}

interface CreditCard {
  id: string
  name: string
  lastFourDigits: string
  currentBalance: number
  creditLimit: number
}

interface Payment {
  id: string
}

interface DashboardData {
  bills: Bill[]
  expenses: Expense[]
  incomes: Income[]
  debts: Debt[]
  creditCards: CreditCard[]
  payments: Payment[]
}

export default function Dashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [data, setData] = useState<DashboardData>({
    bills: [],
    expenses: [],
    incomes: [],
    debts: [],
    creditCards: [],
    payments: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin")
    }
  }, [status, router])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [bills, expenses, incomes, debts, creditCards, payments] = await Promise.all([
          fetch("/api/bills").then(r => r.json()),
          fetch("/api/expenses").then(r => r.json()),
          fetch("/api/incomes").then(r => r.json()),
          fetch("/api/debts").then(r => r.json()),
          fetch("/api/creditcards").then(r => r.json()),
          fetch("/api/payments").then(r => r.json()),
        ])
        
        setData({ bills, expenses, incomes, debts, creditCards, payments })
      } catch (error) {
        console.error("Error fetching data:", error)
      } finally {
        setLoading(false)
      }
    }

    if (status === "authenticated") {
      fetchData()
    }
  }, [status])

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (status === "unauthenticated") {
    return null
  }

  // Calculate totals
  const totalIncome = data.incomes.reduce((sum, item) => sum + item.amount, 0)
  const totalExpenses = data.expenses.reduce((sum, item) => sum + item.amount, 0)
  const totalBills = data.bills.filter((b) => b.status === "pending").reduce((sum, item) => sum + item.amount, 0)
  const totalDebt = data.debts.reduce((sum, item) => sum + item.remainingAmount, 0)

  // Expense by category
  const expensesByCategory = data.expenses.reduce((acc: Record<string, number>, expense) => {
    acc[expense.category] = (acc[expense.category] || 0) + expense.amount
    return acc
  }, {})

  const expenseChartData = Object.entries(expensesByCategory).map(([name, value]) => ({
    name,
    value,
  }))

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="border-b bg-white dark:bg-gray-800">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Billetixx Dashboard</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Welcome back, {session?.user?.name || session?.user?.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <Button variant="outline" onClick={() => signOut({ callbackUrl: "/" })}>
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Income</CardDescription>
              <CardTitle className="text-2xl text-green-600 dark:text-green-400">
                ${totalIncome.toFixed(2)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Expenses</CardDescription>
              <CardTitle className="text-2xl text-red-600 dark:text-red-400">
                ${totalExpenses.toFixed(2)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending Bills</CardDescription>
              <CardTitle className="text-2xl text-orange-600 dark:text-orange-400">
                ${totalBills.toFixed(2)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Debt</CardDescription>
              <CardTitle className="text-2xl text-purple-600 dark:text-purple-400">
                ${totalDebt.toFixed(2)}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Expenses by Category</CardTitle>
              <CardDescription>Distribution of your spending</CardDescription>
            </CardHeader>
            <CardContent>
              {expenseChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={expenseChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      label
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {expenseChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-gray-500">
                  No expense data available
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Financial Overview</CardTitle>
              <CardDescription>Income vs Expenses</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={[
                    { name: 'Income', amount: totalIncome },
                    { name: 'Expenses', amount: totalExpenses },
                    { name: 'Net', amount: totalIncome - totalExpenses },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="amount" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Bills</CardTitle>
              <CardDescription>Upcoming payments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.bills.slice(0, 5).map((bill) => (
                  <div key={bill.id} className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{bill.title}</p>
                      <p className="text-sm text-gray-500">
                        Due: {new Date(bill.dueDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">${bill.amount.toFixed(2)}</p>
                      <p className={`text-sm ${
                        bill.status === 'paid' ? 'text-green-600' : 
                        bill.status === 'overdue' ? 'text-red-600' : 
                        'text-orange-600'
                      }`}>
                        {bill.status}
                      </p>
                    </div>
                  </div>
                ))}
                {data.bills.length === 0 && (
                  <p className="text-gray-500">No bills yet</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Credit Cards</CardTitle>
              <CardDescription>Your credit card balances</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.creditCards.map((card) => (
                  <div key={card.id} className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{card.name}</p>
                      <p className="text-sm text-gray-500">
                        **** {card.lastFourDigits}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">${card.currentBalance.toFixed(2)}</p>
                      <p className="text-sm text-gray-500">
                        Limit: ${card.creditLimit.toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
                {data.creditCards.length === 0 && (
                  <p className="text-gray-500">No credit cards added</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
