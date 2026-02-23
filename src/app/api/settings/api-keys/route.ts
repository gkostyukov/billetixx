import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                oandaEnvironment: true,
                oandaPracticeAccountId: true,
                oandaPracticeToken: true,
                oandaLiveAccountId: true,
                oandaLiveToken: true,
                openaiApiKey: true,
            },
        });

        // We mask the tokens before sending them to the client
        const maskToken = (token: string | null) =>
            token ? `${token.substring(0, 4)}••••••••••${token.substring(token.length - 4)}` : "";

        return NextResponse.json({
            settings: {
                oandaEnvironment: user?.oandaEnvironment || "practice",
                oandaPracticeAccountId: user?.oandaPracticeAccountId || "",
                oandaPracticeToken: maskToken(user?.oandaPracticeToken),
                oandaLiveAccountId: user?.oandaLiveAccountId || "",
                oandaLiveToken: maskToken(user?.oandaLiveToken),
                openaiApiKey: maskToken(user?.openaiApiKey),
            },
            hasPracticeKeys: !!(user?.oandaPracticeAccountId && user?.oandaPracticeToken),
            hasLiveKeys: !!(user?.oandaLiveAccountId && user?.oandaLiveToken),
            hasOpenAIKey: !!user?.openaiApiKey
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const dataToUpdate: any = {};

        if (body.oandaEnvironment) dataToUpdate.oandaEnvironment = body.oandaEnvironment;
        if (body.oandaPracticeAccountId !== undefined) dataToUpdate.oandaPracticeAccountId = body.oandaPracticeAccountId;
        if (body.oandaPracticeToken && !body.oandaPracticeToken.includes('••••')) {
            dataToUpdate.oandaPracticeToken = body.oandaPracticeToken;
        }
        if (body.oandaLiveAccountId !== undefined) dataToUpdate.oandaLiveAccountId = body.oandaLiveAccountId;
        if (body.oandaLiveToken && !body.oandaLiveToken.includes('••••')) {
            dataToUpdate.oandaLiveToken = body.oandaLiveToken;
        }
        if (body.openaiApiKey && !body.openaiApiKey.includes('••••')) {
            dataToUpdate.openaiApiKey = body.openaiApiKey;
        }

        await prisma.user.update({
            where: { id: session.user.id },
            data: dataToUpdate,
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
