import type {APIRoute} from 'astro';
import {getApiUrl} from '../../../lib/endpoint-config';

export const POST: APIRoute = async ({request}) => {
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return new Response(JSON.stringify({error: 'Invalid request body.'}), {
            status: 400,
            headers: {'Content-Type': 'application/json'},
        });
    }

    const upstreamUrl = `${getApiUrl()}/auth/login`;

    let upstreamRes: Response;
    try {
        upstreamRes = await fetch(upstreamUrl, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(body),
        });
    } catch {
        return new Response(JSON.stringify({error: 'Could not reach authentication server.'}), {
            status: 502,
            headers: {'Content-Type': 'application/json'},
        });
    }

    const data = await upstreamRes.text();
    return new Response(data, {
        status: upstreamRes.status,
        headers: {'Content-Type': 'application/json'},
    });
};
