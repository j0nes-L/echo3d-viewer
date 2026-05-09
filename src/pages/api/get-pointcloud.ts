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
  const filename = url.searchParams.get('filename');

  if (!captureId || !filename) {
    return new Response(JSON.stringify({ error: 'Missing capture_id or filename parameter.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const apiUrl = `${baseUrl}/captures/${captureId}/pointclouds/${filename}`;
    const response = await fetch(apiUrl, {
      headers: {
        'X-API-Key': apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(JSON.stringify({
        error: 'Failed to fetch point cloud from SnapSpace API.',
        status: response.status,
        details: errorText
      }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Stream the response body
    const headers: Record<string, string> = {
      'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Expose-Headers': 'Content-Length, X-Content-Length',
    };
    const cl = response.headers.get('Content-Length');
    if (cl) {
      headers['Content-Length'] = cl;
      headers['X-Content-Length'] = cl;
    }
    return new Response(response.body, { status: 200, headers });

  } catch (error) {
    return new Response(JSON.stringify({ error: 'An internal error occurred.', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
