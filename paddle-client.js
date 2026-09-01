// PADDLE BILLING - Fix production + fallback
const PRICE_ID = "pri_01m1e8e2ybr9rjmaq0kz4ezpnk";
const LIVE_TOKEN = "live_5695fc05de115dd28afbe00eb1f";

export async function initPaddle() {
  if (!window.Paddle) {
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  const token = window.PADDLE_CLIENT_TOKEN || LIVE_TOKEN;
  const env = window.PADDLE_ENV || "production";
  try {
    window.Paddle.Environment.set(env);
    window.Paddle.Initialize({ token });
    console.log(`Paddle initialized env=${env} token=${token.slice(0,12)}...`);
  } catch (e) {
    console.error("Paddle init error", e);
    // Fallback sandbox si production échoue
    try {
      window.Paddle.Environment.set("sandbox");
      window.Paddle.Initialize({ token });
    } catch {}
  }
  return window.Paddle;
}

export async function openPaddleCheckout({ priceId, customerEmail, userId, onSuccess }) {
  const Paddle = await initPaddle();
  const finalPrice = priceId || PRICE_ID;
  
  // Vérifie que Price ID existe côté Paddle avant d'ouvrir
  console.log(`Opening Paddle checkout Price=${finalPrice} user=${userId} email=${customerEmail}`);

  try {
    Paddle.Checkout.open({
      items: [{ priceId: finalPrice, quantity: 1 }],
      customer: customerEmail ? { email: customerEmail } : undefined,
      customData: { user_id: userId },
      settings: { displayMode: 'overlay', theme: 'dark', locale: 'fr', allowLogout: false },
      eventCallback: (ev) => {
        console.log("Paddle event", ev.name, ev);
        if (ev.name === 'checkout.completed') {
          if (onSuccess) onSuccess(ev);
        }
        if (ev.name === 'checkout.error') {
          console.error("Paddle checkout error", ev);
          alert(`Erreur Paddle: ${ev.data?.error || 'Price ID introuvable en production? Vérifie que ${finalPrice} existe en PRODUCTION dans Paddle Dashboard, pas seulement sandbox.'}`);
        }
      }
    });
  } catch (err) {
    console.error("Paddle open error", err);
    // Fallback: ouvre checkout hosted Paddle directement
    const fallbackUrl = `https://buy.paddle.com/checkout?items[0][priceId]=${finalPrice}&customData[user_id]=${userId}&customer[email]=${encodeURIComponent(customerEmail||'')}`;
    console.log("Fallback URL", fallbackUrl);
    window.open(fallbackUrl, "_blank");
    throw err;
  }
}

export async function checkSubscriptionStatus() {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const { CONFIG } = await import("./config.js");
    const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_PUBLISHABLE_KEY);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return { isActive: false };
    const res = await fetch('/api/subscription/status', { headers: { Authorization: `Bearer ${session.access_token}` } });
    if (!res.ok) {
      console.warn("/api/subscription/status failed", res.status);
      // Fallback: check Supabase direct (moins sécurisé mais évite blocage si API down)
      const { data } = await supabase.from("paddle_subscriptions").select("status,current_period_end").eq("user_id", session.user.id).maybeSingle();
      const active = data && ['active','trialing'].includes(data.status) && (!data.current_period_end || new Date(data.current_period_end) > new Date());
      return { isActive: !!active, subscription: data, fallback: true };
    }
    return await res.json();
  } catch (e) {
    console.error(e);
    return { isActive: false };
  }
}
