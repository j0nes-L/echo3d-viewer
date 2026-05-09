import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ request }) => {
  const apiKey = import.meta.env.SNAPSPACE_API_KEY;
  const baseUrl = 'https://api.00224466.xyz/snapspace';

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key is not configured.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const response = await fetch(`${baseUrl}/captures`, {
      headers: {
        'X-API-Key': apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(JSON.stringify({
        error: 'Failed to fetch captures from SnapSpace API.',
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
    return new Response(JSON.stringify({ error: 'An internal error occurred.', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

