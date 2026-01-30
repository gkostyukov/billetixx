# Running Billetixx in GitHub Codespaces

Follow these steps to get your development environment up and running in GitHub Codespaces.

## 1. Start the Database

Billetixx uses PostgreSQL. The easiest way to run it is via Docker:

```bash
docker-compose up -d postgres
```

This will start only the database container in the background, mapping port `5432` to your Codespace.

## 2. Set Up Environment Variables

If you don't already have an `.env` file, create one by copying the example provided in the README or using these defaults:

```bash
# Check if .env exists, if not you can create it
# The default values in .env match the docker-compose postgres configuration
```

Make sure `DATABASE_URL` is set to:
`DATABASE_URL="postgresql://user:password@localhost:5432/billetixx?schema=public"`

## 3. Install Dependencies

Install the project dependencies using npm:

```bash
npm install
```

## 4. Prepare the Database

Generate the Prisma client and run migrations to set up your database schema:

```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Seed the database with demo data (optional but recommended)
npm run prisma:seed
```

## 5. Start the Development Server

Now you can start the Next.js development server:

```bash
npm run dev
```

## 6. Access the Application

Once the server starts, GitHub Codespaces will provide a notification with a button to **Open in Browser**. Alternatively, you can go to the **Ports** tab in the terminal area and click the "Open in Browser" icon next to port `3000`.

### Demo Credentials
If you seeded the database, you can log in with:
- **Email**: `demo@billetixx.com`
- **Password**: `demo123`

---

## Troubleshooting

- **Database Connection**: If the app can't connect to the database, ensure the Docker container is running (`docker ps`) and that `DATABASE_URL` in `.env` uses `localhost` as the host.
- **Port Visibility**: Ensure port `3000` is set to "Public" or "Private" (shared) in the Ports tab if you're having trouble accessing the URL.
