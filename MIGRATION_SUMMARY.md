# Data Migration Summary

## Migration Completed Successfully! ✅

### Data Transferred from SQLite to PostgreSQL

| Entity | Count | Status |
|--------|-------|--------|
| **Users** | 3 | ✅ Migrated |
| **Bills** | 95 | ✅ Migrated |
| **Credit Cards** | 12 | ✅ Migrated |
| **Debts** | 44 | ✅ Migrated |
| **Expenses** | 2 | ✅ Migrated (active only) |
| **Incomes** | 4 | ✅ Migrated (active only) |
| **Payments** | 13 | ✅ Migrated (active only) |
| **Categories** | 11 | 📝 Mapped (not stored as separate entities) |

### Users Migrated
1. **admin** → `cmhbiowix00004juzvmnitvrl`
2. **gkostyukov** → `cmhbiowlt00014juzi47xdpdy`
3. **dasha** → `cmhbiowlv00024juzh7oer54w`

### Categories Found
1. Other
2. Gas and Automotive
3. Business related
4. Food and Snacks
5. Family and relatives
6. Rent
7. Insurance
8. Loans
9. Phone & Internet
10. Credit Cards
11. Entertainment

## Schema Mapping

### Old SQLite → New PostgreSQL

| SQLite Table | Prisma Model | Notes |
|-------------|--------------|-------|
| `auth_user` | `User` | Django user → NextAuth user |
| `budget_bill` | `Bill` | Mapped with categories |
| `budget_creditcard` | `CreditCard` | Last 4 digits extracted |
| `budget_debt` | `Debt` | Status mapped (active/paid) |
| `budget_expense` | `Expense` | Only active records |
| `budget_income` | `Income` | Only active records |
| `budget_payment` | `Payment` | Only active records |
| `budget_category` | - | Stored as string in category field |
| `budget_account` | `Account` | OAuth accounts only (NextAuth) |
| `budget_purchase` | - | Not migrated (0 records) |

## Field Mappings

### Bills
- `from_source` → `title`
- `balance` → `amount`
- `due_day_of_month` → `dueDate` (converted to date)
- `fully_paid` → `status` (paid/pending)
- `category_id` → `category` (name lookup)
- `description + comment` → `description`

### Credit Cards
- `number` (last 4) → `lastFourDigits`
- `due_date` (date) → `dueDate` (day of month)

### Debts
- `amount` → `totalAmount`
- `balance` → `remainingAmount`
- `whom_i_owe` → `creditor`

### Expenses & Incomes
- Only active records were migrated
- Categories mapped by ID to name

## Next Steps

### 1. **Verify Data**
Prisma Studio is running at: http://localhost:5555
- Browse and verify all migrated data
- Check user associations
- Verify amounts and dates

### 2. **Test Authentication**
The old Django passwords are already hashed and were migrated. However:
- **Option A**: Reset passwords for all users using the app
- **Option B**: Rehash passwords to bcrypt format (if Django used different hashing)

To rehash passwords, you may need to ask users to reset their passwords on first login.

### 3. **Data Not Migrated**
- **Purchases**: 0 records in old database
- **Accounts**: OAuth/banking accounts (different purpose in new schema)
- **Inactive records**: Filtered out during migration

### 4. **Additional Features to Consider**

Based on your old database structure, you might want to add:

1. **Category Model** - Instead of string categories, create a proper Category model
2. **Recurring Bills/Expenses** - Track recurring payments
3. **APR/Interest** - Credit card and debt interest tracking
4. **Autopay Tracking** - Track which bills have autopay enabled
5. **Statement Balance** - Track credit card statement balances
6. **Purchase Tracking** - Add receipt and purchase tracking functionality

### 5. **Clean Up**
Once you've verified everything works:
```bash
# Backup the old SQLite file
mv tgts.sqlite3 tgts.sqlite3.backup

# Or remove it
rm tgts.sqlite3
```

## Migration Script Location
The migration script is saved at: `scripts/migrate-from-sqlite.ts`

You can re-run it if needed (after clearing the database):
```bash
npx prisma migrate reset --force
npx tsx scripts/migrate-from-sqlite.ts
```

## Troubleshooting

### If you need to reset and re-migrate:
```bash
# Clear all data
npx prisma migrate reset --force

# Re-run migration
npx tsx scripts/migrate-from-sqlite.ts
```

### To check data in PostgreSQL directly:
```bash
# Connect to PostgreSQL
docker exec -it billetixx-db psql -U user -d billetixx

# Query tables
\dt
SELECT COUNT(*) FROM "User";
SELECT COUNT(*) FROM "Bill";
```
