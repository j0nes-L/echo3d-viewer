import type {APIRoute} from 'astro';
import {getApiUrl} from '../../lib/endpoint-config';

export const DELETE: APIRoute = async ({request}) => {
    const apiKey = import.meta.env.SNAPSPACE_API_KEY;
    const baseUrl = getApiUrl();

    if (!apiKey) {
        return new Response(JSON.stringify({error: 'API key is not configured.'}), {
            status: 500,
            headers: {'Content-Type': 'application/json'},
        });
    }

    const adminPassword = request.headers.get('X-Admin-Password');
    if (!adminPassword) {
        return new Response(JSON.stringify({error: 'Unauthorized.'}), {
            status: 401,
            headers: {'Content-Type': 'application/json'},
        });
    }

    try {
        const authRes = await fetch(`${baseUrl}/auth/login`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({password: adminPassword}),
        });
        if (!authRes.ok) {
            return new Response(JSON.stringify({error: 'Unauthorized.'}), {
                status: 401,
                headers: {'Content-Type': 'application/json'},
            });
        }
        const authData = await authRes.json();
        if (authData.authenticated !== true || authData.role !== 'admin') {
            return new Response(JSON.stringify({error: 'Forbidden. Admin role required.'}), {
                status: 403,
                headers: {'Content-Type': 'application/json'},
            });
        }
    } catch {
        return new Response(JSON.stringify({error: 'Could not verify credentials.'}), {
            status: 502,
            headers: {'Content-Type': 'application/json'},
        });
    }

    const url = new URL(request.url);
    const captureId = url.searchParams.get('capture_id');

    if (!captureId) {
        return new Response(JSON.stringify({error: 'Missing capture_id parameter.'}), {
            status: 400,
            headers: {'Content-Type': 'application/json'},
        });
    }

    if (!/^[A-Za-z0-9_-]+$/.test(captureId)) {
        return new Response(JSON.stringify({error: 'Invalid capture_id format.'}), {
            status: 400,
            headers: {'Content-Type': 'application/json'},
        });
    }

    try {
        const response = await fetch(`${baseUrl}/captures/${encodeURIComponent(captureId)}`, {
            method: 'DELETE',
            headers: {
                'X-API-Key': apiKey,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            return new Response(JSON.stringify({
                error: 'Failed to delete capture on SnapSpace API.',
                status: response.status,
                details: errorText,
            }), {
                status: response.status,
                headers: {'Content-Type': 'application/json'},
            });
        }

        const data = await response.json();

        return new Response(JSON.stringify(data), {
            status: 200,
            headers: {'Content-Type': 'application/json'},
        });

    } catch (error) {
        return new Response(JSON.stringify({
            error: 'An internal error occurred.',
            details: error instanceof Error ? error.message : String(error),
        }), {
            status: 500,
            headers: {'Content-Type': 'application/json'},
        });
    }
};

