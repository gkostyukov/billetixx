import Link from "next/link";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

/**
 * Landing page — shown to unauthenticated visitors.
 * Authenticated users are immediately redirected to /dashboard.
 */
export default async function Home() {
    const session = await auth();

    if (session?.user) {
        redirect("/dashboard");
    }

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 px-4">
            {/* Background glow */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 left-1/3 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-3xl" />
            </div>

            <main className="relative flex flex-col items-center text-center gap-10 max-w-3xl">
                {/* Hero */}
                <div className="space-y-4">
                    <div className="inline-flex items-center gap-2 bg-blue-950/60 border border-blue-800/50 text-blue-300 text-xs font-medium px-4 py-1.5 rounded-full mb-2">
                        <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
                        AI-Powered Forex Trading
                    </div>
                    <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-white">
                        Billetixx{" "}
                        <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                            Terminal
                        </span>
                    </h1>
                    <p className="text-lg text-gray-400 max-w-xl mx-auto">
                        Live OANDA integration, AI-powered analysis, and real-time charts — all in one place.
                    </p>
                </div>

                {/* CTA */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <Link href="/auth/signin">
                        <Button size="lg" className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8">
                            Sign In
                        </Button>
                    </Link>
                    <Link href="/auth/signup">
                        <Button size="lg" variant="outline" className="w-full sm:w-auto border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 px-8">
                            Create Account
                        </Button>
                    </Link>
                </div>

                {/* Feature Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mt-4">
                    <div className="p-6 bg-gray-900 border border-gray-800 rounded-xl text-left">
                        <div className="text-2xl mb-3">📊</div>
                        <h3 className="text-base font-semibold text-white mb-1">Live Dashboard</h3>
                        <p className="text-gray-500 text-sm">
                            Real-time account balance, NAV, P&L, and open positions from your OANDA account.
                        </p>
                    </div>
                    <div className="p-6 bg-gray-900 border border-gray-800 rounded-xl text-left">
                        <div className="text-2xl mb-3">⚡</div>
                        <h3 className="text-base font-semibold text-white mb-1">Trading Terminal</h3>
                        <p className="text-gray-500 text-sm">
                            Interactive candlestick charts with AI-powered scenario generation via OpenAI GPT.
                        </p>
                    </div>
                    <div className="p-6 bg-gray-900 border border-gray-800 rounded-xl text-left">
                        <div className="text-2xl mb-3">🧠</div>
                        <h3 className="text-base font-semibold text-white mb-1">AI Analytics</h3>
                        <p className="text-gray-500 text-sm">
                            Decision tickets with entry, SL, TP and full AI rationale — saved and filterable.
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}
