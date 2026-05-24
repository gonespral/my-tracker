import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { action, code, redirectUri } = await req.json()
    const clientId = Deno.env.get('GOOGLE_HEALTH_CLIENT_ID')
    const clientSecret = Deno.env.get('GOOGLE_HEALTH_CLIENT_SECRET')

    if (!clientId || !clientSecret) {
      throw new Error('Google Health credentials not configured on the server.')
    }

    if (action === 'exchange') {
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      })

      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error_description || err.error || `HTTP ${res.status}`)
      }
      
      const data = await res.json()

      // Fetch user info for display name
      let displayName = 'Google User'
      try {
        const uRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${data.access_token}` },
        })
        if (uRes.ok) {
          const u = await uRes.json()
          displayName = u.name || u.email || displayName
        }
      } catch (e) {
        // ignore
      }

      const { error: dbError } = await supabase
        .from('user_integrations')
        .upsert({
          user_id: user.id,
          provider: 'google-health',
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_at: Date.now() + data.expires_in * 1000,
          display_name: displayName,
          updated_at: new Date().toISOString()
        })

      if (dbError) throw dbError

      return new Response(JSON.stringify({ success: true, displayName }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })

    } else if (action === 'refresh') {
      const { data: integration, error: getError } = await supabase
        .from('user_integrations')
        .select('*')
        .eq('user_id', user.id)
        .eq('provider', 'google-health')
        .single()

      if (getError || !integration) throw new Error('No Google Health integration found')
      
      if (integration.expires_at > Date.now() + 60000) {
        return new Response(JSON.stringify({ 
          accessToken: integration.access_token, 
          expiresAt: integration.expires_at 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: integration.refresh_token,
        client_id: clientId,
        client_secret: clientSecret,
      })

      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      })

      if (!res.ok) throw new Error(`Token refresh failed (${res.status})`)
      const data = await res.json()
      const expiresAt = Date.now() + data.expires_in * 1000

      // Google only issues a new refresh_token sometimes; fallback to existing
      const refreshToken = data.refresh_token || integration.refresh_token

      const { error: dbError } = await supabase
        .from('user_integrations')
        .update({
          access_token: data.access_token,
          refresh_token: refreshToken,
          expires_at: expiresAt,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .eq('provider', 'google-health')

      if (dbError) throw dbError

      return new Response(JSON.stringify({ 
        accessToken: data.access_token, 
        expiresAt 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    } else {
      throw new Error('Invalid action')
    }

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
