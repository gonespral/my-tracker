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
    const clientId = Deno.env.get('STRAVA_CLIENT_ID')
    const clientSecret = Deno.env.get('STRAVA_CLIENT_SECRET')

    if (!clientId || !clientSecret) {
      throw new Error('Strava credentials not configured on the server.')
    }

    if (action === 'exchange') {
      const resp = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: 'authorization_code',
        }),
      })

      if (!resp.ok) throw new Error(`Token exchange failed (${resp.status})`)
      const data = await resp.json()

      const displayName = [data.athlete?.firstname, data.athlete?.lastname].filter(Boolean).join(' ') || 'Strava User'

      const { error: dbError } = await supabase
        .from('user_integrations')
        .upsert({
          user_id: user.id,
          provider: 'strava',
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_at: Math.floor(data.expires_at * 1000),
          display_name: displayName,
          updated_at: new Date().toISOString()
        })

      if (dbError) throw dbError

      return new Response(JSON.stringify({ success: true, displayName }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })

    } else if (action === 'refresh') {
      // Get current refresh token
      const { data: integration, error: getError } = await supabase
        .from('user_integrations')
        .select('*')
        .eq('user_id', user.id)
        .eq('provider', 'strava')
        .single()

      if (getError || !integration) throw new Error('No Strava integration found')
      
      // If still valid for > 1 minute, just return it
      if (integration.expires_at > Date.now() + 60000) {
        return new Response(JSON.stringify({ 
          accessToken: integration.access_token, 
          expiresAt: integration.expires_at 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const resp = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: integration.refresh_token,
          grant_type: 'refresh_token',
        }),
      })

      if (!resp.ok) throw new Error(`Token refresh failed (${resp.status})`)
      const data = await resp.json()

      const expiresAt = Math.floor(data.expires_at * 1000)

      const { error: dbError } = await supabase
        .from('user_integrations')
        .update({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_at: expiresAt,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .eq('provider', 'strava')

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
