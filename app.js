import { createClient } from "@supabase/supabase-js"; import { CONFIG } from "./config.js";
const supabase=createClient(CONFIG.SUPABASE_URL,CONFIG.SUPABASE_PUBLISHABLE_KEY);
const state={products:[],paymentMethods:[],depositRequests:[],transactions:[],notifications:[],currentUser:null,pendingMethod:null,subscription:null,isPremium:false};
const $=s=>document.querySelector(s);
const esc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const euro=v=>`${Number(v||0).toFixed(2)} €`;
const getUser=()=>{try{return JSON.parse(localStorage.getItem("escorhub-current-user")||"null")}catch{return null}};
const setUser=u=>{if(u)localStorage.setItem("escorhub-current-user",JSON.stringify(u));else localStorage.removeItem("escorhub-current-user")};
const getPending=()=>{try{return JSON.parse(localStorage.getItem("pending-product")||"null")}catch{return null}};
const setPending=o=>{if(o)localStorage.setItem("pending-product",JSON.stringify(o));else localStorage.removeItem("pending-product")};
const getPM=()=>localStorage.getItem("pending-payment-method")||null;
const setPM=id=>{if(id)localStorage.setItem("pending-payment-method",id);else localStorage.removeItem("pending-payment-method")};
const tgUrl=p=>{if(p?.telegram_link)return p.telegram_link.startsWith('http')?p.telegram_link:`https://t.me/${p.telegram_link.replace('@','')}`; if(p?.telegram_username)return `https://t.me/${p.telegram_username.replace('@','')}`; return CONFIG.DEFAULT_REDIRECT||'https://t.me/Polarish87'};
const PRICE_ID="pri_01m1e8e2ybr9rjmaq0kz4ezpnk";
function toast(m,t="info"){const c=$("#toast-container");if(!c)return;const d=document.createElement("div");d.className=`toast ${t}`;d.innerHTML=`<span>${esc(m)}</span>`;c.appendChild(d);setTimeout(()=>d.remove(),4000)}
async function refreshUser(){const {data:{user}}=await supabase.auth.getUser();if(!user){setUser(null);return null}let p=null;try{const {data}=await supabase.from("profiles").select("id,role,balance,email,username").eq("id",user.id).maybeSingle();p=data}catch(e){console.warn("refreshUser profiles error", e.message)}const cur={id:user.id,email:user.email,role:p?.role||"user",balance:Number(p?.balance||0),username:p?.username||"",is_premium:false};setUser(cur);return cur}
async function checkPremium(){
  try{
    const {data:{session}}=await supabase.auth.getSession(); if(!session?.access_token) return {isActive:false};
    try {
      const res=await fetch('/api/subscription/status',{headers:{Authorization:`Bearer ${session.access_token}`}});
      if(res.ok){
        const data=await res.json();
        state.subscription=data.subscription||null; state.isPremium=!!data.isActive;
        const u=getUser(); if(u){u.is_premium=state.isPremium; setUser(u);}
        return data;
      }
    } catch(apiErr){
      console.warn("API status failed, fallback Supabase direct", apiErr.message);
    }
    // Fallback direct Supabase query
    const { data, error } = await supabase.from("paddle_subscriptions").select("*").eq("user_id", session.user.id).maybeSingle();
    if(error) return {isActive:false};
    const isActive = data && ['active','trialing'].includes(data.status) && (!data.current_period_end || new Date(data.current_period_end) > new Date());
    state.subscription=data||null; state.isPremium=!!isActive;
    const u=getUser(); if(u){u.is_premium=state.isPremium; setUser(u);}
    return { subscription: data||null, isActive, isPremium: isActive };
  }catch(e){console.error(e); return {isActive:false}}
}
async function hydrate(){
  try{
    const {data:products}=await supabase.from("products").select("*").order("created_at",{ascending:false});state.products=products||[];
    const u=await refreshUser();
    if(u){
      const promises = [
        supabase.from("deposit_requests").select("*").order("created_at",{ascending:false}),
        supabase.from("transactions").select("*").order("created_at",{ascending:false}),
        supabase.from("payment_methods").select("*").eq("enabled",true),
        checkPremium()
      ];
      // Admin: fetch profiles + paddle_subscriptions
      if(u.role==="admin"){
        promises.push(supabase.from("profiles").select("id,email,role,balance,total_credited,total_spent,is_premium,created_at").order("created_at",{ascending:false}).limit(100));
        promises.push(supabase.from("paddle_subscriptions").select("*").order("created_at",{ascending:false}).limit(100));
      }
      const results = await Promise.all(promises);
      const [dep,tx,pm,sub,profilesData,subsData] = results;
      state.depositRequests=dep.data||[];state.transactions=tx.data||[];state.paymentMethods=pm.data||[];
      if(profilesData) state.profiles=profilesData.data||[];
      if(subsData) state.paddleSubs=subsData.data||[];
    }
  }catch(e){console.error(e)}
}

function subscriptionRequiredScreen(autoOpen=false){
  return `<section class="page-shell centered" style="text-align:center;padding:40px 20px;max-width:650px;margin:0 auto">
    <div style="background:var(--panel);border:2px solid var(--accent);border-radius:20px;padding:32px;box-shadow:0 10px 40px rgba(0,0,0,0.3)">
      <div style="font-size:3rem;margin-bottom:12px">💳</div>
      <h1 style="margin:0 0 8px">Paiement Premium Requis</h1>
      <p style="color:var(--accent);font-weight:800;font-size:1.2rem;margin:0 0 16px">5,99€ / mois - Accès immédiat</p>
      <p style="color:var(--muted);font-size:1rem;margin:0 0 20px">Activez votre abonnement pour accéder au catalogue complet et contacter les profils.<br>Paiement 100% sécurisé via Paddle (Carte bancaire, PayPal, Apple Pay).</p>
      <div style="background:var(--panel-soft);border-radius:12px;padding:16px;margin-bottom:20px;text-align:left;border:1px solid var(--line)">
        <p style="margin:0 0 8px"><i class="fa-solid fa-check" style="color:var(--success)"></i> Accès complet catalogue premium</p>
        <p style="margin:0 0 8px"><i class="fa-solid fa-check" style="color:var(--success)"></i> Paiement sécurisé + facture automatique</p>
        <p style="margin:0 0 8px"><i class="fa-solid fa-check" style="color:var(--success)"></i> Commandes + Telegram direct</p>
        <p style="margin:0"><i class="fa-solid fa-check" style="color:var(--success)"></i> Support premium 24/7</p>
      </div>
      <div style="display:grid;gap:12px">
        <button class="btn-primary full" id="subscribe-now-btn" style="padding:18px;font-size:1.2rem;font-weight:800"><i class="fa-solid fa-credit-card"></i> PAYER 5,99€ MAINTENANT</button>
        <a href="https://buy.paddle.com/checkout?items[0][priceId]=${PRICE_ID}" target="_blank" class="btn-secondary full" style="padding:12px"><i class="fa-solid fa-link"></i> Lien de paiement direct</a>
      </div>
      <p style="font-size:0.8rem;color:var(--muted);margin-top:14px">Paiement sécurisé via Paddle Billing - ${PRICE_ID}<br>Accès premium activé automatiquement après paiement</p>
      <div id="sub-status" style="margin-top:16px"></div>
      ${autoOpen?`<div id="auto-pay-notice" style="background:rgba(0,255,0,0.08);border:1px solid rgba(0,255,0,0.2);padding:10px;border-radius:8px;margin-top:12px;font-size:0.9rem"><i class="fa-solid fa-spinner fa-spin"></i> Ouverture automatique du paiement...</div>`:''}
    </div>
  </section>`;
}
function subscribePage(){
  const u=getUser();
  if(!u) return `<section class="page-shell centered"><h1>Connexion requise</h1><p>Créez un compte pour vous abonner</p><a href="#/signup" class="btn-primary">S'inscrire → Paiement 5,99€</a></section>`;
  if(u.role==="admin"){
    return `<section class="page-shell centered" style="text-align:center;padding:60px 20px"><div style="background:var(--panel);border:2px solid var(--success);border-radius:20px;padding:32px"><h1 style="color:var(--success)">👑 Admin - Accès gratuit</h1><p>Pas de paiement requis pour admin - Accès complet catalogue</p><a href="#/" class="btn-primary">Catalogue</a> <a href="#/admin" class="btn-secondary">Dashboard</a></div></section>`;
  }
  if(state.isPremium) return `<section class="page-shell centered" style="text-align:center;padding:60px 20px"><div style="background:var(--panel);border:2px solid var(--success);border-radius:20px;padding:32px"><h1 style="color:var(--success)"><i class="fa-solid fa-crown"></i> Déjà Abonné !</h1><p>Votre abonnement premium est actif</p><a href="#/" class="btn-primary">Catalogue</a></div></section>`;
  return subscriptionRequiredScreen(true);
}

