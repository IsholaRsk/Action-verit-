const { createClient } = require('@supabase/supabase-js');
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SECRET = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const PADDLE_PRICE_ID = process.env.PADDLE_PRICE_ID || "pri_01m1e8e2ybr9rjmaq0kz4ezpnk";
  
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
    
    return res.json({
      priceId: PADDLE_PRICE_ID,
      customerEmail: user.email,
      customData: { user_id: user.id }
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
