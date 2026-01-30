'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface BankAccount {
  id: string
  name: string
  bankName?: string | null
  accountLast4: string
  cardLast4?: string | null
  active: boolean
}

export default function AccountsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    bankName: '',
    accountLast4: '',
    cardLast4: '',
    active: true,
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, router])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchAccounts()
    }
  }, [status])

  const fetchAccounts = async () => {
    try {
      const response = await fetch('/api/bank-accounts')
      if (response.ok) {
        const data = await response.json()
        setAccounts(data)
      }
    } catch (error) {
      console.error('Error fetching accounts:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      bankName: '',
      accountLast4: '',
      cardLast4: '',
      active: true,
    })
  }

  const handleCreate = async () => {
    try {
      const response = await fetch('/api/bank-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          bankName: formData.bankName,
          accountLast4: formData.accountLast4,
          cardLast4: formData.cardLast4,
          active: formData.active,
        }),
      })

      if (response.ok) {
        await fetchAccounts()
        setShowCreateModal(false)
        resetForm()
      }
    } catch (error) {
      console.error('Error creating account:', error)
    }
  }

  const openEditModal = (account: BankAccount) => {
    setSelectedAccount(account)
    setFormData({
      name: account.name,
      bankName: account.bankName || '',
      accountLast4: account.accountLast4,
      cardLast4: account.cardLast4 || '',
      active: account.active,
    })
    setShowEditModal(true)
  }

  const handleUpdate = async () => {
    if (!selectedAccount) return

    try {
      const response = await fetch('/api/bank-accounts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedAccount.id,
          name: formData.name,
          bankName: formData.bankName,
          accountLast4: formData.accountLast4,
          cardLast4: formData.cardLast4,
          active: formData.active,
        }),
      })

      if (response.ok) {
        await fetchAccounts()
        setShowEditModal(false)
        setSelectedAccount(null)
        resetForm()
      }
    } catch (error) {
      console.error('Error updating account:', error)
    }
  }

  const handleDelete = async () => {
    if (!selectedAccount) return

    try {
      const response = await fetch(`/api/bank-accounts?id=${selectedAccount.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setAccounts((prev) => prev.filter((a) => a.id !== selectedAccount.id))
        setShowEditModal(false)
        setSelectedAccount(null)
      }
    } catch (error) {
      console.error('Error deleting account:', error)
    }
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
              variant="ghost"
              onClick={() => router.push('/payments')}
              className="font-medium"
            >
              Payments
            </Button>
            <Button
              variant="default"
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
            <h2 className="text-3xl font-bold">Accounts</h2>
            <p className="text-muted-foreground">Manage your bank accounts and cards</p>
          </div>
          <Button onClick={() => { resetForm(); setShowCreateModal(true); }}>
            Add Account
          </Button>
        </div>

        {/* Accounts Table */}
        <Card>
          <CardContent className="pt-6">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Bank Name</TableHead>
                <TableHead>Account Last 4</TableHead>
                <TableHead>Card Last 4</TableHead>
                <TableHead>Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <TableRow
                  key={account.id}
                  className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => openEditModal(account)}
                >
                  <TableCell className="font-medium">{account.name}</TableCell>
                  <TableCell>{account.bankName || '-'}</TableCell>
                  <TableCell>{account.accountLast4}</TableCell>
                  <TableCell>{account.cardLast4 || '-'}</TableCell>
                  <TableCell>
                    <Checkbox
                      checked={account.active}
                      disabled
                    />
                  </TableCell>
                </TableRow>
              ))}
              {accounts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No accounts found. Add one to get started.
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
            <DialogTitle>Add Account</DialogTitle>
            <DialogDescription>
              Add a new bank account or credit card.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Account Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Checking, Savings"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bankName">Bank Name</Label>
              <Input
                id="bankName"
                value={formData.bankName}
                onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                placeholder="e.g. Chase, Bank of America"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="accountLast4">Account Last 4</Label>
                <Input
                  id="accountLast4"
                  value={formData.accountLast4}
                  onChange={(e) => setFormData({ ...formData, accountLast4: e.target.value })}
                  maxLength={4}
                  placeholder="1234"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cardLast4">Card Last 4 (Optional)</Label>
                <Input
                  id="cardLast4"
                  value={formData.cardLast4}
                  onChange={(e) => setFormData({ ...formData, cardLast4: e.target.value })}
                  maxLength={4}
                  placeholder="5678"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="active"
                checked={formData.active}
                onCheckedChange={(checked) => setFormData({ ...formData, active: checked as boolean })}
              />
              <Label htmlFor="active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Create Account</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
            <DialogDescription>
              Update account details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Account Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-bankName">Bank Name</Label>
              <Input
                id="edit-bankName"
                value={formData.bankName}
                onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-accountLast4">Account Last 4</Label>
                <Input
                  id="edit-accountLast4"
                  value={formData.accountLast4}
                  onChange={(e) => setFormData({ ...formData, accountLast4: e.target.value })}
                  maxLength={4}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-cardLast4">Card Last 4</Label>
                <Input
                  id="edit-cardLast4"
                  value={formData.cardLast4}
                  onChange={(e) => setFormData({ ...formData, cardLast4: e.target.value })}
                  maxLength={4}
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-active"
                checked={formData.active}
                onCheckedChange={(checked) => setFormData({ ...formData, active: checked as boolean })}
              />
              <Label htmlFor="edit-active">Active</Label>
            </div>
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
