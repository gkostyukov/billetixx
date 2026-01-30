import { prisma } from '../src/lib/prisma'
import Database from 'better-sqlite3'

const SQLITE_DB_PATH = './tgts.sqlite3'

// Well-known financial categories
const WELL_KNOWN_CATEGORIES = [
  { name: 'Housing', description: 'Rent, mortgage, property taxes, HOA fees' },
  { name: 'Utilities', description: 'Electric, gas, water, trash, sewer' },
  { name: 'Groceries', description: 'Food and household supplies' },
  { name: 'Transportation', description: 'Car payment, gas, maintenance, public transit' },
  { name: 'Healthcare', description: 'Medical, dental, vision, prescriptions' },
  { name: 'Dining Out', description: 'Restaurants, cafes, takeout' },
  { name: 'Shopping', description: 'Clothing, electronics, home goods' },
  { name: 'Subscriptions', description: 'Streaming services, memberships, software' },
  { name: 'Fitness', description: 'Gym, sports, wellness activities' },
  { name: 'Travel', description: 'Flights, hotels, vacation expenses' },
  { name: 'Education', description: 'Tuition, books, courses, training' },
  { name: 'Pets', description: 'Pet food, vet, supplies' },
  { name: 'Personal Care', description: 'Hair, beauty, grooming' },
  { name: 'Gifts', description: 'Presents, donations, charity' },
  { name: 'Income', description: 'Salary, wages, bonuses' },
  { name: 'Investment', description: 'Stocks, bonds, retirement contributions' },
  { name: 'Savings', description: 'Emergency fund, savings accounts' },
  { name: 'Taxes', description: 'Income tax, property tax' },
  { name: 'Miscellaneous', description: 'Other expenses' },
]

async function migrateCategories() {
  console.log('📦 Starting category migration...\n')

  try {
    // Open SQLite database
    const sqlite = new Database(SQLITE_DB_PATH, { readonly: true })

    // Get categories from SQLite
    const oldCategories = sqlite.prepare('SELECT * FROM budget_category ORDER BY id').all() as any[]

    console.log(`Found ${oldCategories.length} categories in SQLite database\n`)

    // Migrate old categories
    const migratedCategories = []
    for (const oldCat of oldCategories) {
      try {
        const category = await prisma.category.upsert({
          where: { name: oldCat.name },
          update: {
            description: oldCat.description || null,
            active: Boolean(oldCat.active),
          },
          create: {
            name: oldCat.name,
            description: oldCat.description || null,
            active: Boolean(oldCat.active),
          },
        })
        migratedCategories.push(category)
        console.log(`✅ Migrated: ${category.name}`)
      } catch (error) {
        console.error(`❌ Error migrating category "${oldCat.name}":`, error)
      }
    }

    sqlite.close()

    // Add well-known categories
    console.log('\n📝 Adding well-known categories...\n')
    const addedCategories = []
    for (const wellKnown of WELL_KNOWN_CATEGORIES) {
      try {
        const category = await prisma.category.upsert({
          where: { name: wellKnown.name },
          update: {
            description: wellKnown.description,
          },
          create: {
            name: wellKnown.name,
            description: wellKnown.description,
            active: true,
          },
        })
        
        // Only log if it's a new category
        const isNew = !migratedCategories.find(c => c.name === wellKnown.name)
        if (isNew) {
          addedCategories.push(category)
          console.log(`✅ Added: ${category.name}`)
        }
      } catch (error) {
        console.error(`❌ Error adding category "${wellKnown.name}":`, error)
      }
    }

    // Summary
    console.log('\n' + '='.repeat(50))
    console.log('📊 Migration Summary:')
    console.log('='.repeat(50))
    console.log(`Migrated from SQLite: ${migratedCategories.length}`)
    console.log(`Added well-known categories: ${addedCategories.length}`)
    console.log(`Total categories: ${await prisma.category.count()}`)
    console.log('='.repeat(50))

  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  }
}

migrateCategories()
  .then(() => {
    console.log('\n✅ Category migration completed successfully!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Category migration failed:', error)
    process.exit(1)
  })
