import {NextRequest, NextResponse} from 'next/server';

/**
 * Proxy endpoint for loading registration images on the same origin.
 * This avoids CORS/canvas-tainting issues entirely.
 *
 * Usage: /api/proxy-image?url=/uploads/registrations/xxx.png
 */
export async function GET(req: NextRequest) {
    const url = req.nextUrl.searchParams.get('url');
    if (!url || !url.startsWith('/uploads/')) {
        return NextResponse.json({ error: 'Invalid url parameter' }, { status: 400 });
    }

    // Server-side: use internal Docker hostname if available, else public URL
    const apiBase = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

    try {
        const response = await fetch(`${apiBase}${url}`, {
            headers: { 'Cache-Control': 'no-cache' },
        });

        if (!response.ok) {
            return NextResponse.json({ error: `Upstream returned ${response.status}` }, { status: response.status });
        }

        const buffer = await response.arrayBuffer();
        const contentType = response.headers.get('content-type') || 'image/png';

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=86400',
            },
        });
    } catch (err) {
        console.error('[proxy-image] Failed to fetch:', err);
        return NextResponse.json({ error: 'Proxy fetch failed' }, { status: 502 });
    }
}
