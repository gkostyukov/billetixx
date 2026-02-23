"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("Global Next.js Error Caught:", error);
    }, [error]);

    return (
        <html>
            <body>
                <div className="flex min-h-screen flex-col items-center justify-center p-4">
                    <h2 className="text-2xl font-bold text-red-600 mb-4">Something went wrong systematically!</h2>
                    <div className="bg-gray-100 p-4 rounded-md w-full max-w-2xl overflow-auto text-sm text-left mb-6">
                        <p className="font-semibold">{error.message}</p>
                        {error.stack && <pre className="mt-2 text-xs text-gray-700">{error.stack}</pre>}
                    </div>
                    <Button onClick={() => reset()}>Try again</Button>
                </div>
            </body>
        </html>
    );
}
