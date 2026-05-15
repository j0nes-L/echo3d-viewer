import type {APIRoute} from 'astro';
import {createClient} from '@supabase/supabase-js';
import {createSupabaseServerClientFromRequest} from '../../../lib/supabase-server';

export const DELETE: APIRoute = async ({request}) => {
    const responseHeaders = new Headers({'Content-Type': 'application/json'});
    const supabase = createSupabaseServerClientFromRequest(request, responseHeaders);

    // Authenticate user properly (contacts auth server)
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) {
        responseHeaders.set('Content-Type', 'application/json');
        return new Response(JSON.stringify({error: 'Unauthorized.'}), {
            status: 401,
            headers: responseHeaders,
        });
    }

    const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;
    if (!serviceRoleKey) {
        return new Response(JSON.stringify({error: 'Account deletion is not configured on this server.'}), {
            status: 501,
            headers: {'Content-Type': 'application/json'},
        });
    }

    const adminClient = createClient(
        import.meta.env.PUBLIC_SUPABASE_URL as string,
        serviceRoleKey,
        {auth: {autoRefreshToken: false, persistSession: false}}
    );

    // Delete from profiles first (in case RLS / cascade is not set)
    await adminClient.from('profiles').delete().eq('id', user.id);

    // Delete auth user
    const {error} = await adminClient.auth.admin.deleteUser(user.id);
    if (error) {
        return new Response(JSON.stringify({error: error.message}), {
            status: 400,
            headers: {'Content-Type': 'application/json'},
        });
    }

    // Sign out (clear cookies)
    await supabase.auth.signOut();

    responseHeaders.set('Content-Type', 'application/json');
    return new Response(JSON.stringify({ok: true}), {
        status: 200,
        headers: responseHeaders,
    });
};

