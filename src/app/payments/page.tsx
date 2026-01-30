'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils' // Add this import
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface Payment {
  id: string
  description: string
  comment?: string | null
  dueDate?: string | null
  amount: number
  fromSource?: string | null
  paid: boolean
  active: boolean
  category?: string | null
}

interface SourceBreakdown {
  total: number
  paid: number
  processing: number
}

export default function PaymentsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [payments, setPayments] = useState<Payment[]>([])
  const [filteredPayments, setFilteredPayments] = useState<Payment[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Modal states
  const [showEditModal, setShowEditModal] = useState(false)
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null)

  // Filter states
  const [showPaid, setShowPaid] = useState(true)
  const [showUnpaid, setShowUnpaid] = useState(true)
  const [showActive, setShowActive] = useState(true)
  const [showInactive, setShowInactive] = useState(false)
  const [filterFromSource, setFilterFromSource] = useState('')

  // Form state
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    dueDate: '',
    fromSource: '',
    comment: '',
    category: '',
    paid: false,
    active: true,
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, router])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchPayments()
    }
  }, [status])

  const fetchPayments = async () => {
    try {
      const response = await fetch('/api/payments')
      if (response.ok) {
        const data = await response.json()
        setPayments(data)
      }
    } catch (error) {
      console.error('Error fetching payments:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Apply filters
  useEffect(() => {
    const filtered = payments.filter((payment) => {
      const paidMatch = (showPaid && payment.paid) || (showUnpaid && !payment.paid)
      const activeMatch = (showActive && payment.active) || (showInactive && !payment.active)
      const sourceMatch =
        filterFromSource === '' ||
        (payment.fromSource && payment.fromSource.toLowerCase().includes(filterFromSource.toLowerCase()))
      return paidMatch && activeMatch && sourceMatch
    })
    setFilteredPayments(filtered)
  }, [payments, showPaid, showUnpaid, showActive, showInactive, filterFromSource])

  const handleTogglePaid = async (payment: Payment) => {
    try {
      const response = await fetch('/api/payments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: payment.id, paid: !payment.paid }),
      })

      if (response.ok) {
        setPayments((prev) =>
          prev.map((p) => (p.id === payment.id ? { ...p, paid: !p.paid } : p))
        )
      }
    } catch (error) {
      console.error('Error toggling paid:', error)
    }
  }

  const handleToggleActive = async (payment: Payment) => {
    try {
      const response = await fetch('/api/payments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: payment.id, active: !payment.active }),
      })

      if (response.ok) {
        setPayments((prev) =>
          prev.map((p) => (p.id === payment.id ? { ...p, active: !p.active } : p))
        )
      }
    } catch (error) {
      console.error('Error toggling active:', error)
    }
  }

  const openEditModal = (payment: Payment) => {
    setSelectedPayment(payment)
    setFormData({
      description: payment.description,
      amount: payment.amount.toString(),
      dueDate: payment.dueDate ? new Date(payment.dueDate).toISOString().split('T')[0] : '',
      fromSource: payment.fromSource || '',
      comment: payment.comment || '',
      category: payment.category || '',
      paid: payment.paid,
      active: payment.active,
    })
    setShowEditModal(true)
  }

  const handleUpdate = async () => {
    if (!selectedPayment) return

    try {
      const response = await fetch('/api/payments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedPayment.id,
          description: formData.description,
          amount: parseFloat(formData.amount),
          dueDate: formData.dueDate || null,
          fromSource: formData.fromSource,
          comment: formData.comment,
          category: formData.category,
          paid: formData.paid,
          active: formData.active,
        }),
      })

      if (response.ok) {
        await fetchPayments()
        setShowEditModal(false)
        setSelectedPayment(null)
      }
    } catch (error) {
      console.error('Error updating payment:', error)
    }
  }

  const handleDelete = async () => {
    if (!selectedPayment) return

    try {
      const response = await fetch(`/api/payments?id=${selectedPayment.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setPayments((prev) => prev.filter((p) => p.id !== selectedPayment.id))
        setShowEditModal(false)
        setSelectedPayment(null)
      }
    } catch (error) {
      console.error('Error deleting payment:', error)
    }
  }

  const totalAmount = useMemo(() => {
    return filteredPayments.reduce((sum, p) => sum + (!p.paid ? p.amount : 0), 0)
  }, [filteredPayments])

  const sourceBreakdown = useMemo(() => {
    const breakdown: Record<string, SourceBreakdown> = {}

    filteredPayments.forEach((payment) => {
      const source = payment.fromSource || 'N/A'

      if (!breakdown[source]) {
        breakdown[source] = { total: 0, paid: 0, processing: 0 }
      }

      breakdown[source].total += payment.amount

      if (payment.paid) {
        breakdown[source].paid += payment.amount
      } else {
        breakdown[source].processing += payment.amount
      }
    })

    return breakdown
  }, [filteredPayments])

  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return 'No Due Date'
    const date = new Date(dateStr)
    return new Intl.DateTimeFormat('en-US').format(date)
  }

  const isDueToday = (dueDateString: string | null | undefined): boolean => {
    if (!dueDateString) return false
    const dueDate = new Date(dueDateString)
    const today = new Date()
    return (
      dueDate.getFullYear() === today.getFullYear() &&
      dueDate.getMonth() === today.getMonth() &&
      dueDate.getDate() === today.getDate()
    )
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">Billetixx</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Welcome back, {session?.user?.name || session?.user?.email}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => router.push('/auth/signin')}
            >
              Sign Out
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => router.push('/dashboard')}
              className="font-medium"
            >
              Dashboard
            </Button>
            <Button
              variant="ghost"
              onClick={() => router.push('/bills')}
              className="font-medium"
            >
              Bills
            </Button>
            <Button
              variant="default"
              onClick={() => router.push('/payments')}
              className="font-medium"
            >
              Payments
            </Button>
            <Button
              variant="ghost"
              onClick={() => router.push('/bank-accounts')}
              className="font-medium"
            >
              Bank Accounts
            </Button>
            <Button
              variant="ghost"
              onClick={() => router.push('/credit-cards')}
              className="font-medium"
            >
              Credit Cards
            </Button>
            <Button
              variant="ghost"
              onClick={() => router.push('/categories')}
              className="font-medium"
            >
              Categories
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-3xl font-bold">Payments</h2>
            <p className="text-muted-foreground">Manage your payment records</p>
          </div>
          <Button onClick={() => setShowFilterModal(true)} variant="outline">
            Filters
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Unpaid</CardDescription>
              <CardTitle className="text-2xl">${totalAmount.toFixed(2)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Active Payments</CardDescription>
              <CardTitle className="text-2xl">
                {filteredPayments.filter(p => p.active).length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Paid This Period</CardDescription>
              <CardTitle className="text-2xl text-green-600">
                ${filteredPayments.filter(p => p.paid).reduce((sum, p) => sum + p.amount, 0).toFixed(2)}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Payments Table */}
        <Card>
          <CardContent className="pt-6">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>From Source</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.map((payment, index) => (
                <TableRow
                  key={payment.id}
                  className={cn(
                    "cursor-pointer",
                    isDueToday(payment.dueDate) && "bg-yellow-100 dark:bg-yellow-900/30 hover:bg-yellow-200 dark:hover:bg-yellow-900/50"
                  )}
                  onClick={() => openEditModal(payment)}
                >
                  <TableCell>{payment.description}</TableCell>
                  <TableCell>${payment.amount.toFixed(2)}</TableCell>
                  <TableCell>{formatDate(payment.dueDate)}</TableCell>
                  <TableCell>{payment.fromSource || 'N/A'}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={payment.paid}
                      onCheckedChange={() => handleTogglePaid(payment)}
                    />
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={payment.active}
                      onCheckedChange={() => handleToggleActive(payment)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell><strong>Total Unpaid</strong></TableCell>
                <TableCell><strong>${totalAmount.toFixed(2)}</strong></TableCell>
                <TableCell colSpan={4}>
                  <div className="text-sm">
                    <strong>Breakdown by Source:</strong>
                    {Object.entries(sourceBreakdown).map(([source, amounts]) => (
                      <div key={source} className="ml-4 mt-1">
                        <Badge variant="outline">{source}</Badge>
                        <span className="ml-2 text-xs">
                          Total: ${amounts.total.toFixed(2)} |
                          Paid: ${amounts.paid.toFixed(2)} |
                          Processing: ${amounts.processing.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
          </CardContent>
        </Card>
      </div>

      {/* Filter Modal */}
      <Dialog open={showFilterModal} onOpenChange={setShowFilterModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader className="pb-4 border-b border-border">
            <DialogTitle className="text-2xl">Filter Payments</DialogTitle>
            <DialogDescription className="text-base text-muted-foreground">
              Filter your payments by various criteria
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="bg-muted/50 border border-border p-4 rounded-lg space-y-4">
              <div className="space-y-3">
                <Label className="text-sm font-medium">Payment Status</Label>
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="showPaid"
                      checked={showPaid}
                      onCheckedChange={(checked) => setShowPaid(checked as boolean)}
                    />
                    <label htmlFor="showPaid" className="text-sm cursor-pointer font-medium">
                      Show Paid
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="showUnpaid"
                      checked={showUnpaid}
                      onCheckedChange={(checked) => setShowUnpaid(checked as boolean)}
                    />
                    <label htmlFor="showUnpaid" className="text-sm cursor-pointer font-medium">
                      Show Unpaid
                    </label>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <Label className="text-sm font-medium">Activity Status</Label>
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="showActive"
                      checked={showActive}
                      onCheckedChange={(checked) => setShowActive(checked as boolean)}
                    />
                    <label htmlFor="showActive" className="text-sm cursor-pointer font-medium">
                      Show Active
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="showInactive"
                      checked={showInactive}
                      onCheckedChange={(checked) => setShowInactive(checked as boolean)}
                    />
                    <label htmlFor="showInactive" className="text-sm cursor-pointer font-medium">
                      Show Inactive
                    </label>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fromSource" className="text-sm font-medium">From Source</Label>
                <Input
                  id="fromSource"
                  value={filterFromSource}
                  onChange={(e) => setFilterFromSource(e.target.value)}
                  placeholder="Filter by source..."
                  className="bg-background"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="pt-4 border-t border-border gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFilterFromSource('')
                setShowPaid(true)
                setShowUnpaid(true)
                setShowActive(true)
                setShowInactive(false)
              }}
            >
              Clear Filters
            </Button>
            <Button onClick={() => setShowFilterModal(false)} className="min-w-[100px]">
              Apply Filters
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-[500px] overflow-visible">
          <DialogHeader className="pb-4 border-b border-border">
            <DialogTitle className="text-2xl">Edit Payment</DialogTitle>
            <DialogDescription className="text-base text-muted-foreground">
              Update payment details or delete this payment
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto pr-2">
            <div className="space-y-6">
              <div className="bg-muted/50 border border-border p-4 rounded-lg space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-sm font-medium">Description</Label>
                    <Input
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount" className="text-sm font-medium">Amount</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      className="bg-background"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dueDate" className="text-sm font-medium">Due Date</Label>
                    <Input
                      id="dueDate"
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fromSource" className="text-sm font-medium">From Source</Label>
                    <Input
                      id="fromSource"
                      value={formData.fromSource}
                      onChange={(e) => setFormData({ ...formData, fromSource: e.target.value })}
                      placeholder="e.g., Chase, Wells Fargo"
                      className="bg-background"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="comment" className="text-sm font-medium">Comment</Label>
                  <Input
                    id="comment"
                    value={formData.comment}
                    onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                    className="bg-background"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="paid"
                      checked={formData.paid}
                      onCheckedChange={(checked) => setFormData({ ...formData, paid: checked as boolean })}
                    />
                    <label htmlFor="paid" className="text-sm cursor-pointer font-medium">Paid</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="active"
                      checked={formData.active}
                      onCheckedChange={(checked) => setFormData({ ...formData, active: checked as boolean })}
                    />
                    <label htmlFor="active" className="text-sm cursor-pointer font-medium">Active</label>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="pt-4 border-t border-border gap-2 flex-col sm:flex-row">
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              className="sm:mr-auto"
            >
              Delete Payment
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setShowEditModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdate} className="min-w-[100px]">Save Changes</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
