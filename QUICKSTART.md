# Quick Start Guide

Get Billetixx running in 5 minutes!

## Option 1: Docker (Fastest)

```bash
# Clone the repo
git clone https://github.com/gkostyukov/billetixx.git
cd billetixx

# Start with Docker
docker-compose up -d

# Run migrations and seed
docker-compose exec app npx prisma migrate deploy
docker-compose exec app npm run prisma:seed

# Open http://localhost:3000
# Login: demo@billetixx.com / demo123
```

## Option 2: Local Development

```bash
# Clone the repo
git clone https://github.com/gkostyukov/billetixx.git
cd billetixx

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your PostgreSQL credentials

# Set up database
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed

# Start dev server


# Open http://localhost:3000
# Login: demo@billetixx.com / demo123
```

## What You Get

After login, you'll see:
- 📊 Financial dashboard with charts
- 💰 Income tracking
- 💳 Expense management
- 📅 Bill reminders
- 💳 Credit card monitoring
- 📈 Debt tracking

## Next Steps

1. Explore the dashboard
2. Add your own financial data
3. Customize categories
4. Set up recurring transactions
5. Export reports

## Need Help?

- Read the full [README.md](README.md)
- Check [DEPLOYMENT.md](DEPLOYMENT.md) for production setup
- Open an issue on GitHub

Enjoy managing your finances! 💰
