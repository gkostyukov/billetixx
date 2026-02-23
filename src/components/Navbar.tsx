"use client"

import { signOut, useSession } from "next-auth/react"
import { useTheme } from "next-themes"
import { useLocale, useTranslations } from "next-intl"
import { useRouter, usePathname, Link } from "@/i18n/routing"
import { Moon, Sun, Globe } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Navbar — top navigation bar for authenticated users.
 *
 * Features:
 * - i18n-aware navigation links (Dashboard, Terminal, Analytics, Settings)
 * - Language switcher (EN ↔ RU) that stays on the current route
 * - Dark/light theme toggle
 * - Displays user name/email and sign-out button
 */
export function Navbar() {
    const { data: session, status } = useSession()
    const { theme, setTheme } = useTheme()
    const t = useTranslations("Nav")
    const locale = useLocale()
    const router = useRouter()
    const pathname = usePathname()

    if (status !== "authenticated") return null

    /** Switch between EN and RU while keeping the current route. */
    const toggleLocale = () => {
        const nextLocale = locale === "ru" ? "en" : "ru"
        router.replace(pathname, { locale: nextLocale })
    }

    const navLinks = [
        { href: "/dashboard", label: t("dashboard") },
        { href: "/trading", label: t("terminal") },
        { href: "/analytics", label: t("analytics") },
        { href: "/guide", label: t("guide") },
        { href: "/settings/api", label: t("settings") },
    ]

    return (
        <div className="border-b bg-gray-950 border-gray-800 sticky top-0 z-40">
            <div className="container mx-auto px-4 py-3">
                <div className="flex items-center justify-between">
                    {/* Logo */}
                    <div>
                        <Link href="/dashboard">
                            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                                Billetixx
                            </h1>
                        </Link>
                        <p className="text-xs text-gray-600">
                            {session?.user?.name || session?.user?.email}
                        </p>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-2">
                        {/* Language switcher */}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={toggleLocale}
                            className="text-gray-400 hover:text-white gap-1.5 text-xs font-semibold"
                            title="Switch language"
                        >
                            <Globe className="h-4 w-4" />
                            {locale.toUpperCase()}
                        </Button>

                        {/* Theme toggle */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                            className="text-gray-400 hover:text-white"
                        >
                            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                            <span className="sr-only">Toggle theme</span>
                        </Button>

                        {/* Sign out */}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => signOut({ callbackUrl: "/" })}
                            className="text-gray-400 hover:text-red-400 text-xs"
                        >
                            {t("signOut")}
                        </Button>
                    </div>
                </div>

                {/* Nav links */}
                <nav className="flex gap-1 mt-3">
                    {navLinks.map(({ href, label }) => {
                        const isActive = pathname === href || pathname.startsWith(href + "/")
                        return (
                            <Link key={href} href={href}>
                                <button className={`text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${isActive
                                        ? "bg-gray-800 text-white"
                                        : "text-gray-400 hover:text-white hover:bg-gray-800/50"
                                    }`}>
                                    {label}
                                </button>
                            </Link>
                        )
                    })}
                </nav>
            </div>
        </div>
    )
}
