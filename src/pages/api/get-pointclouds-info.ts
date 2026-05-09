import type { APIRoute } from 'astro';
import { getApiUrl } from '../../lib/endpoint-config';

export const GET: APIRoute = async ({ request }) => {
  const apiKey = import.meta.env.SNAPSPACE_API_KEY;
  const baseUrl = getApiUrl();

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key is not configured.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const captureId = url.searchParams.get('capture_id');

  if (!captureId) {
    return new Response(JSON.stringify({ error: 'Missing capture_id parameter.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const apiUrl = `${baseUrl}/captures/${captureId}/pointclouds`;
    const response = await fetch(apiUrl, {
      headers: {
        'X-API-Key': apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(JSON.stringify({
        error: 'Failed to fetch point clouds info from SnapSpace API.',
        status: response.status,
        details: errorText
      }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: 'An internal error occurred.', details: (error as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
