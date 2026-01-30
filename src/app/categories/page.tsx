'use client'

import { useState, useEffect } from 'react'
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
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

interface Category {
  id: string
  name: string
  description?: string | null
  active: boolean
  createdAt: string
  updatedAt: string
}

export default function CategoriesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [categories, setCategories] = useState<Category[]>([])
  const [filteredCategories, setFilteredCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)

  // Filter states
  const [showActive, setShowActive] = useState(true)
  const [showInactive, setShowInactive] = useState(false)
  const [filterName, setFilterName] = useState('')

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    active: true,
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, router])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchCategories()
    }
  }, [status])

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories')
      if (response.ok) {
        const data = await response.json()
        setCategories(data)
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Apply filters
  useEffect(() => {
    const filtered = categories.filter((category) => {
      const activeMatch = (showActive && category.active) || (showInactive && !category.active)
      const nameMatch =
        filterName === '' ||
        category.name.toLowerCase().includes(filterName.toLowerCase())
      return activeMatch && nameMatch
    })
    setFilteredCategories(filtered)
  }, [categories, showActive, showInactive, filterName])

  const handleToggleActive = async (category: Category) => {
    try {
      const response = await fetch('/api/categories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: category.id, active: !category.active }),
      })

      if (response.ok) {
        setCategories((prev) =>
          prev.map((c) => (c.id === category.id ? { ...c, active: !c.active } : c))
        )
      }
    } catch (error) {
      console.error('Error toggling active:', error)
    }
  }

  const openCreateModal = () => {
    setFormData({ name: '', description: '', active: true })
    setShowCreateModal(true)
  }

  const openEditModal = (category: Category) => {
    setSelectedCategory(category)
    setFormData({
      name: category.name,
      description: category.description || '',
      active: category.active,
    })
    setShowEditModal(true)
  }

  const handleCreate = async () => {
    try {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        await fetchCategories()
        setShowCreateModal(false)
        setFormData({ name: '', description: '', active: true })
      }
    } catch (error) {
      console.error('Error creating category:', error)
    }
  }

  const handleUpdate = async () => {
    if (!selectedCategory) return

    try {
      const response = await fetch('/api/categories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedCategory.id,
          ...formData,
        }),
      })

      if (response.ok) {
        await fetchCategories()
        setShowEditModal(false)
        setSelectedCategory(null)
      }
    } catch (error) {
      console.error('Error updating category:', error)
    }
  }

  const handleDelete = async () => {
    if (!selectedCategory) return

    try {
      const response = await fetch(`/api/categories?id=${selectedCategory.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setCategories((prev) => prev.filter((c) => c.id !== selectedCategory.id))
        setShowEditModal(false)
        setSelectedCategory(null)
      }
    } catch (error) {
      console.error('Error deleting category:', error)
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
              variant="default"
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
            <h2 className="text-3xl font-bold">Categories</h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Manage expense and payment categories
            </p>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Filter by name..."
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              className="w-64"
            />
            <Button onClick={openCreateModal}>
              Add Category
            </Button>
          </div>
        </div>

        {/* Filter Toggles */}
        <div className="flex gap-4 mb-4">
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
        </div>

        {/* Categories Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCategories.map((category) => (
                <TableRow
                  key={category.id}
                  className="cursor-pointer"
                  onClick={() => openEditModal(category)}
                >
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell>{category.description || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={category.active ? 'default' : 'secondary'}>
                      {category.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={category.active}
                      onCheckedChange={() => handleToggleActive(category)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Create Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Category</DialogTitle>
            <DialogDescription>
              Add a new category for organizing your expenses and payments.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Groceries, Utilities"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="active-create"
                checked={formData.active}
                onCheckedChange={(checked) => setFormData({ ...formData, active: checked as boolean })}
              />
              <Label htmlFor="active-create">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate}>Create Category</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
            <DialogDescription>
              Update category details or delete this category.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-description">Description</Label>
              <Input
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="active-edit"
                checked={formData.active}
                onCheckedChange={(checked) => setFormData({ ...formData, active: checked as boolean })}
              />
              <Label htmlFor="active-edit">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
            <Button onClick={handleUpdate}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
