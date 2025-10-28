import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <main className="flex flex-col items-center text-center gap-8 max-w-3xl">
        <div className="space-y-4">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-gray-900 dark:text-white">
            Welcome to <span className="text-blue-600 dark:text-blue-400">Billetixx</span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl">
            Your complete financial management solution. Track bills, payments, expenses, income, debts, and credit cards all in one place.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mt-8">
          <Link href="/auth/signin">
            <Button size="lg" className="w-full sm:w-auto">
              Sign In
            </Button>
          </Link>
          <Link href="/auth/signup">
            <Button size="lg" variant="outline" className="w-full sm:w-auto">
              Create Account
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 w-full">
          <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">📊 Dashboard</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Visualize your financial data with interactive charts and insights
            </p>
          </div>
          <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">💳 Track Everything</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Manage bills, payments, expenses, income, and credit cards
            </p>
          </div>
          <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">🌙 Dark Mode</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Comfortable viewing experience in light or dark mode
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
