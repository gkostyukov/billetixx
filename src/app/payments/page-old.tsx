'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

interface Payment {
  id: string
  description: string
  comment?: string | null
  dueDate?: Date | string | null
  amount: number
  fromSource?: string | null
  sourceType?: string | null
  sourceRefId?: string | null
  balance?: number | null
  minPayment?: number | null
  autopay?: boolean | null
  billId?: string | null
  paid: boolean
  isIncome: boolean
  active: boolean
  category?: string | null
  createdAt: Date | string
  updatedAt: Date | string
}

interface SourceBreakdown {
  total: number
  paid: number
  processing: number
}

const sanitizeSourceValue = (value: any): string => {
  if (value === null || value === undefined) return ''
  return typeof value === 'string' ? value : String(value)
}

const formatDate = (dateStr: Date | string | null | undefined): string => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return new Intl.DateTimeFormat('en-US').format(date)
}

const isDueToday = (dueDateString: Date | string | null | undefined): boolean => {
  if (!dueDateString) return false
  const dueDate = new Date(dueDateString)
  const today = new Date()
  return (
    dueDate.getFullYear() === today.getFullYear() &&
    dueDate.getMonth() === today.getMonth() &&
    dueDate.getDate() === today.getDate()
  )
}

export default function PaymentsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [payments, setPayments] = useState<Payment[]>([])
  const [filteredPayments, setFilteredPayments] = useState<Payment[]>([])
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null)
  const [editablePayment, setEditablePayment] = useState<Payment | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
  const [updateMessage, setUpdateMessage] = useState('')

  // Filter states
  const [showPaid, setShowPaid] = useState(true)
  const [showUnpaid, setShowUnpaid] = useState(true)
  const [showActive, setShowActive] = useState(true)
  const [showInactive, setShowInactive] = useState(false)
  const [filterFromSource, setFilterFromSource] = useState('')

  const [accountsOptions, setAccountsOptions] = useState<any[]>([])

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin")
    }
  }, [status, router])

  const fetchPayments = useCallback(async () => {
    if (status !== "authenticated") return

    try {
      const response = await fetch("/api/payments")
      if (response.ok) {
        const data = await response.json()
        setPayments(data)
      } else {
        console.error("Failed to fetch payments")
      }
    } catch (error) {
      console.error("Error fetching payments:", error)
    }
  }, [status])

  useEffect(() => {
    if (status === "authenticated") {
      fetchPayments()
    }
  }, [status, fetchPayments])

  // Apply filters
  const applyFilters = useCallback(() => {
    const filtered = payments.filter((payment) => {
      const paidMatch = (showPaid && payment.paid) || (showUnpaid && !payment.paid)
      const activeMatch = (showActive && payment.active) || (showInactive && !payment.active)
      const normalizedSource = sanitizeSourceValue(payment.fromSource)
      const fromSourceMatch =
        filterFromSource === '' ||
        (normalizedSource &&
          normalizedSource.toLowerCase().includes(filterFromSource.toLowerCase()))
      return paidMatch && activeMatch && fromSourceMatch
    })
    setFilteredPayments(filtered)
  }, [payments, showPaid, showUnpaid, showActive, showInactive, filterFromSource])

  useEffect(() => {
    applyFilters()
  }, [applyFilters])

  const handleTogglePaid = async (payment: Payment) => {
    const newPaid = !payment.paid
    try {
      const response = await fetch("/api/payments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: payment.id, paid: newPaid }),
      })

      if (response.ok) {
        setPayments((prev) =>
          prev.map((p) => (p.id === payment.id ? { ...p, paid: newPaid } : p))
        )
      }
    } catch (error) {
      console.error("Error toggling paid:", error)
    }
  }

  const handleToggleActive = async (payment: Payment) => {
    const newActive = !payment.active
    try {
      const response = await fetch("/api/payments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: payment.id, active: newActive }),
      })

      if (response.ok) {
        setPayments((prev) =>
          prev.map((p) => (p.id === payment.id ? { ...p, active: newActive } : p))
        )
      }
    } catch (error) {
      console.error("Error toggling active:", error)
    }
  }

  const openModal = (payment: Payment) => {
    setSelectedPayment(payment)
    setEditablePayment({ ...payment })
    setUpdateMessage('')
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setSelectedPayment(null)
    setEditablePayment(null)
    setUpdateMessage('')
    setIsModalOpen(false)
  }

  const handleInputChange = (name: string, value: any) => {
    setEditablePayment((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        [name]: name === 'fromSource' ? sanitizeSourceValue(value) : value,
      }
    })
  }

  const handleUpdate = async () => {
    if (!selectedPayment || !editablePayment) return

    try {
      const response = await fetch("/api/payments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editablePayment),
      })

      if (response.ok) {
        const updatedPayment = await response.json()
        setPayments((prev) =>
          prev.map((p) => (p.id === selectedPayment.id ? updatedPayment : p))
        )
        setUpdateMessage('Payment updated successfully.')
      } else {
        setUpdateMessage('Failed to update payment. Please try again.')
      }
    } catch (error) {
      console.error("Error updating payment:", error)
      setUpdateMessage('Failed to update payment. Please try again.')
    }
  }

  const handleDelete = async () => {
    if (!selectedPayment) return

    try {
      const response = await fetch(`/api/payments?id=${selectedPayment.id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        setPayments((prev) => prev.filter((p) => p.id !== selectedPayment.id))
        closeModal()
      }
    } catch (error) {
      console.error("Error deleting payment:", error)
    }
  }

  const totalAmount = useMemo(() => {
    return filteredPayments.reduce((sum, p) => sum + (!p.paid ? p.amount : 0), 0)
  }, [filteredPayments])

  const sourceBreakdown = useMemo(() => {
    const breakdown: Record<string, SourceBreakdown> = {}

    filteredPayments.forEach((payment) => {
      const source = sanitizeSourceValue(payment.fromSource) || 'N/A'

      if (!breakdown[source]) {
        breakdown[source] = {
          total: 0,
          paid: 0,
          processing: 0,
        }
      }

      const amount = payment.amount || 0
      breakdown[source].total += amount

      if (payment.paid) {
        breakdown[source].paid += amount
      } else {
        breakdown[source].processing += amount
      }
    })

    return breakdown
  }, [filteredPayments])

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Navigation Header */}
      <div className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex space-x-4">
              <Button variant="outline" onClick={() => router.push("/dashboard")}>
                Dashboard
              </Button>
              <Button variant="outline" onClick={() => router.push("/bills")}>
                Bills
              </Button>
              <Button variant="default">
                Payments
              </Button>
            </div>
            <Button variant="destructive" onClick={() => signOut()}>
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Payments</h1>
          <Button onClick={() => setIsFilterModalOpen(true)}>
            Filters
          </Button>
        </div>

        {/* Filters Modal */}
        <Dialog open={isFilterModalOpen} onOpenChange={setIsFilterModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Filters</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="showPaid"
                  checked={showPaid}
                  onCheckedChange={(checked) => setShowPaid(checked as boolean)}
                />
                <Label htmlFor="showPaid">Show Paid</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="showUnpaid"
                  checked={showUnpaid}
                  onCheckedChange={(checked) => setShowUnpaid(checked as boolean)}
                />
                <Label htmlFor="showUnpaid">Show Unpaid</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="showActive"
                  checked={showActive}
                  onCheckedChange={(checked) => setShowActive(checked as boolean)}
                />
                <Label htmlFor="showActive">Show Active</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="showInactive"
                  checked={showInactive}
                  onCheckedChange={(checked) => setShowInactive(checked as boolean)}
                />
                <Label htmlFor="showInactive">Show Inactive</Label>
              </div>
              <div>
                <Label htmlFor="fromSource">From Source</Label>
                <Input
                  id="fromSource"
                  type="text"
                  value={filterFromSource}
                  onChange={(e) => setFilterFromSource(e.target.value)}
                  placeholder="Enter source"
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setIsFilterModalOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Payments Table */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
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
                  className={`cursor-pointer ${
                    isDueToday(payment.dueDate) ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''
                  }`}
                  onClick={(e) => {
                    const target = e.target as HTMLElement
                    if (target.tagName !== 'BUTTON' && target.getAttribute('role') !== 'checkbox') {
                      openModal(payment)
                    }
                  }}
                >
                  <TableCell>{payment.description}</TableCell>
                  <TableCell>${payment.amount.toFixed(2)}</TableCell>
                  <TableCell>
                    {payment.dueDate ? formatDate(payment.dueDate) : 'No Due Date'}
                  </TableCell>
                  <TableCell>{sanitizeSourceValue(payment.fromSource) || 'N/A'}</TableCell>
                  <TableCell>
                    <Checkbox
                      checked={payment.paid}
                      onCheckedChange={(e) => {
                        e && handleTogglePaid(payment)
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </TableCell>
                  <TableCell>
                    <Checkbox
                      checked={payment.active}
                      onCheckedChange={(e) => {
                        e && handleToggleActive(payment)
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell><strong>Total</strong></TableCell>
                <TableCell><strong>${totalAmount.toFixed(2)}</strong></TableCell>
                <TableCell colSpan={4}>
                  <div className="text-sm">
                    {Object.keys(sourceBreakdown).length > 0 ? (
                      Object.entries(sourceBreakdown).map(([source, amounts]) => (
                        <div key={source} className="mb-2">
                          <strong>{source}:</strong>
                          <div className="pl-4 text-xs">
                            Total: ${amounts.total.toFixed(2)}<br />
                            Paid: ${amounts.paid.toFixed(2)}<br />
                            Processing: ${amounts.processing.toFixed(2)}
                          </div>
                        </div>
                      ))
                    ) : (
                      <span>No data</span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>

        {/* Edit Payment Modal */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Payment</DialogTitle>
            </DialogHeader>
            {editablePayment && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={editablePayment.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={editablePayment.amount}
                    onChange={(e) => handleInputChange('amount', parseFloat(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={
                      editablePayment.dueDate
                        ? new Date(editablePayment.dueDate).toISOString().split('T')[0]
                        : ''
                    }
                    onChange={(e) => handleInputChange('dueDate', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="fromSource">From Source</Label>
                  <Input
                    id="fromSource"
                    value={editablePayment.fromSource || ''}
                    onChange={(e) => handleInputChange('fromSource', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="comment">Comment</Label>
                  <Input
                    id="comment"
                    value={editablePayment.comment || ''}
                    onChange={(e) => handleInputChange('comment', e.target.value)}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="paid"
                    checked={editablePayment.paid}
                    onCheckedChange={(checked) => handleInputChange('paid', checked)}
                  />
                  <Label htmlFor="paid">Paid</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="active"
                    checked={editablePayment.active}
                    onCheckedChange={(checked) => handleInputChange('active', checked)}
                  />
                  <Label htmlFor="active">Active</Label>
                </div>
                {updateMessage && (
                  <div
                    className={`p-2 rounded ${
                      updateMessage.includes('success')
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {updateMessage}
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={closeModal}>
                Close
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Delete
              </Button>
              <Button onClick={handleUpdate}>Update</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