function productsPage(){return `<section class="section"><h2>Catalogue Europe - 50 Profils ${state.isPremium?'<span style="background:var(--success);color:#fff;padding:4px 10px;border-radius:20px;font-size:0.7rem">Abonné</span>':''}</h2><div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0"><span style="background:var(--panel);padding:4px 10px;border-radius:20px;font-size:0.8rem">🇫🇷 France</span><span style="background:var(--panel);padding:4px 10px;border-radius:20px;font-size:0.8rem">🇩🇪 Allemagne</span><span style="background:var(--panel);padding:4px 10px;border-radius:20px;font-size:0.8rem">🇪🇸 Espagne</span><span style="background:var(--panel);padding:4px 10px;border-radius:20px;font-size:0.8rem">🇮🇹 Italie</span><span style="background:var(--panel);padding:4px 10px;border-radius:20px;font-size:0.8rem">🇬🇧 UK</span><span style="background:var(--panel);padding:4px 10px;border-radius:20px;font-size:0.8rem">🇨🇭 Suisse</span><span style="background:var(--panel);padding:4px 10px;border-radius:20px;font-size:0.8rem">🇪🇺 Toute Europe</span></div><div class="product-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;margin-top:16px">${state.products.map(card).join("")||"<p>Aucun produit</p>"}</div></section>`}
function card(p){
  const age = p.age ? `${p.age} ans` : '';
  const lieu = p.lieu || 'Europe';
  const ville = lieu.split(',')[0]?.trim() || lieu;
  const pays = lieu.split(',')[1]?.trim() || 'Europe';
  const tg = p.telegram_username || p.telegram_link || '@Polarish87';
  return `<div style="border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--panel);transition:transform 0.2s" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
    <div style="position:relative">
      <div style="background-image:url('${esc(p.image||'')}');height:200px;background-size:cover;background-position:center"></div>
      <div style="position:absolute;top:8px;left:8px;background:rgba(0,0,0,0.7);color:#fff;padding:4px 8px;border-radius:20px;font-size:0.75rem"><i class="fa-solid fa-location-dot"></i> ${esc(ville)}</div>
      <div style="position:absolute;top:8px;right:8px;background:var(--success);color:#fff;padding:4px 8px;border-radius:20px;font-size:0.75rem;font-weight:700">${euro(p.prix)}</div>
      <div style="position:absolute;bottom:8px;left:8px;background:rgba(0,0,0,0.7);color:#fff;padding:3px 8px;border-radius:20px;font-size:0.7rem">${esc(pays)}</div>
    </div>
    <div style="padding:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <h3 style="margin:0;font-size:1.1rem">${esc(p.nom)}</h3>
        <span style="background:var(--panel-soft);padding:2px 8px;border-radius:10px;font-size:0.8rem"><i class="fa-solid fa-cake-candles"></i> ${esc(age)}</span>
      </div>
      <div style="font-size:0.85rem;color:var(--muted);margin-bottom:8px;display:flex;gap:8px;flex-wrap:wrap">
        <span><i class="fa-solid fa-map-pin"></i> ${esc(lieu)}</span>
        <span><i class="fa-solid fa-user"></i> ${esc(age)}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        <button class="btn-primary small" data-action="commander" data-id="${esc(p.id)}" style="padding:8px"><i class="fa-solid fa-bolt"></i> COMMANDER</button>
        <button class="btn-secondary small" data-action="view-product" data-id="${esc(p.id)}" style="padding:8px"><i class="fa-solid fa-eye"></i> Voir profil</button>
      </div>
    </div>
  </div>`;
}
function productPage(id){
  const p=state.products.find(x=>String(x.id)===String(id)); if(!p) return `<h1>Profil introuvable</h1>`;
  const lieu = p.lieu || 'Europe';
  const ville = lieu.split(',')[0]?.trim() || lieu;
  const pays = lieu.split(',')[1]?.trim() || 'Europe';
  const tg = p.telegram_username || p.telegram_link || '@Polarish87';
  const tgLink = tgUrl(p);
  return `<section class="page-shell" style="max-width:800px;margin:0 auto">
    <a href="#/products" class="btn-secondary"><i class="fa-solid fa-arrow-left"></i> Retour catalogue</a>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:16px;background:var(--panel);border-radius:16px;overflow:hidden;border:1px solid var(--line)">
      <div style="position:relative">
        <img src="${esc(p.image||'')}" style="width:100%;height:500px;object-fit:cover"/>
        <div style="position:absolute;top:12px;left:12px;background:rgba(0,0,0,0.8);color:#fff;padding:6px 12px;border-radius:20px"><i class="fa-solid fa-location-dot"></i> ${esc(ville)} - ${esc(pays)}</div>
        <div style="position:absolute;top:12px;right:12px;background:var(--accent);color:#fff;padding:6px 12px;border-radius:20px;font-weight:800">${euro(p.prix)}</div>
      </div>
      <div style="padding:20px">
        <h1 style="margin:0 0 8px">${esc(p.nom)} <span style="font-size:0.6em;background:var(--panel-soft);padding:4px 10px;border-radius:20px">${p.age||''} ans</span></h1>
        <div style="display:grid;gap:10px;margin:16px 0">
          <div style="display:flex;align-items:center;gap:8px"><i class="fa-solid fa-map-pin" style="color:var(--accent);width:20px"></i><span><strong>Ville:</strong> ${esc(ville)}</span></div>
          <div style="display:flex;align-items:center;gap:8px"><i class="fa-solid fa-flag" style="color:var(--accent);width:20px"></i><span><strong>Pays:</strong> ${esc(pays)}</span></div>
          <div style="display:flex;align-items:center;gap:8px"><i class="fa-solid fa-cake-candles" style="color:var(--accent);width:20px"></i><span><strong>Âge:</strong> ${p.age||'?'} ans</span></div>
          <div style="display:flex;align-items:center;gap:8px"><i class="fa-solid fa-euro-sign" style="color:var(--accent);width:20px"></i><span><strong>Prix:</strong> ${euro(p.prix)}</span></div>
          <div style="display:flex;align-items:center;gap:8px"><i class="fa-solid fa-location-dot" style="color:var(--accent);width:20px"></i><span><strong>Lieu complet:</strong> ${esc(lieu)}</span></div>
        </div>
        <div style="background:var(--panel-soft);border-radius:12px;padding:14px;margin:16px 0;border:1px solid var(--line)">
          <div style="font-weight:700;margin-bottom:6px"><i class="fa-brands fa-telegram" style="color:#229ED9"></i> Contact Telegram</div>
          <div style="font-size:0.9rem;color:var(--muted)">Lien Telegram: <code>${esc(tg)}</code><br><small>Le lien direct sera affiché après confirmation de paiement</small></div>
          <a href="${esc(tgLink)}" target="_blank" style="display:inline-block;margin-top:8px;background:#229ED9;color:#fff;padding:6px 12px;border-radius:20px;font-size:0.8rem;text-decoration:none"><i class="fa-brands fa-telegram"></i> Voir Telegram (après paiement)</a>
        </div>
        <button class="btn-primary full" data-action="commander" data-id="${esc(p.id)}" style="padding:16px;font-size:1.1rem;font-weight:800"><i class="fa-solid fa-bolt"></i> COMMANDER ${esc(p.nom)} → ${euro(p.prix)} → Telegram après confirmation</button>
        <p style="font-size:0.8rem;color:var(--muted);margin-top:10px;text-align:center">Après paiement, vous serez redirigé vers Telegram + lien affiché dans Mes commandes</p>
      </div>
    </div>
  </section>`;
}
function paymentPage(pid){
  const p=state.products.find(x=>String(x.id)===String(pid)); if(!p) return `<h1>Produit introuvable</h1>`; const u=getUser(); if(!u){setPending({productId:p.id,price:Number(p.prix),name:p.nom}); return `<section class="page-shell centered"><h1>Connexion requise</h1><p>Connectez-vous pour commander ${esc(p.nom)}</p><a href="#/login" class="btn-primary">Connexion</a></section>`}
  // ADMIN = accès gratuit direct, pas de paiement du tout
  if(u.role==="admin"){
    const lieu = p.lieu || 'Europe';
    const tgLink = tgUrl(p);
    return `<section class="page-shell" style="max-width:600px;margin:0 auto">
      <div style="background:var(--panel);border:2px solid var(--success);border-radius:16px;padding:24px">
        <div style="text-align:center;margin-bottom:16px"><div style="font-size:2rem">👑</div><h1 style="color:var(--success)">Admin - Accès gratuit</h1><p>Pas de paiement requis pour admin</p></div>
        <div style="background:var(--panel-soft);padding:14px;border-radius:10px;margin-bottom:14px">
          <div><strong>Profil:</strong> ${esc(p.nom)} - ${p.age||'?'} ans - ${esc(lieu)} - ${euro(p.prix)}</div>
        </div>
        <a href="${esc(tgLink)}" target="_blank" class="btn-primary full" style="background:#229ED9;padding:14px"><i class="fa-brands fa-telegram"></i> CONTACTER ${esc(p.nom).toUpperCase()} DIRECT - ADMIN GRATUIT</a>
        <div style="margin-top:12px;display:grid;gap:8px">
          <a href="#/admin" class="btn-secondary full">Retour Dashboard</a>
          <a href="#/" class="btn-secondary full">Catalogue</a>
        </div>
      </div>
    </section>`;
  }
  if(!state.isPremium){ return subscriptionRequiredScreen(); }
  const bal=Number(u.balance||0), price=Number(p.prix||0), miss=Math.max(0,price-bal), can=bal>=price;
  return `<section class="page-shell"><h1>Paiement ${esc(p.nom)} ${state.isPremium?'<span style="background:var(--success);color:#fff;padding:4px 10px;border-radius:20px;font-size:0.7rem"><i class="fa-solid fa-crown"></i> Abonné</span>':''}</h1><p>Produit: ${esc(p.nom)} Prix: ${euro(price)} Solde: ${euro(bal)}</p>
  ${can?`<button class="btn-primary full" data-action="pay-product" data-id="${esc(p.id)}" data-price="${price}">PAYER ${price.toFixed(0)}€ → Telegram</button>`:`<div style="background:rgba(255,0,0,0.1);padding:10px;border-radius:8px">Solde insuffisant - Manque ${euro(miss)}</div><button class="btn-primary full" data-action="recharge-for-product" data-id="${esc(p.id)}" data-missing="${miss}" data-price="${price}">RECHARGER</button>`}
  <p><small>Après paiement → Telegram ${tgUrl(p)}</small></p></section>`;
}
function ordersPage(){
  const u=getUser(); if(!u){location.hash="#/login";return""} if(!state.isPremium && u.role!=="admin") return subscriptionRequiredScreen(); // admin bypass
  const orders=(state.transactions||[]).filter(t=>String(t.user_id)===String(u.id)&&t.type==='purchase'); 
  return `<section class="page-shell"><h1>Mes commandes (${orders.length}) - Liens après confirmation</h1>
    <p style="color:var(--muted)">Chaque commande confirmée affiche le lien Telegram direct du profil</p>
    ${orders.map(o=>{
      const prod=state.products.find(p=>String(p.id)===String(o.product_id)); 
      const lieu = prod?.lieu || 'Europe';
      const ville = lieu.split(',')[0]||lieu;
      const pays = lieu.split(',')[1]||'Europe';
      const tgLink = tgUrl(prod);
      return `<div style="border:1px solid var(--line);padding:14px;margin-bottom:12px;border-radius:12px;background:var(--panel)">
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px">
          <div>
            <strong>#${esc(o.id.slice(0,8))} ${esc(prod?.nom||'')} - ${p.age||'?'} ans - ${esc(ville)}, ${esc(pays)} - ${euro(Math.abs(Number(o.amount)))} Payée</strong><br>
            <small style="color:var(--muted)"><i class="fa-solid fa-location-dot"></i> ${esc(lieu)} | <i class="fa-solid fa-cake"></i> ${prod?.age||'?'} ans</small>
          </div>
          <span style="background:var(--success);color:#fff;padding:4px 10px;border-radius:20px;font-size:0.75rem;height:fit-content">✅ Confirmée</span>
        </div>
        <div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <button class="btn-primary small" data-action="view-order" data-id="${esc(o.id)}"><i class="fa-solid fa-eye"></i> VOIR + LIEN TELEGRAM</button>
          <a href="${esc(tgLink)}" target="_blank" class="btn-secondary small" style="text-align:center;text-decoration:none"><i class="fa-brands fa-telegram"></i> ${esc(prod?.telegram_username||'@Polarish87')}</a>
        </div>
      </div>`;
    }).join("")||"<p>Aucune commande - Commandez un profil pour voir le lien Telegram après confirmation</p>"}
  </section>`;
}
function orderDetail(oid){
  const u=getUser(); if(!state.isPremium && u?.role!=="admin") return subscriptionRequiredScreen(); 
  const o=(state.transactions||[]).find(t=>String(t.id)===String(oid)); if(!o) return `<h1>Commande introuvable</h1>`; 
  const prod=state.products.find(p=>String(p.id)===String(o.product_id)); 
  const url=tgUrl(prod);
  const lieu = prod?.lieu || 'Europe';
  const ville = lieu.split(',')[0]||lieu;
  const pays = lieu.split(',')[1]||'Europe';
  return `<section class="page-shell" style="max-width:600px;margin:0 auto">
    <a href="#/orders" class="btn-secondary"><i class="fa-solid fa-arrow-left"></i> Retour</a>
    <div style="background:var(--panel);border:2px solid var(--success);border-radius:16px;padding:24px;margin-top:16px">
      <div style="text-align:center;margin-bottom:16px">
        <div style="font-size:3rem">✅</div>
        <h1 style="margin:8px 0;color:var(--success)">Commande #${esc(o.id.slice(0,8))} Payée - Confirmée</h1>
        <p style="color:var(--muted)">Lien Telegram disponible après confirmation</p>
      </div>
      <div style="display:grid;gap:10px;background:var(--panel-soft);padding:16px;border-radius:12px;margin-bottom:16px">
        <div><strong>Profil:</strong> ${esc(prod?.nom||'')} - ${prod?.age||'?'} ans</div>
        <div><strong>Ville:</strong> ${esc(ville)}</div>
        <div><strong>Pays:</strong> ${esc(pays)}</div>
        <div><strong>Lieu complet:</strong> ${esc(lieu)}</div>
        <div><strong>Prix payé:</strong> ${euro(Math.abs(Number(o.amount)))}</div>
        <div><strong>Date:</strong> ${new Date(o.created_at).toLocaleString('fr-FR')}</div>
      </div>
      <div style="background:rgba(34,158,217,0.1);border:1px solid rgba(34,158,217,0.3);border-radius:12px;padding:16px;text-align:center">
        <div style="font-weight:800;margin-bottom:8px"><i class="fa-brands fa-telegram" style="color:#229ED9;font-size:1.2rem"></i> Lien Telegram après confirmation</div>
        <div style="font-size:0.9rem;margin-bottom:12px">Profil: ${esc(prod?.nom||'')} - ${esc(ville)}, ${esc(pays)}</div>
        <a href="${esc(url)}" target="_blank" class="btn-primary full" style="background:#229ED9;padding:14px;font-size:1.1rem"><i class="fa-brands fa-telegram"></i> CONTACTER ${esc(prod?.nom||'').toUpperCase()} SUR TELEGRAM - ${esc(prod?.telegram_username||'@Polarish87')}</a>
        <div style="margin-top:10px;font-size:0.8rem;color:var(--muted)">Lien: ${esc(url)}<br>Copiez ce lien, il reste disponible dans Mes commandes</div>
      </div>
    </div>
  </section>`;
}
function home(){const u=getUser(); const isSub=state.isPremium; return `<section class="section"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px"><h2>Produits Premium ${isSub?'<span style="background:var(--success);color:#fff;padding:4px 10px;border-radius:20px;font-size:0.7rem">Abonné</span>':''}</h2>${u&&!isSub&&u.role!=="admin"?`<a href="#/subscribe" class="btn-primary"><i class="fa-solid fa-crown"></i> S'abonner 5,99€ → Paiement direct</a>`:''}</div><div class="product-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-top:16px">${state.products.map(card).join("")}</div></section>`}
function loginPage(){const pend=getPending(); return `<section class="auth-page"><div class="auth-card"><h1>CONNEXION</h1>${pend?`<p>Produit: ${esc(pend.name)}</p>`:''}<form id="login-form"><label>Email<input type="email" name="email" required></label><label>Mot de passe<input type="password" name="password" required></label><button class="btn-primary full">Connexion</button><p style="margin-top:12px;font-size:0.85rem;text-align:center">Pas de compte ? <a href="#/signup">S'inscrire → Paiement 5,99€</a></p></form></div></section>`}
function signupPage(){return `<section class="auth-page"><div class="auth-card" style="max-width:480px"><h1>Inscription - Étape 1/2</h1><div style="background:rgba(255,138,0,0.12);border:1px solid rgba(255,138,0,0.3);padding:12px;border-radius:10px;margin-bottom:14px"><div style="font-weight:800;margin-bottom:6px"><i class="fa-solid fa-credit-card" style="color:var(--accent)"></i> Paiement direct après inscription</div><div style="font-size:0.9rem;color:var(--muted)">Après création de compte, vous serez redirigé automatiquement vers la page de paiement sécurisé <strong style="color:var(--accent)">5,99€/mois</strong> pour activer votre accès premium immédiatement.</div></div><form id="signup-form"><label>Nom complet<input name="fullName" required placeholder="Votre nom"></label><label>Email<input type="email" name="email" required placeholder="email@exemple.com"></label><label>Mot de passe<input type="password" name="password" required placeholder="Min 6 caractères"></label><button class="btn-primary full" style="padding:14px;font-size:1.1rem;font-weight:800"><i class="fa-solid fa-arrow-right"></i> Créer mon compte → Payer 5,99€</button></form><p style="font-size:0.8rem;color:var(--muted);margin-top:12px;text-align:center"><i class="fa-solid fa-lock"></i> Paiement sécurisé Paddle - Carte, PayPal, Apple Pay<br>Accès immédiat après paiement - Résiliable à tout moment</p></div></section>`}
function walletPage(){
  const u=getUser(); if(!u){location.hash="#/login";return""} 
  if(u.role==="admin"){
    return `<section class="page-shell centered" style="text-align:center;padding:40px 20px"><div style="background:var(--panel);border:2px solid var(--success);border-radius:16px;padding:24px"><h1>👑 Admin - Pas de paiement</h1><p>Admin n'a pas besoin de recharger - accès gratuit</p><a href="#/" class="btn-primary">Catalogue</a></div></section>`;
  }
  if(!state.isPremium) return subscriptionRequiredScreen(); // admin bypass
  const bal=u.balance||0, methods=state.paymentMethods||[], pend=getPending(); let miss=0, pendProd=null; if(pend){pendProd=state.products.find(p=>String(p.id)===String(pend.productId)); if(pendProd) miss=Math.max(0,Number(pendProd.prix)-bal)} const selId=getPM(), sel=selId?methods.find(m=>String(m.id)===String(selId)):null;
  return `<section class="page-shell"><h1>Recharger Solde ${euro(bal)}</h1><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div><h3>Moyens</h3>${methods.map(m=>`<button class="btn-secondary" data-select-method="${esc(m.id)}" style="width:100%;text-align:left;margin-bottom:6px">${esc(m.name)}</button>`).join("")}</div><div>${!sel?`<p>Choisissez moyen</p>`:`<h3>${esc(sel.name)}</h3><button class="btn-primary full" data-action="continue-to-payment">CONTINUER</button><div id="after-continue" style="display:none;margin-top:10px"><form id="wallet-recharge-form" style="display:grid;gap:6px"><label>Montant<input type="number" id="wallet-amount" value="${miss.toFixed(0)}" required></label><label>Réf<input type="text" id="wallet-ref"></label><label>Preuve<input type="file" id="wallet-proof" accept="image/*" required></label><button class="btn-primary">ENVOYER</button></form></div>`}</div></div></section>`;
}
function adminPage(){
  const u=getUser(); if(!u||u.role!=="admin") return `<section class="page-shell centered"><h1>🔒 Admin uniquement</h1><p>Vous devez être admin pour accéder au dashboard</p></section>`;
  const pending = (state.depositRequests||[]).filter(d=>d.status==='pending');
  const approved = (state.depositRequests||[]).filter(d=>d.status==='approved');
  const totalUsers = state.profiles?.length || '?';
  const totalProducts = state.products?.length || 0;
  const totalOrders = (state.transactions||[]).filter(t=>t.type==='purchase').length;
  const totalRecharges = (state.transactions||[]).filter(t=>t.type==='deposit').reduce((s,t)=>s+Number(t.amount||0),0);
  const pendingCount = pending.length;
  
  return `<section class="page-shell" style="max-width:1200px;margin:0 auto">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:20px">
      <h1>👑 Dashboard Admin - EscortHub</h1>
      <div style="display:flex;gap:8px">
        <span style="background:var(--success);color:#fff;padding:6px 12px;border-radius:20px;font-size:0.85rem">Admin: ${esc(u.email)}</span>
        <span style="background:var(--panel);padding:6px 12px;border-radius:20px;font-size:0.85rem">50 Profils Europe</span>
      </div>
    </div>
    
    <!-- STATS -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:24px">
      <div style="background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px;text-align:center">
        <div style="font-size:1.8rem;font-weight:800;color:var(--accent)">${totalUsers}</div><div style="font-size:0.85rem;color:var(--muted)">Utilisateurs</div>
      </div>
      <div style="background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px;text-align:center">
        <div style="font-size:1.8rem;font-weight:800;color:var(--success)">${totalProducts}</div><div style="font-size:0.85rem;color:var(--muted)">Produits / Profils</div>
      </div>
      <div style="background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px;text-align:center">
        <div style="font-size:1.8rem;font-weight:800;color:var(--warning)">${pendingCount}</div><div style="font-size:0.85rem;color:var(--muted)">Recharges en attente</div>
      </div>
      <div style="background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px;text-align:center">
        <div style="font-size:1.8rem;font-weight:800">${totalOrders}</div><div style="font-size:0.85rem;color:var(--muted)">Commandes payées</div>
      </div>
      <div style="background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px;text-align:center">
        <div style="font-size:1.8rem;font-weight:800;color:var(--success)">${euro(totalRecharges)}</div><div style="font-size:0.85rem;color:var(--muted)">Total rechargé</div>
      </div>
      <div style="background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px;text-align:center">
        <div style="font-size:1.8rem;font-weight:800">${(state.profiles||[]).filter(p=>p.is_premium).length||0}</div><div style="font-size:0.85rem;color:var(--muted)">Abonnés Premium</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <!-- LEFT: Produits + Form -->
      <div>
        <h2>📦 Gestion Produits / Profils Europe</h2>
        <form id="admin-product-form" style="background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px;display:grid;gap:10px;margin-bottom:16px">
          <input type="hidden" id="product-id">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <label>Nom<input id="prod-nom" required placeholder="Ex: Sophie" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--line)"></label>
            <label>Âge<input type="number" id="prod-age" value="23" min="18" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--line)"></label>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <label>Prix €<input type="number" id="prod-prix" required placeholder="150" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--line)"></label>
            <label>Lieu (Ville, Pays)<input id="prod-lieu" placeholder="Paris, France" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--line)"></label>
          </div>
          <label>Image URL<input id="prod-image" placeholder="https://images.unsplash.com/..." style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--line)"></label>
          <label>Telegram<input id="prod-telegram" placeholder="@Polarish87 ou https://t.me/..." style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--line)"></label>
          <button class="btn-primary" style="padding:12px"><i class="fa-solid fa-floppy-disk"></i> Enregistrer Profil</button>
        </form>
        <div style="max-height:600px;overflow-y:auto;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:10px">
          <h3 style="margin:0 0 10px">Catalogue (${state.products.length}) - Pays/Ville/Âge</h3>
          ${state.products.map(p=>{
            const lieu = p.lieu||'Europe';
            const ville = lieu.split(',')[0]||lieu;
            const pays = lieu.split(',')[1]||'';
            return `<div style="border:1px solid var(--line);padding:8px;margin-bottom:6px;border-radius:8px;display:flex;justify-content:space-between;align-items:center">
              <div style="display:flex;gap:8px;align-items:center">
                <img src="${esc(p.image||'')}" style="width:40px;height:40px;border-radius:8px;object-fit:cover"/>
                <div>
                  <div style="font-weight:700">${esc(p.nom)} - ${p.age||'?'} ans - ${esc(ville)} ${pays?`(${esc(pays.trim())})`:''} - ${euro(p.prix)}</div>
                  <div style="font-size:0.75rem;color:var(--muted)">${esc(lieu)} | TG: ${esc(p.telegram_username||p.telegram_link||'non')}</div>
                </div>
              </div>
              <div style="display:flex;gap:4px">
                <button class="btn-secondary small" data-action="edit-product" data-id="${esc(p.id)}" style="padding:4px 8px">Edit</button>
                <button class="btn-secondary small" data-action="delete-product" data-id="${esc(p.id)}" style="padding:4px 8px;background:rgba(255,0,0,0.1)">Suppr</button>
              </div>
            </div>`;
          }).join("")}
        </div>
      </div>

      <!-- RIGHT: Demandes recharge + Users -->
      <div>
        <h2>💳 Recharges en attente (${pending.length}) - Validation</h2>
        <div style="background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:10px;max-height:400px;overflow-y:auto;margin-bottom:20px">
          ${pending.length?pending.map(d=>{
            const user = (state.profiles||[]).find(p=>p.id===d.user_id);
            return `<div style="border:1px solid var(--warning);padding:10px;margin-bottom:8px;border-radius:8px;background:rgba(255,138,0,0.05)">
              <div style="font-weight:700">${esc(user?.email||d.user_id.slice(0,8))} - ${euro(d.amount)} - ${esc(d.payment_method)} - Réf: ${esc(d.transaction_reference)}</div>
              <div style="font-size:0.8rem;color:var(--muted)">Le ${new Date(d.created_at).toLocaleString('fr-FR')} | Preuve: ${esc(d.proof_path||'')}</div>
              <div style="display:flex;gap:6px;margin-top:8px">
                <button class="btn-primary small" data-action="approve-deposit" data-id="${esc(d.id)}" style="background:var(--success)"><i class="fa-solid fa-check"></i> Approuver +${d.amount}€</button>
                <button class="btn-secondary small" data-action="reject-deposit" data-id="${esc(d.id)}" style="background:rgba(255,0,0,0.1)"><i class="fa-solid fa-xmark"></i> Refuser</button>
                <button class="btn-secondary small" data-action="view-proof" data-path="${esc(d.proof_path||'')}">Voir preuve</button>
              </div>
              <div class="proof-preview" style="margin-top:8px"></div>
            </div>`;
          }).join(""):`<p style="color:var(--muted)">Aucune demande en attente ✅</p>`}
        </div>

        <h2>👥 Utilisateurs (${totalUsers}) + Abonnements</h2>
        <div style="background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:10px;max-height:300px;overflow-y:auto;margin-bottom:20px">
          ${(state.profiles||[]).slice(0,30).map(p=>`<div style="border-bottom:1px solid var(--line);padding:6px 0;display:flex;justify-content:space-between">
            <span>${esc(p.email||p.id.slice(0,8))} - ${esc(p.role)} ${p.is_premium?'<span style="background:var(--success);color:#fff;padding:2px 6px;border-radius:10px;font-size:0.6rem">Premium</span>':''}</span>
            <span>${euro(p.balance||0)} | ${p.total_credited||0}€ crédité</span>
          </div>`).join("")||"<p>Chargement users... (nécessite RLS admin)</p>"}
        </div>

        <h2>📊 Transactions récentes</h2>
        <div style="background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:10px;max-height:300px;overflow-y:auto">
          ${(state.transactions||[]).slice(0,20).map(t=>{
            const prod = state.products.find(p=>String(p.id)===String(t.product_id));
            return `<div style="border-bottom:1px solid var(--line);padding:6px 0;font-size:0.85rem">
              <strong>${esc(t.type)}</strong> ${euro(t.amount)} - User ${esc(t.user_id.slice(0,8))} ${prod?`- ${esc(prod.nom)} (${esc(prod.lieu||'')})`:''} - ${new Date(t.created_at).toLocaleString('fr-FR')}
            </div>`;
          }).join("")||"<p>Aucune transaction</p>"}
        </div>
      </div>
    </div>
  </section>`;
}

async function openCheckout(){
  const u=getUser(); if(!u){location.hash="#/login"; return}
  const statusEl=$("#sub-status")||document.getElementById("sub-status");
  const showError=(msg, detail="")=>{
    if(!statusEl) return;
    statusEl.innerHTML=`<div style="background:rgba(255,0,0,0.12);border:1px solid rgba(255,0,0,0.3);padding:14px;border-radius:10px;text-align:left">
      <div style="font-weight:800;color:var(--danger);margin-bottom:8px"><i class="fa-solid fa-triangle-exclamation"></i> Erreur paiement</div>
      <div style="font-size:0.95rem;margin-bottom:8px">${esc(msg)}</div>
      ${detail?`<div style="background:rgba(0,0,0,0.2);padding:8px;border-radius:6px;font-size:0.8rem;white-space:pre-wrap;word-break:break-all">${esc(detail.slice(0,600))}</div>`:''}
      <div style="margin-top:12px;display:grid;gap:8px">
        <a href="https://buy.paddle.com/checkout?items[0][priceId]=${PRICE_ID}" target="_blank" class="btn-primary small"><i class="fa-solid fa-credit-card"></i> Paiement direct Paddle (fallback)</a>
        <div style="font-size:0.8rem;color:var(--muted)">Causes fréquentes :<br>
        1) Price ID <code>${PRICE_ID}</code> n'existe qu'en SANDBOX, pas en PRODUCTION → recrée produit en PROD dans Paddle Dashboard<br>
        2) Token live_... invalide → vérifie Paddle Dashboard → Developer Tools → Authentication → Client-side token<br>
        3) AdBlock bloque Paddle.js → désactive AdBlock<br>
        Token actuel : ${(window.PADDLE_CLIENT_TOKEN||'').slice(0,20)}... Env : ${window.PADDLE_ENV}</div>
      </div>
    </div>`;
  };
  if(statusEl) statusEl.innerHTML=`<div style="background:rgba(255,138,0,0.1);padding:10px;border-radius:8px"><i class="fa-solid fa-spinner fa-spin"></i> Préparation paiement 5,99€...<br><small>Price ${PRICE_ID} | Token ${(window.PADDLE_CLIENT_TOKEN||'').slice(0,12)}...</small></div>`;
  try{
    const {data:{session}}=await supabase.auth.getSession(); 
    if(!session?.access_token) throw new Error("Session expirée - reconnectez-vous");
    let data = { priceId: PRICE_ID, customerEmail: session.user?.email || getUser()?.email };
    try {
      const res=await fetch('/api/paddle/create-checkout',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`}}); 
      if(res.ok){
        const json = await res.json();
        data = { ...data, ...json };
        console.log("Checkout data from API", data);
      } else {
        console.warn("API checkout failed, using fallback", res.status, await res.text().then(t=>t.slice(0,200)));
      }
    } catch(apiErr){
      console.warn("API checkout error, fallback to local", apiErr.message);
    }
    if(!window.Paddle){
      await new Promise((r,j)=>{
        const s=document.createElement('script'); s.src='https://cdn.paddle.com/paddle/v2/paddle.js'; s.onload=()=>{console.log("Paddle.js loaded"); r();}; s.onerror=()=>j(new Error("Paddle.js non chargé - bloqueur pub ?")); document.head.appendChild(s);
      });
    }
    const clientToken=window.PADDLE_CLIENT_TOKEN||CONFIG.PADDLE_CLIENT_TOKEN||""; 
    if(!clientToken) throw new Error("PADDLE_CLIENT_TOKEN manquant dans index.html");
    try{
      window.Paddle.Environment.set(window.PADDLE_ENV||"production"); 
      window.Paddle.Initialize({token:clientToken, eventCallback:(e)=>console.log("Paddle init event", e)});
      console.log("Paddle initialized", window.PADDLE_ENV, clientToken.slice(0,15));
    }catch(initErr){
      console.error("Paddle init failed", initErr);
      throw new Error(`Paddle Initialize échoué: ${initErr.message} - Token invalide ?`);
    }
    const fallbackUrl=`https://buy.paddle.com/checkout?items[0][priceId]=${data.priceId||PRICE_ID}&customer[email]=${encodeURIComponent(u.email)}&customData[user_id]=${encodeURIComponent(u.id)}`;
    if(statusEl) statusEl.innerHTML+=`<div style="margin-top:10px;font-size:0.85rem"><a href="${fallbackUrl}" target="_blank" class="btn-secondary small"><i class="fa-solid fa-up-right-from-square"></i> Si popup ne s'ouvre pas → paiement direct</a><br><small style="color:var(--muted)">${esc(fallbackUrl.slice(0,70))}...</small></div>`;
    
    window.Paddle.Checkout.open({
      items:[{priceId: data.priceId||PRICE_ID, quantity:1}],
      customer:{email: u.email||data.customerEmail},
      customData:{user_id: u.id},
      settings:{displayMode:'overlay', theme:'dark', locale:'fr'},
      eventCallback: async (ev)=>{
        console.log("Paddle event", ev.name, ev);
        if(ev.name==='checkout.completed'){
          if(statusEl) statusEl.innerHTML=`<div style="background:rgba(0,255,0,0.12);border:1px solid rgba(0,255,0,0.3);padding:12px;border-radius:8px"><i class="fa-solid fa-check"></i> Paiement confirmé ! Activation premium en cours...<br><small>Tx: ${esc(ev.data?.transaction_id||'')}</small></div>`;
          let tries=0; const interval=setInterval(async()=>{
            tries++; const st=await checkPremium(); 
            if(st.isActive){clearInterval(interval); toast("✅ Premium activé !","success"); if(statusEl) statusEl.innerHTML=`<div style="background:rgba(0,255,0,0.15);border:2px solid var(--success);padding:16px;border-radius:12px;text-align:center"><h3 style="color:var(--success)"><i class="fa-solid fa-crown"></i> Abonnement actif !</h3><a href="#/" class="btn-primary" style="margin-top:12px">Catalogue</a></div>`; await hydrate(); render();} 
            else if(tries>15){clearInterval(interval); if(statusEl) statusEl.innerHTML+=`<p style="font-size:0.85rem;margin-top:8px;color:var(--muted)">Webhook en attente... Si ça tarde >30s, vérifie Paddle Dashboard → Events → Webhook livré ? Et /api/health → webhookConfigured doit être true. Status: ${esc(JSON.stringify(st).slice(0,300))}</p>`;}
          },3000);
        } else if(ev.name==='checkout.error'){
          console.error("Paddle checkout.error", ev);
          const errMsg=ev.data?.error?.detail||ev.data?.error?.message||JSON.stringify(ev.data||ev).slice(0,500);
          showError(`Paddle checkout.error`, errMsg);
        } else if(ev.name==='checkout.warning'){
          console.warn("Paddle warning", ev);
        }
      }
    });
  }catch(err){
    console.error("openCheckout catch", err);
    toast("Erreur: "+err.message,"error");
    showError(err.message, err.stack||"");
  }
}

async function handleClick(e){
  const subBtn=e.target.closest('#subscribe-now-btn')||e.target.closest('#home-subscribe-btn'); if(subBtn){openCheckout(); return}
  const view=e.target.closest('[data-action="view-product"]'); if(view){location.hash=`#/product/${view.dataset.id}`; return}
  const cmd=e.target.closest('[data-action="commander"]'); if(cmd){
    const u=getUser(), p=state.products.find(x=>String(x.id)===String(cmd.dataset.id)); if(!p) return; setPending({productId:p.id,price:Number(p.prix),name:p.nom});
    if(!u){toast("Connexion obligatoire","error"); location.hash="#/login"; return}
    if(!state.isPremium && u.role!=="admin"){toast("🔒 Abonnement 5,99€ requis","error"); location.hash=`#/subscribe`; return}
    location.hash=`#/payment/${p.id}`; setTimeout(()=>window.open(tgUrl(p),"_blank"),700); return
  }
  const r=e.target.closest('[data-action="recharge-for-product"]'); if(r){const p=state.products.find(x=>String(x.id)===String(r.dataset.id)); if(p) setPending({productId:p.id,price:Number(r.dataset.price),missing:Number(r.dataset.missing),name:p.nom}); location.hash="#/wallet"; return}
  const pay=e.target.closest('[data-action="pay-product"]'); if(pay){
    const u=getUser(); if(!u){location.hash="#/login"; return}
    if(!state.isPremium && u.role!=="admin"){toast("🔒 Abonnement requis","error"); location.hash="#/subscribe"; return}
    const price=Number(pay.dataset.price); if(Number(u.balance)<price){const miss=price-Number(u.balance); setPending({productId:pay.dataset.id,price,missing:miss,name:state.products.find(x=>String(x.id)===String(pay.dataset.id))?.nom||''}); location.hash="#/wallet"; return}
    pay.disabled=true; try{const {data,error}=await supabase.rpc("pay_product",{p_product_id:pay.dataset.id}); if(error) throw error; const prod=state.products.find(x=>String(x.id)===String(pay.dataset.id)); const tg=tgUrl(prod); toast(`Paiement confirmé → Telegram`,"success"); const cur=getUser(); if(cur){cur.balance=data.new_balance||data.new; setUser(cur)} await hydrate(); setTimeout(()=>{window.open(tg,"_blank"); location.hash="#/orders"},900); render();}catch(err){toast(err.message,"error"); pay.disabled=false} return}
  const sel=e.target.closest('[data-select-method]'); if(sel){setPM(sel.dataset.selectMethod); render(); return}
  const cont=e.target.closest('[data-action="continue-to-payment"]'); if(cont){const a=document.getElementById("after-continue"); if(a) a.style.display="block"; cont.disabled=true; return}
  const vo=e.target.closest('[data-action="view-order"]'); if(vo){location.hash=`#/order/${vo.dataset.id}`; return}
  const ed=e.target.closest('[data-action="edit-product"]'); if(ed){
    const p=state.products.find(x=>String(x.id)===String(ed.dataset.id)); if(!p) return; 
    document.getElementById("product-id").value=p.id; 
    document.getElementById("prod-nom").value=p.nom||""; 
    document.getElementById("prod-prix").value=p.prix||""; 
    document.getElementById("prod-age").value=p.age||23;
    document.getElementById("prod-lieu").value=p.lieu||"";
    document.getElementById("prod-image").value=p.image||"";
    document.getElementById("prod-telegram").value=p.telegram_username||p.telegram_link||""; 
    window.scrollTo({top:0, behavior:'smooth'});
    toast("Édition "+p.nom+" - "+(p.lieu||''), "info");
    return}
}

function bind(){
  document.addEventListener("submit", async e=>{
    if(e.target.id==="login-form"){
      e.preventDefault(); 
      const btn=e.target.querySelector('button'); btn.disabled=true; btn.innerHTML=`<i class="fa-solid fa-spinner fa-spin"></i> Connexion...`;
      try{
        const {error}=await supabase.auth.signInWithPassword({email:e.target.email.value.trim(),password:e.target.password.value}); if(error) throw error; 
        await hydrate(); 
        const u=getUser();
        const pend=getPending();
        if(u?.role==="admin"){ location.hash="#/admin"; }
        else if(!state.isPremium){ location.hash="#/subscribe"; toast("Connecté - Veuillez payer 5,99€ pour activer premium","info"); }
        else if(pend&&pend.productId){location.hash=`#/payment/${pend.productId}`;}
        else {location.hash="#/";}
        render();
      }catch(err){toast(err.message,"error"); btn.disabled=false; btn.innerHTML="Connexion";}
    }
    if(e.target.id==="signup-form"){
      e.preventDefault(); 
      const btn=e.target.querySelector('button'); btn.disabled=true; btn.innerHTML=`<i class="fa-solid fa-spinner fa-spin"></i> Création compte...`;
      try{
        const email=e.target.email.value.trim(), pass=e.target.password.value;
        const {error}=await supabase.auth.signUp({email,password:pass}); if(error) throw error; 
        const {error:le}=await supabase.auth.signInWithPassword({email,password:pass}); if(le) throw le; 
        await hydrate(); 
        toast("✅ Compte créé ! Redirection paiement 5,99€","success");
        location.hash="#/subscribe";
        render();
        // Auto-open désactivé pour éviter erreur auto - utilisateur clique manuellement
        // setTimeout(()=>{ openCheckout(); },1500);
      }catch(err){toast(err.message,"error"); btn.disabled=false; btn.innerHTML=`<i class="fa-solid fa-arrow-right"></i> Créer mon compte → Payer 5,99€`;}
    }
    if(e.target.id==="wallet-recharge-form"){
      e.preventDefault(); const u=getUser(); if(!state.isPremium && u.role!=="admin"){toast("🔒 Abonnement requis","error"); return} 
      const amount=Number(document.getElementById("wallet-amount").value||0); const ref=document.getElementById("wallet-ref").value.trim()||`REF-${Date.now()}`; const file=document.getElementById("wallet-proof").files[0]; const mid=getPM(); const m=state.paymentMethods.find(x=>String(x.id)===String(mid)); if(!m||!amount||!file){toast("Champs requis","error");return} const btn=e.target.querySelector('button'); btn.disabled=true; 
      try{const path=`${u.id}/${crypto.randomUUID()}.${file.name.split(".").pop()}`; const {error:up}=await supabase.storage.from("deposit-proofs").upload(path,file); if(up) throw up; const payload={user_id:u.id,amount,currency:"EUR",payment_method:m.name,payment_method_id:mid,transaction_reference:ref,proof_path:path,proof_url:path,status:"pending"}; const {error:ins}=await supabase.from("deposit_requests").insert(payload); if(ins) throw ins; toast("En attente validation admin","success"); await hydrate(); render();}catch(err){toast(err.message,"error")} finally{btn.disabled=false}
    }
    if(e.target.id==="admin-product-form"){
      e.preventDefault(); 
      const id=document.getElementById("product-id").value||null; 
      const tel=document.getElementById("prod-telegram").value.trim(); 
      let tl=null, tu=null; if(tel){if(tel.startsWith("http")) tl=tel; else tu=tel;} 
      const payload={
        nom:document.getElementById("prod-nom").value.trim(),
        age: Number(document.getElementById("prod-age")?.value||23),
        prix: Number(document.getElementById("prod-prix").value),
        lieu: document.getElementById("prod-lieu")?.value.trim()||"Paris, France",
        image: document.getElementById("prod-image")?.value.trim()||"https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400",
        telegram_link:tl,
        telegram_username:tu
      }; 
      try{
        if(id){await supabase.from("products").update(payload).eq("id",id)} 
        else {await supabase.from("products").insert(payload)} 
        e.target.reset(); document.getElementById("product-id").value=""; await hydrate(); render(); toast("Profil enregistré - "+payload.nom+" "+payload.lieu,"success")
      }catch(err){toast(err.message,"error")}
    }
  });
}
async function render(){
  const app=$("#app"); const hash=location.hash||"#/"; const parts=hash.replace("#","").split("/").filter(Boolean); const q=new URLSearchParams(hash.split("?")[1]||""); let route=parts[0]||"home", qProd=q.get("product"); if(route==="payment"&&parts[1]) qProd=parts[1]; if(hash.includes("product=")) qProd=hash.split("product=")[1]?.split("&")[0], route="payment";
  let html=""; 
  if(route==="login") html=loginPage(); 
  else if(route==="signup") html=signupPage(); 
  else if(route==="subscribe") html=subscribePage();
  else if(route==="wallet") html=walletPage(); 
  else if(route==="products") html=productsPage(); 
  else if(route==="product"&&parts[1]) html=productPage(parts[1]); 
  else if(route==="payment"&&qProd) html=paymentPage(qProd); 
  else if(route==="orders") html=ordersPage(); 
  else if(route==="order"&&parts[1]) html=orderDetail(parts[1]); 
  else if(route==="admin") html=adminPage(); 
  else html=home();
  app.innerHTML=html;
  // Auto-open désactivé - laisse utilisateur cliquer pour éviter erreur auto
  // if(route==="subscribe" && getUser() && !state.isPremium){
  //   setTimeout(()=>{ const btn=document.getElementById("subscribe-now-btn"); if(btn && !btn.dataset.autoOpened){ btn.dataset.autoOpened="1"; openCheckout(); } },2000);
  // }
  const u=getUser(), login=$("#login-link"), signup=$("#signup-link"), logout=$("#logout-btn"); let w=$("#wallet-link"), a=$("#admin-link"), o=$("#orders-link");
  if(u){
    if(!w){w=document.createElement("a"); w.id="wallet-link"; w.href="#/wallet"; w.className="nav-link"; w.style.background="rgba(255,138,0,0.12)"; w.style.padding="6px 10px"; w.style.borderRadius="20px"; document.querySelector(".header-actions")?.prepend(w)} 
    w.innerHTML=`${Number(u.balance||0).toFixed(0)}€ ${state.isPremium?'<span style="background:var(--success);color:#fff;padding:2px 6px;border-radius:10px;font-size:0.6rem">Abonné</span>':''}`; 
    if(!o){o=document.createElement("a"); o.id="orders-link"; o.href="#/orders"; o.className="nav-link"; o.innerHTML="Mes commandes"; document.querySelector(".header-actions")?.prepend(o)} 
    if(u.role==="admin"){
      if(!a){a=document.createElement("a"); a.id="admin-link"; a.href="#/admin"; a.className="nav-link"; a.innerHTML="Dashboard"; document.querySelector(".header-actions")?.appendChild(a)} 
      login?.classList.add("hidden"); signup?.classList.add("hidden"); logout?.classList.remove("hidden")
    } else {
      a?.remove(); login?.classList.add("hidden"); signup?.classList.add("hidden"); logout?.classList.remove("hidden")
    }
  } else {
    w?.remove(); a?.remove(); o?.remove(); login?.classList.remove("hidden"); signup?.classList.remove("hidden"); logout?.classList.add("hidden")
  }
}
document.getElementById("logout-btn")?.addEventListener("click", async()=>{await supabase.auth.signOut(); setUser(null); setPending(null); setPM(null); location.hash="#/"; render()});
document.body.addEventListener("click", handleClick);
bind();
window.addEventListener("hashchange", render);
hydrate().then(()=>{render(); document.getElementById("page-loader")?.classList.add("hidden")});
