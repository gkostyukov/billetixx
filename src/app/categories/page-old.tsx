"use client"

import { useState, useEffect } from "react"
import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"

interface Category {
  id: string
  name: string
  description: string | null
  active: boolean
  createdAt: Date | string
  updatedAt: Date | string
}

export default function CategoriesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [categories, setCategories] = useState<Category[]>([])
  const [filteredCategories, setFilteredCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [editableCategory, setEditableCategory] = useState<Category | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [updateMessage, setUpdateMessage] = useState('')
  
  // New category form
  const [newCategory, setNewCategory] = useState({
    name: '',
    description: '',
    active: true,
  })

  // Filter states
  const [showActive, setShowActive] = useState(true)
  const [showInactive, setShowInactive] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin")
    }
  }, [status, router])

  const fetchCategories = async () => {
    if (status !== "authenticated") return

    try {
      const response = await fetch("/api/categories")
      if (response.ok) {
        const data = await response.json()
        setCategories(data)
      } else {
        console.error("Failed to fetch categories")
      }
    } catch (error) {
      console.error("Error fetching categories:", error)
    }
  }

  useEffect(() => {
    if (status === "authenticated") {
      fetchCategories()
    }
  }, [status])

  // Apply filters
  useEffect(() => {
    const filtered = categories.filter((category) => {
      const activeMatch = (showActive && category.active) || (showInactive && !category.active)
      const searchMatch =
        searchQuery === '' ||
        category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (category.description && category.description.toLowerCase().includes(searchQuery.toLowerCase()))
      return activeMatch && searchMatch
    })
    setFilteredCategories(filtered)
  }, [categories, showActive, showInactive, searchQuery])

  const handleToggleActive = async (category: Category) => {
    const newActive = !category.active
    try {
      const response = await fetch("/api/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: category.id, active: newActive }),
      })

      if (response.ok) {
        setCategories((prev) =>
          prev.map((c) => (c.id === category.id ? { ...c, active: newActive } : c))
        )
      }
    } catch (error) {
      console.error("Error toggling active:", error)
    }
  }

  const openEditModal = (category: Category) => {
    setSelectedCategory(category)
    setEditableCategory({ ...category })
    setUpdateMessage('')
    setIsModalOpen(true)
  }

  const closeEditModal = () => {
    setSelectedCategory(null)
    setEditableCategory(null)
    setUpdateMessage('')
    setIsModalOpen(false)
  }

  const openCreateModal = () => {
    setNewCategory({ name: '', description: '', active: true })
    setUpdateMessage('')
    setIsCreateModalOpen(true)
  }

  const closeCreateModal = () => {
    setNewCategory({ name: '', description: '', active: true })
    setUpdateMessage('')
    setIsCreateModalOpen(false)
  }

  const handleInputChange = (name: string, value: any) => {
    setEditableCategory((prev) => {
      if (!prev) return prev
      return { ...prev, [name]: value }
    })
  }

  const handleNewCategoryChange = (name: string, value: any) => {
    setNewCategory((prev) => ({ ...prev, [name]: value }))
  }

  const handleCreate = async () => {
    if (!newCategory.name.trim()) {
      setUpdateMessage('Category name is required.')
      return
    }

    try {
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCategory),
      })

      if (response.ok) {
        const createdCategory = await response.json()
        setCategories((prev) => [...prev, createdCategory])
        setUpdateMessage('Category created successfully.')
        setTimeout(() => {
          closeCreateModal()
        }, 1000)
      } else {
        const error = await response.json()
        setUpdateMessage(error.error || 'Failed to create category.')
      }
    } catch (error) {
      console.error("Error creating category:", error)
      setUpdateMessage('Failed to create category. Please try again.')
    }
  }

  const handleUpdate = async () => {
    if (!selectedCategory || !editableCategory) return

    if (!editableCategory.name.trim()) {
      setUpdateMessage('Category name is required.')
      return
    }

    try {
      const response = await fetch("/api/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editableCategory),
      })

      if (response.ok) {
        const updatedCategory = await response.json()
        setCategories((prev) =>
          prev.map((c) => (c.id === selectedCategory.id ? updatedCategory : c))
        )
        setUpdateMessage('Category updated successfully.')
      } else {
        const error = await response.json()
        setUpdateMessage(error.error || 'Failed to update category.')
      }
    } catch (error) {
      console.error("Error updating category:", error)
      setUpdateMessage('Failed to update category. Please try again.')
    }
  }

  const handleDelete = async () => {
    if (!selectedCategory) return

    if (!confirm(`Are you sure you want to delete "${selectedCategory.name}"?`)) {
      return
    }

    try {
      const response = await fetch(`/api/categories?id=${selectedCategory.id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        setCategories((prev) => prev.filter((c) => c.id !== selectedCategory.id))
        closeEditModal()
      } else {
        const error = await response.json()
        setUpdateMessage(error.error || 'Failed to delete category.')
      }
    } catch (error) {
      console.error("Error deleting category:", error)
      setUpdateMessage('Failed to delete category. Please try again.')
    }
  }

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
              <Button variant="outline" onClick={() => router.push("/payments")}>
                Payments
              </Button>
              <Button variant="default">
                Categories
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
          <h1 className="text-3xl font-bold">Categories</h1>
          <Button onClick={openCreateModal}>
            Add Category
          </Button>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search categories..."
              />
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="showActive"
                  checked={showActive}
                  onCheckedChange={(checked) => setShowActive(checked as boolean)}
                />
                <Label htmlFor="showActive">Active</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="showInactive"
                  checked={showInactive}
                  onCheckedChange={(checked) => setShowInactive(checked as boolean)}
                />
                <Label htmlFor="showInactive">Inactive</Label>
              </div>
            </div>
          </div>
        </div>

        {/* Categories Table */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
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
                  onClick={(e) => {
                    const target = e.target as HTMLElement
                    if (target.tagName !== 'BUTTON' && target.getAttribute('role') !== 'checkbox') {
                      openEditModal(category)
                    }
                  }}
                >
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell>{category.description || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={category.active ? "default" : "secondary"}>
                      {category.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Checkbox
                      checked={category.active}
                      onCheckedChange={(e) => {
                        e && handleToggleActive(category)
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredCategories.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No categories found
            </div>
          )}
        </div>

        <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          Showing {filteredCategories.length} of {categories.length} categories
        </div>

        {/* Create Category Modal */}
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Category</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="new-name">Name *</Label>
                <Input
                  id="new-name"
                  value={newCategory.name}
                  onChange={(e) => handleNewCategoryChange('name', e.target.value)}
                  placeholder="Enter category name"
                />
              </div>
              <div>
                <Label htmlFor="new-description">Description</Label>
                <Input
                  id="new-description"
                  value={newCategory.description}
                  onChange={(e) => handleNewCategoryChange('description', e.target.value)}
                  placeholder="Enter description (optional)"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="new-active"
                  checked={newCategory.active}
                  onCheckedChange={(checked) => handleNewCategoryChange('active', checked)}
                />
                <Label htmlFor="new-active">Active</Label>
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
            <DialogFooter>
              <Button variant="outline" onClick={closeCreateModal}>
                Cancel
              </Button>
              <Button onClick={handleCreate}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Category Modal */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Category</DialogTitle>
            </DialogHeader>
            {editableCategory && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={editableCategory.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={editableCategory.description || ''}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="active"
                    checked={editableCategory.active}
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
              <Button variant="outline" onClick={closeEditModal}>
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
