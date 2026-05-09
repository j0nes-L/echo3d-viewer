import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  const adminPassword = import.meta.env.SNAPSPACE_ADMIN_PASSWORD;
  const viewerPassword = import.meta.env.SNAPSPACE_PASSWORD;

  if (!adminPassword || !viewerPassword) {
    return new Response(JSON.stringify({ error: 'Password is not configured on the server.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let password;
  try {
    const body = await request.json();
    password = body.password;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }


  if (!password) {
    return new Response(JSON.stringify({ authenticated: false, role: null }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (password === adminPassword) {
    return new Response(JSON.stringify({ authenticated: true, role: 'admin' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (password === viewerPassword) {
    return new Response(JSON.stringify({ authenticated: true, role: 'viewer' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ authenticated: false, role: null }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
};

