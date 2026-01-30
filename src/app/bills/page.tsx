'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { DatePicker } from '@/components/ui/date-picker'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface Bill {
  id: string
  title: string
  amount: number
  dueDate: string
  dueDayOfMonth?: number
  status: string
  category?: string
  description?: string
  comment?: string
  fromSource?: string
  sourceType?: string
  sourceId?: string
  balance?: number
  minPayment?: number
  active: boolean
  fullyPaid: boolean
  createdAt: string
  updatedAt: string
}

interface Category {
  id: string
  name: string
}

interface Source {
  id: string
  name: string
  type: 'BankAccount' | 'CreditCard'
}

export default function BillsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [bills, setBills] = useState<Bill[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [sources, setSources] = useState<Source[]>([])
  const [filteredBills, setFilteredBills] = useState<Bill[]>([])
  const [selectedBills, setSelectedBills] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null)

  // Filter states
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterCategory, setFilterCategory] = useState<string>('')
  const [filterDescription, setFilterDescription] = useState<string>('')
  const [filterFromSource, setFilterFromSource] = useState<string>('')
  const [filterStartDate, setFilterStartDate] = useState<string>('')
  const [filterEndDate, setFilterEndDate] = useState<string>('')
  const [showPending, setShowPending] = useState(true)
  const [showPaid, setShowPaid] = useState(true)
  const [showOverdue, setShowOverdue] = useState(true)

  // Form states
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    dueDate: '',
    dueDayOfMonth: '',
    status: 'pending',
    category: '',
    description: '',
    comment: '',
    fromSource: '',
    sourceType: '',
    sourceId: '',
    balance: '',
    minPayment: '',
    active: true,
    fullyPaid: false,
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    } else if (status === 'authenticated') {
      fetchBills()
      fetchCategories()
      fetchSources()
    }
  }, [status, router])

  useEffect(() => {
    applyFilters()
  }, [bills, filterStatus, filterCategory, filterDescription, showPending, showPaid, showOverdue, filterFromSource, filterStartDate, filterEndDate])

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories')
      if (response.ok) {
        const data = await response.json()
        setCategories(data)
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  const fetchSources = async () => {
    try {
      const [accountsRes, cardsRes] = await Promise.all([
        fetch('/api/bank-accounts'),
        fetch('/api/creditcards')
      ])
      
      const accounts = accountsRes.ok ? await accountsRes.json() : []
      const cards = cardsRes.ok ? await cardsRes.json() : []

      const combinedSources: Source[] = [
        ...accounts.map((a: any) => ({ id: a.id, name: a.name, type: 'BankAccount' as const })),
        ...cards.map((c: any) => ({ id: c.id, name: c.name, type: 'CreditCard' as const }))
      ].sort((a, b) => a.name.localeCompare(b.name))

      setSources(combinedSources)
    } catch (error) {
      console.error('Error fetching sources:', error)
    }
  }

  const fetchBills = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/bills')
      if (!response.ok) throw new Error('Failed to fetch bills')
      const data = await response.json()
      setBills(data)
    } catch (err) {
      setError('Failed to load bills')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...bills]

    // Filter by status checkboxes
    filtered = filtered.filter(bill => {
      if (bill.status === 'pending' && !showPending) return false
      if (bill.status === 'paid' && !showPaid) return false
      if (bill.status === 'overdue' && !showOverdue) return false
      return true
    })

    // Filter by description
    if (filterDescription) {
      filtered = filtered.filter(bill =>
        bill.description?.toLowerCase().includes(filterDescription.toLowerCase())
      )
    }

    // Filter by category
    if (filterCategory) {
      filtered = filtered.filter(bill =>
        bill.category?.toLowerCase().includes(filterCategory.toLowerCase())
      )
    }

    // Filter by fromSource
    if (filterFromSource) {
      filtered = filtered.filter(bill =>
        bill.fromSource?.toLowerCase().includes(filterFromSource.toLowerCase())
      )
    }

    // Filter by date range (extracting days)
    if (filterStartDate && filterEndDate) {
      const start = new Date(filterStartDate)
      const end = new Date(filterEndDate)
      
      // Create a set of valid days from the range
      const validDays = new Set<number>()
      const current = new Date(start)
      
      while (current <= end) {
        validDays.add(current.getDate())
        current.setDate(current.getDate() + 1)
      }

      filtered = filtered.filter(bill => {
        const day = bill.dueDayOfMonth || new Date(bill.dueDate).getDate()
        return validDays.has(day)
      })
    } else if (filterStartDate) {
      // If only start date is provided, filter by that specific day
      const day = new Date(filterStartDate).getDate()
      filtered = filtered.filter(bill => {
        const billDay = bill.dueDayOfMonth || new Date(bill.dueDate).getDate()
        return billDay === day
      })
    }

    // Sort by due day (ascending)
    filtered.sort((a, b) => {
      const dayA = a.dueDayOfMonth || new Date(a.dueDate).getDate()
      const dayB = b.dueDayOfMonth || new Date(b.dueDate).getDate()
      return dayA - dayB
    })

    setFilteredBills(filtered)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      // Calculate next due date based on dueDayOfMonth
      let dueDate = new Date()
      if (formData.dueDayOfMonth) {
        const day = parseInt(formData.dueDayOfMonth)
        const today = new Date()
        dueDate = new Date(today.getFullYear(), today.getMonth(), day)
        if (dueDate < today) {
          dueDate.setMonth(dueDate.getMonth() + 1)
        }
      }

      const response = await fetch('/api/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          dueDate: dueDate.toISOString(),
        }),
      })
      
      if (!response.ok) throw new Error('Failed to create bill')
      
      await fetchBills()
      setShowCreateModal(false)
      resetForm()
    } catch (err) {
      console.error(err)
      alert('Failed to create bill')
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBill) return

    try {
      // Calculate next due date based on dueDayOfMonth
      let dueDate = new Date(selectedBill.dueDate)
      if (formData.dueDayOfMonth) {
        const day = parseInt(formData.dueDayOfMonth)
        const today = new Date()
        dueDate = new Date(today.getFullYear(), today.getMonth(), day)
        if (dueDate < today) {
          dueDate.setMonth(dueDate.getMonth() + 1)
        }
      }

      const response = await fetch('/api/bills', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: selectedBill.id, 
          ...formData,
          dueDate: dueDate.toISOString(),
        }),
      })
      
      if (!response.ok) throw new Error('Failed to update bill')
      
      await fetchBills()
      setShowEditModal(false)
      setSelectedBill(null)
      resetForm()
    } catch (err) {
      console.error(err)
      alert('Failed to update bill')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this bill?')) return

    try {
      const response = await fetch(`/api/bills?id=${id}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) throw new Error('Failed to delete bill')
      
      await fetchBills()
      setShowEditModal(false)
      setSelectedBill(null)
    } catch (err) {
      console.error(err)
      alert('Failed to delete bill')
    }
  }

  const openEditModal = (bill: Bill) => {
    setSelectedBill(bill)
    setFormData({
      title: bill.title,
      amount: bill.amount.toString(),
      dueDate: new Date(bill.dueDate).toISOString().split('T')[0],
      dueDayOfMonth: bill.dueDayOfMonth?.toString() || new Date(bill.dueDate).getDate().toString(),
      status: bill.status,
      category: bill.category || '',
      description: bill.description || '',
      comment: bill.comment || '',
      fromSource: bill.fromSource || '',
      sourceType: bill.sourceType || '',
      sourceId: bill.sourceId || '',
      balance: bill.balance?.toString() || '',
      minPayment: bill.minPayment?.toString() || '',
      active: bill.active,
      fullyPaid: bill.fullyPaid,
    })
    setShowEditModal(true)
  }

  const resetForm = () => {
    setFormData({
      title: '',
      amount: '',
      dueDate: '',
      dueDayOfMonth: '',
      status: 'pending',
      category: '',
      description: '',
      comment: '',
      fromSource: '',
      sourceType: '',
      sourceId: '',
      balance: '',
      minPayment: '',
      active: true,
      fullyPaid: false,
    })
  }

  const totalAmount = useMemo(() => {
    return filteredBills.reduce((sum, bill) => sum + (bill.minPayment || bill.amount), 0)
  }, [filteredBills])

  const statusBreakdown = useMemo(() => {
    const breakdown = { pending: 0, paid: 0, overdue: 0 }
    filteredBills.forEach(bill => {
      breakdown[bill.status as keyof typeof breakdown] = 
        (breakdown[bill.status as keyof typeof breakdown] || 0) + bill.amount
    })
    return breakdown
  }, [filteredBills])

  const handleBillSelection = (billId: string, checked: boolean) => {
    if (checked) {
      setSelectedBills(prev => [...prev, billId])
    } else {
      setSelectedBills(prev => prev.filter(id => id !== billId))
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedBills(filteredBills.map(bill => bill.id))
    } else {
      setSelectedBills([])
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'secondary',
      paid: 'default',
      overdue: 'destructive',
    }
    return (
      <Badge variant={variants[status] || 'outline'}>
        {status}
      </Badge>
    )
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Navigation Header */}
      <div className="border-b bg-white dark:bg-gray-800">
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
              variant="default"
              onClick={() => router.push('/bills')}
              className="font-medium"
            >
              Bills
            </Button>
            <Button
              variant="ghost"
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
          <h1 className="text-3xl font-bold">Bills</h1>
          <p className="text-muted-foreground">Manage your bills and payments</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowFilterModal(true)} variant="outline">
            Filters
          </Button>
          <Button onClick={() => {
            resetForm()
            setShowCreateModal(true)
          }}>
            Add Bill
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Amount</CardDescription>
            <CardTitle className="text-2xl">${totalAmount.toFixed(2)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Pending</CardDescription>
            <CardTitle className="text-2xl text-yellow-600">
              ${statusBreakdown.pending.toFixed(2)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Paid</CardDescription>
            <CardTitle className="text-2xl text-green-600">
              ${statusBreakdown.paid.toFixed(2)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Overdue</CardDescription>
            <CardTitle className="text-2xl text-red-600">
              ${statusBreakdown.overdue.toFixed(2)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Bills Table */}
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={filteredBills.length > 0 && selectedBills.length === filteredBills.length}
                    onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                    aria-label="Select all bills"
                    className="border-2 border-foreground data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                </TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Due Day</TableHead>
                <TableHead>From Source</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Comment</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Fully Paid</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBills.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground">
                    No bills found
                  </TableCell>
                </TableRow>
              ) : (
                filteredBills.map((bill) => (
                  <TableRow key={bill.id} className="cursor-pointer">
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedBills.includes(bill.id)}
                        onCheckedChange={(checked) => 
                          handleBillSelection(bill.id, checked as boolean)
                        }
                        className="border-2 border-foreground data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      />
                    </TableCell>
                    <TableCell onClick={() => openEditModal(bill)} className="font-medium">
                      {bill.description || bill.title}
                    </TableCell>
                    <TableCell onClick={() => openEditModal(bill)}>
                      ${(bill.minPayment || bill.amount).toFixed(2)}
                    </TableCell>
                    <TableCell onClick={() => openEditModal(bill)}>
                      {bill.dueDayOfMonth || new Date(bill.dueDate).getDate()}
                    </TableCell>
                    <TableCell onClick={() => openEditModal(bill)}>
                      {bill.fromSource || bill.title}
                    </TableCell>
                    <TableCell onClick={() => openEditModal(bill)}>
                      ${(bill.balance || 0).toFixed(2)}
                    </TableCell>
                    <TableCell onClick={() => openEditModal(bill)}>
                      {bill.comment || 'N/A'}
                    </TableCell>
                    <TableCell onClick={() => openEditModal(bill)}>
                      {bill.category || '-'}
                    </TableCell>
                    <TableCell onClick={() => openEditModal(bill)}>
                      {bill.active ? 'Yes' : 'No'}
                    </TableCell>
                    <TableCell onClick={() => openEditModal(bill)}>
                      {bill.fullyPaid ? 'Yes' : 'No'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell></TableCell>
                <TableCell>Total</TableCell>
                <TableCell className="font-bold">${totalAmount.toFixed(2)}</TableCell>
                <TableCell colSpan={7}></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      {/* Create Bill Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-[500px] overflow-visible">
          <DialogHeader className="pb-4 border-b border-border">
            <DialogTitle className="text-2xl">Create New Bill</DialogTitle>
            <DialogDescription className="text-base text-muted-foreground">
              Add a new bill to track your payments
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto pr-2">
            <form onSubmit={handleCreate} className="space-y-6">
            <div className="bg-muted/50 border border-border p-4 rounded-lg space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-sm font-medium">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="bg-background"
                  required
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fromSource" className="text-sm font-medium">From Source</Label>
                  <Select
                    value={formData.sourceId ? `${formData.sourceType}:${formData.sourceId}` : ''}
                    onValueChange={(value) => {
                      const [type, id] = value.split(':')
                      const source = sources.find(s => s.id === id && s.type === type)
                      setFormData({ 
                        ...formData, 
                        sourceType: type, 
                        sourceId: id,
                        fromSource: source ? source.name : ''
                      })
                    }}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      {sources.map((source) => (
                        <SelectItem key={`${source.type}:${source.id}`} value={`${source.type}:${source.id}`}>
                          {source.name} ({source.type === 'BankAccount' ? 'Account' : 'Card'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount" className="text-sm font-medium">Amount *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="bg-background"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dueDayOfMonth" className="text-sm font-medium">Due Day (1-31) *</Label>
                  <Input
                    id="dueDayOfMonth"
                    type="number"
                    min="1"
                    max="31"
                    value={formData.dueDayOfMonth}
                    onChange={(e) => setFormData({ ...formData, dueDayOfMonth: e.target.value })}
                    className="bg-background"
                    required
                    placeholder="e.g. 5"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category" className="text-sm font-medium">Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.name}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="bg-background"
                />
              </div>
              <div className="flex items-center space-x-4 pt-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="active"
                    checked={formData.active}
                    onCheckedChange={(checked) => setFormData({ ...formData, active: checked as boolean })}
                  />
                  <label htmlFor="active" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Active
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="fullyPaid"
                    checked={formData.fullyPaid}
                    onCheckedChange={(checked) => setFormData({ ...formData, fullyPaid: checked as boolean })}
                  />
                  <label htmlFor="fullyPaid" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Fully Paid
                  </label>
                </div>
              </div>
            </div>
            <DialogFooter className="pt-4 border-t border-border gap-2">
              <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button type="submit" className="min-w-[100px]">Create Bill</Button>
            </DialogFooter>
          </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Bill Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-[500px] overflow-visible">
          <DialogHeader className="pb-4 border-b border-border">
            <DialogTitle className="text-2xl">Edit Bill</DialogTitle>
            <DialogDescription className="text-base text-muted-foreground">
              Update bill details or delete it
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto pr-2">
            <form onSubmit={handleUpdate} className="space-y-6">
            <div className="bg-muted/50 border border-border p-4 rounded-lg space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title" className="text-sm font-medium">Title *</Label>
                <Input
                  id="edit-title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="bg-background"
                  required
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-fromSource" className="text-sm font-medium">From Source</Label>
                  <Select
                    value={formData.sourceId ? `${formData.sourceType}:${formData.sourceId}` : ''}
                    onValueChange={(value) => {
                      const [type, id] = value.split(':')
                      const source = sources.find(s => s.id === id && s.type === type)
                      setFormData({ 
                        ...formData, 
                        sourceType: type, 
                        sourceId: id,
                        fromSource: source ? source.name : ''
                      })
                    }}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      {sources.map((source) => (
                        <SelectItem key={`${source.type}:${source.id}`} value={`${source.type}:${source.id}`}>
                          {source.name} ({source.type === 'BankAccount' ? 'Account' : 'Card'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-amount" className="text-sm font-medium">Amount *</Label>
                  <Input
                    id="edit-amount"
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="bg-background"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-dueDayOfMonth" className="text-sm font-medium">Due Day (1-31) *</Label>
                  <Input
                    id="edit-dueDayOfMonth"
                    type="number"
                    min="1"
                    max="31"
                    value={formData.dueDayOfMonth}
                    onChange={(e) => setFormData({ ...formData, dueDayOfMonth: e.target.value })}
                    className="bg-background"
                    required
                    placeholder="e.g. 5"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-category" className="text-sm font-medium">Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.name}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description" className="text-sm font-medium">Description</Label>
                <Input
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="bg-background"
                />
              </div>
              <div className="flex items-center space-x-4 pt-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="edit-active"
                    checked={formData.active}
                    onCheckedChange={(checked) => setFormData({ ...formData, active: checked as boolean })}
                  />
                  <label htmlFor="edit-active" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Active
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="edit-fullyPaid"
                    checked={formData.fullyPaid}
                    onCheckedChange={(checked) => setFormData({ ...formData, fullyPaid: checked as boolean })}
                  />
                  <label htmlFor="edit-fullyPaid" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Fully Paid
                  </label>
                </div>
              </div>
            </div>
            <DialogFooter className="pt-4 border-t border-border gap-2 flex-col sm:flex-row">
              <Button
                type="button"
                variant="destructive"
                onClick={() => selectedBill && handleDelete(selectedBill.id)}
                className="sm:mr-auto"
              >
                Delete Bill
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setShowEditModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="min-w-[100px]">Update Bill</Button>
              </div>
            </DialogFooter>
          </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Filter Modal */}
      <Dialog open={showFilterModal} onOpenChange={setShowFilterModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader className="pb-4 border-b border-border">
            <DialogTitle className="text-2xl">Filter Bills</DialogTitle>
            <DialogDescription className="text-base text-muted-foreground">
              Filter your bills by various criteria
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="bg-muted/50 border border-border p-4 rounded-lg space-y-4">
              <div className="space-y-3">
                <Label className="text-sm font-medium">Status Filters</Label>
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="pending"
                      checked={showPending}
                      onCheckedChange={(checked) => setShowPending(checked as boolean)}
                    />
                    <label htmlFor="pending" className="text-sm cursor-pointer font-medium">
                      Show Pending
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="paid"
                      checked={showPaid}
                      onCheckedChange={(checked) => setShowPaid(checked as boolean)}
                    />
                    <label htmlFor="paid" className="text-sm cursor-pointer font-medium">
                      Show Paid
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="overdue"
                      checked={showOverdue}
                      onCheckedChange={(checked) => setShowOverdue(checked as boolean)}
                    />
                    <label htmlFor="overdue" className="text-sm cursor-pointer font-medium">
                      Show Overdue
                    </label>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter-description" className="text-sm font-medium">Description</Label>
                <Input
                  id="filter-description"
                  placeholder="Search by description..."
                  value={filterDescription}
                  onChange={(e) => setFilterDescription(e.target.value)}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter-category" className="text-sm font-medium">Category</Label>
                <Input
                  id="filter-category"
                  placeholder="Search by category..."
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter-fromSource" className="text-sm font-medium">From Source</Label>
                <Input
                  id="filter-fromSource"
                  placeholder="Search by source..."
                  value={filterFromSource}
                  onChange={(e) => setFilterFromSource(e.target.value)}
                  className="bg-background"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="filter-startDate" className="text-sm font-medium">Start Date</Label>
                  <Input
                    id="filter-startDate"
                    type="date"
                    value={filterStartDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="filter-endDate" className="text-sm font-medium">End Date</Label>
                  <Input
                    id="filter-endDate"
                    type="date"
                    value={filterEndDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                    className="bg-background"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="pt-4 border-t border-border gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFilterDescription('')
                setFilterCategory('')
                setFilterFromSource('')
                setFilterStartDate('')
                setFilterEndDate('')
                setShowPending(true)
                setShowPaid(true)
                setShowOverdue(true)
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
      </div>
    </div>
  )
}
