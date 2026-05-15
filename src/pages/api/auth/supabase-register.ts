import type {APIRoute} from 'astro';
import {createClient} from '@supabase/supabase-js';
import {createSupabaseServerClientFromRequest} from '../../../lib/supabase-server';

export const POST: APIRoute = async ({request}) => {
    const responseHeaders = new Headers({'Content-Type': 'application/json'});
    const supabase = createSupabaseServerClientFromRequest(request, responseHeaders);

    let body: {email?: string; password?: string; display_name?: string};
    try {
        body = await request.json();
    } catch {
        return new Response(JSON.stringify({error: 'Invalid request body.'}), {
            status: 400,
            headers: {'Content-Type': 'application/json'},
        });
    }

    const {email, password, display_name} = body;
    if (!email || !password || !display_name) {
        return new Response(JSON.stringify({error: 'Email, password and display name required.'}), {
            status: 400,
            headers: {'Content-Type': 'application/json'},
        });
    }

    const {data, error} = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {display_name},
            emailRedirectTo: `${new URL(request.url).origin}/api/auth/callback?flow=signup`,
        },
    });

    if (error) {
        // Map Supabase error messages to user-friendly versions
        let msg = error.message;
        if (/user already registered/i.test(msg))
            msg = 'This email address is already registered. Please log in instead.';
        else if (/email.*rate.limit|too many/i.test(msg))
            msg = 'Too many attempts. Please wait a moment and try again.';
        else if (/invalid email/i.test(msg))
            msg = 'Please enter a valid email address.';
        else if (/password.*short|at least/i.test(msg))
            msg = 'Password must be at least 6 characters.';
        return new Response(JSON.stringify({error: msg}), {
            status: 400,
            headers: {'Content-Type': 'application/json'},
        });
    }

    const userId = data.user?.id;
    const needsConfirmation = !data.session;

    const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;
    if (userId && serviceRoleKey) {
        const adminClient = createClient(
            import.meta.env.PUBLIC_SUPABASE_URL as string,
            serviceRoleKey,
            {auth: {autoRefreshToken: false, persistSession: false}}
        );

        // 1. Keep auth metadata in sync (used as fallback in case profiles fails)
        const {error: authMetaErr} = await adminClient.auth.admin.updateUserById(userId, {
            user_metadata: {display_name},
        });
        if (authMetaErr) console.error('[register] auth.admin.updateUserById failed:', authMetaErr.message);

        // 2. Upsert profile row – omit role so an existing role is never overwritten
        //    and no CHECK-constraint on role can abort the statement.
        const {data: upsertData, error: upsertErr} = await adminClient.from('profiles').upsert({
            id: userId,
            display_name,
        }, {onConflict: 'id'}).select();
        if (upsertErr) console.error('[register] profiles upsert failed:', upsertErr.message, upsertErr.code, upsertErr.details);
        else console.log('[register] profiles upsert ok:', upsertData);

        // 3. Explicit UPDATE as additional safety net (covers rows where upsert did nothing)
        const {data: updateData, error: updateErr} = await adminClient
            .from('profiles')
            .update({display_name})
            .eq('id', userId)
            .select();
        if (updateErr) console.error('[register] profiles update failed:', updateErr.message, updateErr.code, updateErr.details);
        else console.log('[register] profiles update ok:', updateData);
    } else {
        if (!userId) console.error('[register] userId is undefined — signUp returned no user');
        if (!serviceRoleKey) console.error('[register] SUPABASE_SERVICE_ROLE_KEY is not set');
    }

    responseHeaders.set('Content-Type', 'application/json');
    return new Response(JSON.stringify({ok: true, needsConfirmation, display_name}), {
        status: 200,
        headers: responseHeaders,
    });
};

