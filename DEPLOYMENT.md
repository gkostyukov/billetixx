# Billetixx Deployment Guide

This guide covers different deployment options for the Billetixx application.

## Table of Contents
- [Local Development](#local-development)
- [Docker Deployment](#docker-deployment)
- [Vercel Deployment](#vercel-deployment)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)

## Local Development

### Prerequisites
- Node.js 20 or higher
- PostgreSQL 14 or higher
- npm or yarn

### Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/gkostyukov/billetixx.git
   cd billetixx
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up PostgreSQL**
   - Install PostgreSQL on your system
   - Create a database:
     ```bash
     createdb billetixx
     ```

4. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env`:
   ```env
   DATABASE_URL="postgresql://username:password@localhost:5432/billetixx?schema=public"
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="generate-a-random-secret-key"
   NODE_ENV="development"
   ```

   Generate a secure secret:
   ```bash
   openssl rand -base64 32
   ```

5. **Set up the database**
   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   npm run prisma:seed
   ```

6. **Start the development server**
   ```bash
   npm run dev
   ```

7. **Access the application**
   Open [http://localhost:3000](http://localhost:3000)
   
   **Demo Login:**
   - Email: `demo@billetixx.com`
   - Password: `demo123`

## Docker Deployment

### Using Docker Compose (Recommended)

1. **Clone the repository**
   ```bash
   git clone https://github.com/gkostyukov/billetixx.git
   cd billetixx
   ```

2. **Update environment variables in docker-compose.yml**
   ```yaml
   environment:
     DATABASE_URL: "postgresql://user:password@postgres:5432/billetixx?schema=public"
     NEXTAUTH_URL: "http://localhost:3000"
     NEXTAUTH_SECRET: "your-production-secret-key"
     NODE_ENV: "production"
   ```

3. **Build and start containers**
   ```bash
   docker-compose up -d
   ```

4. **Run migrations and seed data**
   ```bash
   docker-compose exec app npx prisma migrate deploy
   docker-compose exec app npm run prisma:seed
   ```

5. **Access the application**
   Open [http://localhost:3000](http://localhost:3000)

### Using Docker Only

1. **Build the image**
   ```bash
   docker build -t billetixx .
   ```

2. **Run PostgreSQL**
   ```bash
   docker run -d \
     --name billetixx-db \
     -e POSTGRES_PASSWORD=password \
     -e POSTGRES_USER=user \
     -e POSTGRES_DB=billetixx \
     -p 5432:5432 \
     postgres:16-alpine
   ```

3. **Run the application**
   ```bash
   docker run -d \
     --name billetixx-app \
     -p 3000:3000 \
     -e DATABASE_URL="postgresql://user:password@host.docker.internal:5432/billetixx?schema=public" \
     -e NEXTAUTH_URL="http://localhost:3000" \
     -e NEXTAUTH_SECRET="your-secret-key" \
     billetixx
   ```

## Vercel Deployment

### Prerequisites
- Vercel account
- PostgreSQL database (Vercel Postgres, Neon, Supabase, etc.)

### Steps

1. **Push to GitHub**
   ```bash
   git push origin main
   ```

2. **Import in Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "Import Project"
   - Select your GitHub repository

3. **Configure Environment Variables**
   Add these in Vercel project settings:
   
   ```
   DATABASE_URL=postgresql://user:password@host:5432/database?schema=public
   NEXTAUTH_URL=https://your-app.vercel.app
   NEXTAUTH_SECRET=your-production-secret-key
   NODE_ENV=production
   ```

4. **Deploy**
   - Click "Deploy"
   - Vercel will automatically build and deploy

5. **Run Database Migrations**
   After first deployment, run migrations:
   ```bash
   # Install Vercel CLI
   npm i -g vercel
   
   # Login to Vercel
   vercel login
   
   # Run migration
   vercel env pull .env.local
   npx prisma migrate deploy
   npx prisma db seed
   ```

### Database Options for Vercel

#### Vercel Postgres
```bash
# Install Vercel Postgres
vercel postgres create

# Link to your project
vercel link
```

#### Neon (Recommended)
1. Go to [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string
4. Add to Vercel environment variables

#### Supabase
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Get the connection string from project settings
4. Add to Vercel environment variables

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `NEXTAUTH_URL` | Your application URL | `http://localhost:3000` |
| `NEXTAUTH_SECRET` | Random secret for JWT | Use `openssl rand -base64 32` |
| `NODE_ENV` | Environment | `development` or `production` |

### Security Notes

- **Never commit `.env` file to version control**
- Generate unique `NEXTAUTH_SECRET` for production
- Use SSL for production database connections
- Rotate secrets regularly

## Database Setup

### Running Migrations

```bash
# Development
npm run prisma:migrate

# Production
npx prisma migrate deploy
```

### Seeding Data

```bash
npm run prisma:seed
```

This creates a demo user:
- Email: `demo@billetixx.com`
- Password: `demo123`

### Resetting Database

```bash
npx prisma migrate reset
```

⚠️ Warning: This will delete all data!

## Troubleshooting

### Build Errors

If you encounter build errors:

```bash
# Clear cache
rm -rf .next node_modules
npm install
npm run build
```

### Database Connection Issues

1. Check DATABASE_URL is correct
2. Ensure database is running
3. Verify network access
4. Check SSL settings for production

### Migration Issues

```bash
# Check migration status
npx prisma migrate status

# Create new migration
npx prisma migrate dev --name migration_name

# Apply migrations
npx prisma migrate deploy
```

## Performance Optimization

### Production Build

```bash
npm run build
npm start
```

### Docker Production

Use multi-stage builds (already configured in Dockerfile):
- Reduces image size
- Improves security
- Faster deployments

### Vercel Edge

Vercel automatically:
- Enables Edge caching
- Optimizes images
- Provides CDN
- Auto-scales

## Monitoring

### Logs

**Docker:**
```bash
docker-compose logs -f app
```

**Vercel:**
- View logs in Vercel dashboard
- Real-time log streaming
- Error tracking

### Health Checks

Add health check endpoint:
```typescript
// src/app/api/health/route.ts
export async function GET() {
  return Response.json({ status: 'ok' })
}
```

## Backup

### Database Backup

```bash
# Backup
pg_dump -h localhost -U user billetixx > backup.sql

# Restore
psql -h localhost -U user billetixx < backup.sql
```

### Automated Backups

- Vercel Postgres: Automatic backups
- Neon: Point-in-time recovery
- Supabase: Daily backups

## Support

For issues or questions:
- GitHub Issues: https://github.com/gkostyukov/billetixx/issues
- Email: support@billetixx.com

---

Last updated: 2024
