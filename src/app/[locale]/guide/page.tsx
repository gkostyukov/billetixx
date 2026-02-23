import path from 'path';
import { promises as fs } from 'fs';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

async function loadGuide(locale: string) {
    const localizedFileName = locale === 'ru' ? 'USER_GUIDE.ru.md' : 'USER_GUIDE.md';

    try {
        const filePath = path.join(process.cwd(), localizedFileName);
        return await fs.readFile(filePath, 'utf-8');
    } catch {
        try {
            const fallbackPath = path.join(process.cwd(), 'USER_GUIDE.md');
            return await fs.readFile(fallbackPath, 'utf-8');
        } catch {
            return 'USER_GUIDE.md not found.';
        }
    }
}

export default async function GuidePage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    const guide = await loadGuide(locale);

    return (
        <div className="container mx-auto p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <div className="max-w-none text-gray-200 leading-relaxed">
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                            h1: ({ children }) => <h1 className="text-3xl font-bold text-white mb-5">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-xl font-semibold text-white mt-8 mb-3">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-lg font-semibold text-white mt-6 mb-2">{children}</h3>,
                            p: ({ children }) => <p className="text-sm text-gray-200 mb-3">{children}</p>,
                            ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-4">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-4">{children}</ol>,
                            li: ({ children }) => <li className="text-sm text-gray-200">{children}</li>,
                            hr: () => <hr className="my-6 border-gray-800" />,
                            a: ({ children, href }) => (
                                <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-300 hover:text-blue-200 underline">
                                    {children}
                                </a>
                            ),
                            code: ({ children }) => (
                                <code className="px-1.5 py-0.5 rounded bg-gray-800 text-blue-200 text-xs">{children}</code>
                            ),
                        }}
                    >
                        {guide}
                    </ReactMarkdown>
                </div>
            </div>
        </div>
    );
}
