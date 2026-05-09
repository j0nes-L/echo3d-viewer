import type {APIRoute} from 'astro';
import {getApiUrl} from '../../lib/endpoint-config';

export const GET: APIRoute = async ({request}) => {
    const apiKey = import.meta.env.SNAPSPACE_API_KEY;
    const baseUrl = getApiUrl();

    if (!apiKey) {
        return new Response(JSON.stringify({error: 'API key is not configured.'}), {
            status: 500,
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

    try {
        // VERIFIED PATH: Capture_{id}/pointclouds/colmap.zip
        const path = `Capture_${captureId}/pointclouds/colmap.zip`;
        const fetchUrl = `${baseUrl}/share/get-download-link?path=${encodeURIComponent(path)}`;
        
        const linkResponse = await fetch(fetchUrl, {
            headers: {
                'X-API-Key': apiKey,
            },
        });

        if (!linkResponse.ok) {
            const errorText = await linkResponse.text();
            return new Response(errorText, {
                status: linkResponse.status,
                headers: {'Content-Type': 'application/json'},
            });
        }

        const data = await linkResponse.json();
        const downloadUrl = data.url;

        if (!downloadUrl) {
            return new Response(JSON.stringify({error: 'No download URL returned from API.'}), {
                status: 500,
                headers: {'Content-Type': 'application/json'},
            });
        }

        return Response.redirect(downloadUrl, 302);

    } catch (error) {
        return new Response(JSON.stringify({
            error: 'An internal error occurred.',
            details: error instanceof Error ? error.message : String(error)
        }), {
            status: 500,
            headers: {'Content-Type': 'application/json'},
        });
    }
};