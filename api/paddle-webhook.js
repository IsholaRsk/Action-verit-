global.WebSocket = require('ws');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });
  
  const PADDLE_WEBHOOK_SECRET = process.env.PADDLE_WEBHOOK_SECRET || "";
  const PADDLE_PRICE_ID = process.env.PADDLE_PRICE_ID || "pri_01m1e8e2ybr9rjmaq0kz4ezpnk";
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SECRET = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  let rawBody = "";
  if (typeof req.body === 'string') rawBody = req.body;
  else if (Buffer.isBuffer(req.body)) rawBody = req.body.toString('utf8');
  else rawBody = JSON.stringify(req.body);
  
  const sig = req.headers['paddle-signature'] || req.headers['Paddle-Signature'] || '';
  
  if (PADDLE_WEBHOOK_SECRET && sig) {
    const parts = {};
    sig.split(';').forEach(p => { const [k,v] = p.split('='); if(k&&v) parts[k.trim()]=v.trim(); });
    const ts = parts['ts'], h1 = parts['h1'];
    if (ts && h1) {
      const signed = `${ts}:${rawBody}`;
      const computed = crypto.createHmac('sha256', PADDLE_WEBHOOK_SECRET).update(signed).digest('hex');
      try {
        if (!crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(h1))) {
          console.error("Paddle signature invalide");
          return res.status(401).json({ error: "Signature invalide" });
        }
      } catch {}
    }
  }
  
  let event;
  try { event = typeof req.body === 'object' && !Buffer.isBuffer(req.body) ? req.body : JSON.parse(rawBody); }
  catch { return res.status(400).json({ error: "JSON invalide" }); }
  
  const data = event.data || {};
  const subId = data.id || data.subscription_id || null;
  const custId = data.customer_id || data.customer?.id || null;
  let userId = data.custom_data?.user_id || data.custom_data?.userId || data.customData?.user_id || null;
  const priceId = data.items?.[0]?.price?.id || data.price_id || PADDLE_PRICE_ID;
  const status = data.status || 'inactive';
  const curEnd = data.current_billing_period?.ends_at || data.next_billed_at || null;
  const nextBilled = data.next_billed_at || curEnd;
  
  console.log(`Paddle webhook ${event.event_type} sub=${subId} user=${userId} status=${status}`);
  
  if (SUPABASE_URL && SUPABASE_SECRET && (subId || userId)) {
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SECRET, { auth: { autoRefreshToken: false, persistSession: false } });
    if (!userId && custId) {
      const { data: existing } = await supabaseAdmin.from("paddle_subscriptions").select("user_id").eq("paddle_customer_id", custId).maybeSingle();
      if (existing?.user_id) userId = existing.user_id;
    }
    const upsert = {
      paddle_customer_id: custId,
      paddle_subscription_id: subId,
      price_id: priceId,
      status,
      current_period_end: curEnd,
      next_billed_at: nextBilled,
      updated_at: new Date().toISOString(),
      data: event
    };
    if (userId) upsert.user_id = userId;
    const { error } = await supabaseAdmin.from("paddle_subscriptions").upsert(upsert, { onConflict: userId ? 'user_id' : 'paddle_subscription_id' });
    if (error) {
      console.error("Supabase upsert error", error.message);
      return res.status(500).json({ error: error.message });
    }
  }
  
  res.json({ received: true, event: event.event_type, status });
};
