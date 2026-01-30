# Billetixx - Full-Stack Financial Management Application

A comprehensive financial management dashboard built with Next.js 15, TypeScript, Prisma, PostgreSQL, and NextAuth. Track your bills, payments, expenses, income, credit cards, and debts all in one beautiful interface.

## Features

- 🔐 **Authentication**: Secure authentication with NextAuth.js and JWT
- 💳 **Financial Management**: 
  - Bills tracking with due dates and status
  - Payment history
  - Expense tracking by category
  - Income management
  - Credit card monitoring
  - Debt tracking with interest rates
- 📊 **Interactive Dashboard**: Beautiful charts and visualizations using Recharts
- 🌙 **Dark Mode**: Full dark/light theme support with next-themes
- 🎨 **Modern UI**: Built with TailwindCSS and shadcn/ui components
- 🐳 **Docker Support**: Easy deployment with Docker and Docker Compose
- � **GitHub Codespaces**: [Quick Start in Codespaces](CODESPACES.md)
- �🔄 **REST API**: Complete CRUD operations for all entities
- 📱 **Responsive**: Mobile-friendly design

## Tech Stack

- **Frontend**: Next.js 15 (App Router), TypeScript, React 19
- **Styling**: TailwindCSS v4, shadcn/ui
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL
- **Authentication**: NextAuth.js v5 with JWT
- **Charts**: Recharts
- **Deployment**: Docker, Vercel-ready

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL (or use Docker)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/gkostyukov/billetixx.git
cd billetixx
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and update the following:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/billetixx?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"
```

4. Set up the database:
```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Seed the database with demo data
npm run prisma:seed
```

5. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

### Demo Credentials

After seeding the database, you can use these credentials:
- **Email**: demo@billetixx.com
- **Password**: demo123

## Docker Deployment

### Using Docker Compose

1. Make sure Docker and Docker Compose are installed

2. Build and start the containers:
```bash
docker-compose up -d
```

3. The application will be available at `http://localhost:3000`

4. To run migrations and seed data:
```bash
docker-compose exec app npx prisma migrate deploy
docker-compose exec app npm run prisma:seed
```

### Building Docker Image Manually

```bash
docker build -t billetixx .
docker run -p 3000:3000 billetixx
```

## Vercel Deployment

1. Push your code to GitHub

2. Import your repository in Vercel

3. Add environment variables in Vercel dashboard:
   - `DATABASE_URL`: Your PostgreSQL connection string
   - `NEXTAUTH_URL`: Your production URL
   - `NEXTAUTH_SECRET`: Generate a secure secret

4. Deploy!

For PostgreSQL, you can use Vercel Postgres, Neon, or any other provider.

## API Routes

All API routes require authentication (except `/api/register`).

### Authentication
- `POST /api/register` - Register new user
- `POST /api/auth/[...nextauth]` - NextAuth endpoints

### Bills
- `GET /api/bills` - Get all bills
- `POST /api/bills` - Create bill
- `PUT /api/bills` - Update bill
- `DELETE /api/bills?id=<id>` - Delete bill

### Payments
- `GET /api/payments` - Get all payments
- `POST /api/payments` - Create payment
- `PUT /api/payments` - Update payment
- `DELETE /api/payments?id=<id>` - Delete payment

### Expenses
- `GET /api/expenses` - Get all expenses
- `POST /api/expenses` - Create expense
- `PUT /api/expenses` - Update expense
- `DELETE /api/expenses?id=<id>` - Delete expense

### Income
- `GET /api/incomes` - Get all incomes
- `POST /api/incomes` - Create income
- `PUT /api/incomes` - Update income
- `DELETE /api/incomes?id=<id>` - Delete income

### Credit Cards
- `GET /api/creditcards` - Get all credit cards
- `POST /api/creditcards` - Create credit card
- `PUT /api/creditcards` - Update credit card
- `DELETE /api/creditcards?id=<id>` - Delete credit card

### Debts
- `GET /api/debts` - Get all debts
- `POST /api/debts` - Create debt
- `PUT /api/debts` - Update debt
- `DELETE /api/debts?id=<id>` - Delete debt

## Database Schema

The application uses the following Prisma models:

- **User**: User authentication and profile
- **Bill**: Bill tracking with due dates and status
- **Payment**: Payment history
- **Expense**: Expense tracking with categories
- **Income**: Income sources
- **CreditCard**: Credit card information and balances
- **Debt**: Debt tracking with interest rates
- **Account**: OAuth account linking (NextAuth)
- **Session**: Session management (NextAuth)
- **VerificationToken**: Email verification (NextAuth)

## Project Structure

```
billetixx/
├── src/
│   ├── app/
│   │   ├── api/              # API routes
│   │   ├── auth/             # Authentication pages
│   │   ├── dashboard/        # Dashboard page
│   │   ├── globals.css       # Global styles
│   │   ├── layout.tsx        # Root layout
│   │   └── page.tsx          # Home page
│   ├── components/
│   │   ├── ui/               # shadcn/ui components
│   │   ├── providers.tsx     # Auth providers
│   │   └── theme-provider.tsx
│   ├── lib/
│   │   ├── auth.ts           # NextAuth configuration
│   │   ├── prisma.ts         # Prisma client
│   │   ├── api-helpers.ts    # API utilities
│   │   └── utils.ts          # Utility functions
│   └── types/                # TypeScript types
├── prisma/
│   ├── schema.prisma         # Database schema
│   └── seed.ts               # Seed data
├── public/                   # Static files
├── docker-compose.yml        # Docker Compose config
├── Dockerfile               # Docker configuration
├── next.config.ts           # Next.js configuration
├── tailwind.config.ts       # Tailwind configuration
└── package.json             # Dependencies and scripts

```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:seed` - Seed database with demo data
- `npm run docker:build` - Build Docker images
- `npm run docker:up` - Start Docker containers
- `npm run docker:down` - Stop Docker containers

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the [MIT License](LICENSE).

## Support

For support, email support@billetixx.com or open an issue on GitHub.

---

Made with ❤️ using Next.js 15
