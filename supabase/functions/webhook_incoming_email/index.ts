import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const payload = await req.json()
    
    // Använd SERVICE_ROLE_KEY för att ha skrivrättigheter oberoende av RLS
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Postmark fields
    const fromEmail = payload.From || payload.ReplyTo || 'okand@avsandare.se';
    const toEmail = payload.To || payload.OriginalRecipient || 'okand@mottagare.se';
    const subject = payload.Subject || 'Ingen ämnesrad';
    const textBody = payload.TextBody;
    const htmlBody = payload.HtmlBody;

    // Skapa en ny mejl-session i chat_sessions
    const { data: session, error: sessionError } = await supabaseClient
      .from('chat_sessions')
      .insert({
        ticket_type: 'email',
        customer_email: fromEmail,
        inbound_address: toEmail,
        email_subject: subject,
        status: 'waiting'
      })
      .select()
      .single()

    if (sessionError) throw sessionError

    // Lägg in mejlets text som det första meddelandet
    const { error: msgError } = await supabaseClient
      .from('chat_messages')
      .insert({
        session_id: session.id,
        sender_type: 'visitor',
        message: textBody || htmlBody || '(Tomt meddelande)'
      })

    if (msgError) throw msgError

    return new Response(JSON.stringify({ success: true, session_id: session.id }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
