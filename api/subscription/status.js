const { createClient } = require('@supabase/supabase-js');
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SECRET = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!SUPABASE_URL || !SUPABASE_SECRET) {
    return res.status(500).json({ error: "Supabase non configuré" });
  }
  
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SECRET, { auth: { autoRefreshToken: false, persistSession: false } });
  
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return res.status(401).json({ error: "Auth requise" });
  const token = auth.slice(7).trim();
  
  try {
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) return res.status(401).json({ error: "Session invalide" });
    const user = userData.user;
    
    const { data, error } = await supabaseAdmin.from("paddle_subscriptions").select("*").eq("user_id", user.id).maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    
    const isActive = data && ['active','trialing'].includes(data.status) && (!data.current_period_end || new Date(data.current_period_end) > new Date());
    return res.json({ subscription: data||null, isActive, isPremium: isActive, priceId: process.env.PADDLE_PRICE_ID || "pri_01m1e8e2ybr9rjmaq0kz4ezpnk" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
