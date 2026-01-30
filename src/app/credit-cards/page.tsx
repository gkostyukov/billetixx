'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'

interface CreditCard {
  id: string
  name: string
  lastFourDigits: string
  creditLimit: number
  balance: number
  dueDate: number
  bank?: string | null
  cardType?: string | null
  minPayment?: number | null
  apr?: number | null
  statementBalance?: number | null
  autopay?: boolean
  autopayAccountId?: string | null
}

interface BankAccount {
  id: string
  name: string
  bankName?: string | null
  accountLast4: string
}

export default function CreditCardsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [creditCards, setCreditCards] = useState<CreditCard[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [sortConfig, setSortConfig] = useState<{
    key: keyof CreditCard | null;
    direction: 'asc' | 'desc';
  }>({ key: null, direction: 'asc' });

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedCard, setSelectedCard] = useState<CreditCard | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    lastFourDigits: '',
    creditLimit: '',
    balance: '',
    dueDate: '',
    bank: '',
    cardType: '',
    minPayment: '',
    apr: '',
    statementBalance: '',
    autopay: false,
    autopayAccountId: '',
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, router])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchCreditCards()
      fetchBankAccounts()
    }
  }, [status])

  const fetchBankAccounts = async () => {
    try {
      const response = await fetch('/api/bank-accounts')
      if (response.ok) {
        const data = await response.json()
        setBankAccounts(data)
      }
    } catch (error) {
      console.error('Error fetching bank accounts:', error)
    }
  }

  const fetchCreditCards = async () => {
    try {
      const response = await fetch('/api/creditcards')
      if (response.ok) {
        const data = await response.json()
        setCreditCards(data)
      }
    } catch (error) {
      console.error('Error fetching credit cards:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      lastFourDigits: '',
      creditLimit: '',
      balance: '',
      dueDate: '',
      bank: '',
      cardType: '',
      minPayment: '',
      apr: '',
      statementBalance: '',
      autopay: false,
      autopayAccountId: '',
    })
  }

  const handleCreate = async () => {
    try {
      const response = await fetch('/api/creditcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          lastFourDigits: formData.lastFourDigits,
          creditLimit: formData.creditLimit,
          balance: formData.balance,
          dueDate: formData.dueDate,
          bank: formData.bank,
          cardType: formData.cardType,
          minPayment: formData.minPayment,
          apr: formData.apr,
          statementBalance: formData.statementBalance,
          autopay: formData.autopay,
          autopayAccountId: formData.autopayAccountId === 'none' ? null : formData.autopayAccountId,
        }),
      })

      if (response.ok) {
        await fetchCreditCards()
        setShowCreateModal(false)
        resetForm()
      }
    } catch (error) {
      console.error('Error creating credit card:', error)
    }
  }

  const openEditModal = (card: CreditCard) => {
    setSelectedCard(card)
    setFormData({
      name: card.name,
      lastFourDigits: card.lastFourDigits,
      creditLimit: card.creditLimit.toString(),
      balance: card.balance.toString(),
      dueDate: card.dueDate.toString(),
      bank: card.bank || '',
      cardType: card.cardType || '',
      minPayment: card.minPayment ? card.minPayment.toString() : '',
      apr: card.apr ? card.apr.toString() : '',
      statementBalance: card.statementBalance ? card.statementBalance.toString() : '',
      autopay: card.autopay || false,
      autopayAccountId: card.autopayAccountId || '',
    })
    setShowEditModal(true)
  }

  const handleUpdate = async () => {
    if (!selectedCard) return

    try {
      const response = await fetch('/api/creditcards', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedCard.id,
          name: formData.name,
          lastFourDigits: formData.lastFourDigits,
          creditLimit: parseFloat(formData.creditLimit),
          balance: parseFloat(formData.balance),
          dueDate: parseInt(formData.dueDate),
          bank: formData.bank,
          cardType: formData.cardType,
          minPayment: formData.minPayment ? parseFloat(formData.minPayment) : 0,
          apr: formData.apr ? parseFloat(formData.apr) : 0,
          statementBalance: formData.statementBalance ? parseFloat(formData.statementBalance) : 0,
          autopay: formData.autopay,
          autopayAccountId: formData.autopayAccountId === 'none' ? null : formData.autopayAccountId,
        }),
      })

      if (response.ok) {
        await fetchCreditCards()
        setShowEditModal(false)
        setSelectedCard(null)
        resetForm()
      }
    } catch (error) {
      console.error('Error updating credit card:', error)
    }
  }

  const handleDelete = async () => {
    if (!selectedCard) return

    try {
      const response = await fetch(`/api/creditcards?id=${selectedCard.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setCreditCards((prev) => prev.filter((c) => c.id !== selectedCard.id))
        setShowEditModal(false)
        setSelectedCard(null)
      }
    } catch (error) {
      console.error('Error deleting credit card:', error)
    }
  }

  const handleSort = (key: keyof CreditCard) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: keyof CreditCard) => {
    if (sortConfig.key !== key) return <span className="ml-2 text-gray-400">↕</span>;
    return sortConfig.direction === 'asc' ? <span className="ml-2">↑</span> : <span className="ml-2">↓</span>;
  };

  const sortedCreditCards = [...creditCards].sort((a, b) => {
    if (!sortConfig.key) return 0;

    const aValue = a[sortConfig.key];
    const bValue = b[sortConfig.key];

    if (aValue === bValue) return 0;
    
    // Handle null/undefined values
    if (aValue === null || aValue === undefined) return 1;
    if (bValue === null || bValue === undefined) return -1;

    const compareResult = aValue < bValue ? -1 : 1;
    return sortConfig.direction === 'asc' ? compareResult : -compareResult;
  });

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
              variant="default"
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
            <h2 className="text-3xl font-bold">Credit Cards</h2>
            <p className="text-muted-foreground">Manage your credit cards</p>
          </div>
          <Button onClick={() => { resetForm(); setShowCreateModal(true); }}>
            Add Credit Card
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${creditCards.reduce((sum, card) => sum + card.balance, 0).toFixed(2)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Available Credit
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${creditCards.reduce((sum, card) => sum + (card.creditLimit - card.balance), 0).toFixed(2)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Min Payment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${creditCards.reduce((sum, card) => sum + (card.minPayment || 0), 0).toFixed(2)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Credit Cards Table */}
        <Card>
          <CardContent className="pt-6">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead onClick={() => handleSort('name')} className="cursor-pointer select-none">Name {getSortIcon('name')}</TableHead>
                <TableHead onClick={() => handleSort('bank')} className="cursor-pointer select-none">Bank {getSortIcon('bank')}</TableHead>
                <TableHead onClick={() => handleSort('lastFourDigits')} className="cursor-pointer select-none">Last 4 {getSortIcon('lastFourDigits')}</TableHead>
                <TableHead onClick={() => handleSort('creditLimit')} className="cursor-pointer select-none">Limit {getSortIcon('creditLimit')}</TableHead>
                <TableHead onClick={() => handleSort('balance')} className="cursor-pointer select-none">Balance {getSortIcon('balance')}</TableHead>
                <TableHead>Available</TableHead>
                <TableHead onClick={() => handleSort('minPayment')} className="cursor-pointer select-none">Min Payment {getSortIcon('minPayment')}</TableHead>
                <TableHead onClick={() => handleSort('apr')} className="cursor-pointer select-none">APR {getSortIcon('apr')}</TableHead>
                <TableHead onClick={() => handleSort('dueDate')} className="cursor-pointer select-none">Due Day {getSortIcon('dueDate')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedCreditCards.map((card) => (
                <TableRow
                  key={card.id}
                  className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => openEditModal(card)}
                >
                  <TableCell className="font-medium">{card.name}</TableCell>
                  <TableCell>{card.bank || '-'}</TableCell>
                  <TableCell>{card.lastFourDigits}</TableCell>
                  <TableCell>${card.creditLimit.toFixed(2)}</TableCell>
                  <TableCell>${card.balance.toFixed(2)}</TableCell>
                  <TableCell className="text-green-600 dark:text-green-400 font-medium">
                    ${(card.creditLimit - card.balance).toFixed(2)}
                  </TableCell>
                  <TableCell>{card.minPayment ? `$${card.minPayment.toFixed(2)}` : '-'}</TableCell>
                  <TableCell>{card.apr ? `${card.apr}%` : '-'}</TableCell>
                  <TableCell>{card.dueDate}</TableCell>
                </TableRow>
              ))}
              {creditCards.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No credit cards found. Add one to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Create Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Credit Card</DialogTitle>
            <DialogDescription>
              Add a new credit card.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Card Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Chase Sapphire"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bank">Bank Name</Label>
              <Input
                id="bank"
                value={formData.bank}
                onChange={(e) => setFormData({ ...formData, bank: e.target.value })}
                placeholder="e.g. Chase"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lastFourDigits">Last 4 Digits</Label>
                <Input
                  id="lastFourDigits"
                  value={formData.lastFourDigits}
                  onChange={(e) => setFormData({ ...formData, lastFourDigits: e.target.value })}
                  maxLength={4}
                  placeholder="1234"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Day (1-31)</Label>
                <Input
                  id="dueDate"
                  type="number"
                  min="1"
                  max="31"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  placeholder="15"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="creditLimit">Credit Limit</Label>
                <Input
                  id="creditLimit"
                  type="number"
                  value={formData.creditLimit}
                  onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
                  placeholder="5000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="balance">Current Balance</Label>
                <Input
                  id="balance"
                  type="number"
                  value={formData.balance}
                  onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minPayment">Min Payment</Label>
                <Input
                  id="minPayment"
                  type="number"
                  value={formData.minPayment}
                  onChange={(e) => setFormData({ ...formData, minPayment: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apr">APR (%)</Label>
                <Input
                  id="apr"
                  type="number"
                  step="0.01"
                  value={formData.apr}
                  onChange={(e) => setFormData({ ...formData, apr: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="statementBalance">Statement Balance</Label>
                <Input
                  id="statementBalance"
                  type="number"
                  value={formData.statementBalance}
                  onChange={(e) => setFormData({ ...formData, statementBalance: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="flex items-center space-x-2 pt-8">
                <Checkbox
                  id="autopay"
                  checked={formData.autopay}
                  onCheckedChange={(checked) => setFormData({ ...formData, autopay: checked as boolean })}
                />
                <Label htmlFor="autopay">Autopay Enabled</Label>
              </div>
            </div>
            {formData.autopay && (
              <div className="space-y-2">
                <Label>Autopay Account</Label>
                <Select
                  value={formData.autopayAccountId || "none"}
                  onValueChange={(value) => setFormData({ ...formData, autopayAccountId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Bank Account" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select an account</SelectItem>
                    {bankAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name} {account.bankName ? `(${account.bankName})` : ''} (...{account.accountLast4})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Create Card</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Credit Card</DialogTitle>
            <DialogDescription>
              Update credit card details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Card Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-bank">Bank Name</Label>
              <Input
                id="edit-bank"
                value={formData.bank}
                onChange={(e) => setFormData({ ...formData, bank: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-lastFourDigits">Last 4 Digits</Label>
                <Input
                  id="edit-lastFourDigits"
                  value={formData.lastFourDigits}
                  onChange={(e) => setFormData({ ...formData, lastFourDigits: e.target.value })}
                  maxLength={4}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-dueDate">Due Day (1-31)</Label>
                <Input
                  id="edit-dueDate"
                  type="number"
                  min="1"
                  max="31"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-creditLimit">Credit Limit</Label>
                <Input
                  id="edit-creditLimit"
                  type="number"
                  value={formData.creditLimit}
                  onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-balance">Current Balance</Label>
                <Input
                  id="edit-balance"
                  type="number"
                  value={formData.balance}
                  onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-minPayment">Min Payment</Label>
                <Input
                  id="edit-minPayment"
                  type="number"
                  value={formData.minPayment}
                  onChange={(e) => setFormData({ ...formData, minPayment: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-apr">APR (%)</Label>
                <Input
                  id="edit-apr"
                  type="number"
                  step="0.01"
                  value={formData.apr}
                  onChange={(e) => setFormData({ ...formData, apr: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-statementBalance">Statement Balance</Label>
                <Input
                  id="edit-statementBalance"
                  type="number"
                  value={formData.statementBalance}
                  onChange={(e) => setFormData({ ...formData, statementBalance: e.target.value })}
                />
              </div>
              <div className="flex items-center space-x-2 pt-8">
                <Checkbox
                  id="edit-autopay"
                  checked={formData.autopay}
                  onCheckedChange={(checked) => setFormData({ ...formData, autopay: checked as boolean })}
                />
                <Label htmlFor="edit-autopay">Autopay Enabled</Label>
              </div>
            </div>
            {formData.autopay && (
              <div className="space-y-2">
                <Label>Autopay Account</Label>
                <Select
                  value={formData.autopayAccountId || "none"}
                  onValueChange={(value) => setFormData({ ...formData, autopayAccountId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Bank Account" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select an account</SelectItem>
                    {bankAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name} {account.bankName ? `(${account.bankName})` : ''} (...{account.accountLast4})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="destructive" onClick={handleDelete} className="sm:mr-auto">Delete</Button>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button onClick={handleUpdate}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
