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
async function refreshUser(){const {data:{user}}=await supabase.auth.getUser();if(!user){setUser(null);return null}let p=null;try{const {data}=await supabase.from("profiles").select("id,role,balance,email,username,is_premium,premium_until").eq("id",user.id).maybeSingle();p=data}catch{}const cur={id:user.id,email:user.email,role:p?.role||"user",balance:Number(p?.balance||0),username:p?.username||"",is_premium:!!p?.is_premium};setUser(cur);return cur}
async function checkPremium(){
  try{
    const {data:{session}}=await supabase.auth.getSession(); if(!session?.access_token) return {isActive:false};
    const res=await fetch('/api/subscription/status',{headers:{Authorization:`Bearer ${session.access_token}`}}); const data=await res.json();
    state.subscription=data.subscription||null; state.isPremium=!!data.isActive;
    const u=getUser(); if(u){u.is_premium=state.isPremium; setUser(u);}
    return data;
  }catch(e){console.error(e); return {isActive:false}}
}
async function hydrate(){try{const {data:products}=await supabase.from("products").select("*").order("created_at",{ascending:false});state.products=products||[];const u=await refreshUser();if(u){const [dep,tx,pm,sub]=await Promise.all([supabase.from("deposit_requests").select("*").order("created_at",{ascending:false}),supabase.from("transactions").select("*").order("created_at",{ascending:false}),supabase.from("payment_methods").select("*").eq("enabled",true),checkPremium()]);state.depositRequests=dep.data||[];state.transactions=tx.data||[];state.paymentMethods=pm.data||[];}}catch(e){console.error(e)}}

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
  if(state.isPremium && u.role!=="admin") return `<section class="page-shell centered" style="text-align:center;padding:60px 20px"><div style="background:var(--panel);border:2px solid var(--success);border-radius:20px;padding:32px"><h1 style="color:var(--success)"><i class="fa-solid fa-crown"></i> Déjà Abonné !</h1><p>Votre abonnement premium est actif</p><a href="#/" class="btn-primary">Catalogue</a></div></section>`;
  return subscriptionRequiredScreen(true);
}

function productsPage(){return `<section class="section"><h2>Catalogue complet ${state.isPremium?'<span style="background:var(--success);color:#fff;padding:4px 10px;border-radius:20px;font-size:0.7rem">Abonné</span>':''}</h2><div class="product-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-top:16px">${state.products.map(card).join("")||"<p>Aucun produit</p>"}</div></section>`}
function card(p){return `<div style="border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--panel)"><div style="background-image:url('${esc(p.image||'')}');height:160px;background-size:cover;background-position:center"></div><div style="padding:10px"><h3>${esc(p.nom)} ${euro(p.prix)}</h3><button class="btn-primary small" data-action="commander" data-id="${esc(p.id)}">COMMANDER</button> <button class="btn-secondary small" data-action="view-product" data-id="${esc(p.id)}">Voir</button></div></div>`}
function productPage(id){const p=state.products.find(x=>String(x.id)===String(id)); if(!p) return `<h1>Produit introuvable</h1>`; return `<section class="page-shell"><a href="#/products" class="btn-secondary">Retour</a><h1>${esc(p.nom)} - ${euro(p.prix)}</h1><img src="${esc(p.image||'')}" style="width:100%;max-width:400px;height:300px;object-fit:cover;border-radius:10px"/><p>Prix: ${euro(p.prix)} - Telegram: ${esc(p.telegram_username||p.telegram_link||'config admin')}</p><button class="btn-primary full" data-action="commander" data-id="${esc(p.id)}">COMMANDER → Paiement → Telegram</button></section>`}
function paymentPage(pid){
  const p=state.products.find(x=>String(x.id)===String(pid)); if(!p) return `<h1>Produit introuvable</h1>`; const u=getUser(); if(!u){setPending({productId:p.id,price:Number(p.prix),name:p.nom}); return `<section class="page-shell centered"><h1>Connexion requise</h1><p>Connectez-vous pour commander ${esc(p.nom)}</p><a href="#/login" class="btn-primary">Connexion</a></section>`}
  if(!state.isPremium && u.role!=="admin"){ return subscriptionRequiredScreen(); }
  const bal=Number(u.balance||0), price=Number(p.prix||0), miss=Math.max(0,price-bal), can=bal>=price;
  return `<section class="page-shell"><h1>Paiement ${esc(p.nom)} ${state.isPremium?'<span style="background:var(--success);color:#fff;padding:4px 10px;border-radius:20px;font-size:0.7rem"><i class="fa-solid fa-crown"></i> Abonné</span>':''}</h1><p>Produit: ${esc(p.nom)} Prix: ${euro(price)} Solde: ${euro(bal)}</p>
  ${can?`<button class="btn-primary full" data-action="pay-product" data-id="${esc(p.id)}" data-price="${price}">PAYER ${price.toFixed(0)}€ → Telegram</button>`:`<div style="background:rgba(255,0,0,0.1);padding:10px;border-radius:8px">Solde insuffisant - Manque ${euro(miss)}</div><button class="btn-primary full" data-action="recharge-for-product" data-id="${esc(p.id)}" data-missing="${miss}" data-price="${price}">RECHARGER</button>`}
  <p><small>Après paiement → Telegram ${tgUrl(p)}</small></p></section>`;
}
function ordersPage(){
  const u=getUser(); if(!u){location.hash="#/login";return""} if(!state.isPremium && u.role!=="admin") return subscriptionRequiredScreen();
  const orders=(state.transactions||[]).filter(t=>String(t.user_id)===String(u.id)&&t.type==='purchase'); return `<section class="page-shell"><h1>Mes commandes (${orders.length})</h1>${orders.map(o=>{const prod=state.products.find(p=>String(p.id)===String(o.product_id)); return `<div style="border:1px solid var(--line);padding:10px;margin-bottom:8px;border-radius:8px"><strong>#${esc(o.id.slice(0,8))} ${esc(prod?.nom||'')} ${euro(Math.abs(Number(o.amount)))}</strong><br><button class="btn-primary small" data-action="view-order" data-id="${esc(o.id)}">VOIR</button></div>`}).join("")||"Aucune commande"}</section>`;
}
function orderDetail(oid){const u=getUser(); if(!state.isPremium && u?.role!=="admin") return subscriptionRequiredScreen(); const o=(state.transactions||[]).find(t=>String(t.id)===String(oid)); if(!o) return `<h1>Commande introuvable</h1>`; const prod=state.products.find(p=>String(p.id)===String(o.product_id)); const url=tgUrl(prod); return `<section class="page-shell"><a href="#/orders" class="btn-secondary">Retour</a><h1>Commande #${esc(o.id.slice(0,8))} Payée</h1><p>Produit: ${esc(prod?.nom||'')} Prix: ${euro(Math.abs(Number(o.amount)))}</p><a href="${esc(url)}" target="_blank" class="btn-primary full"><i class="fa-brands fa-telegram"></i> CONTACTER TELEGRAM</a></section>`}
function home(){const u=getUser(); const isSub=state.isPremium; return `<section class="section"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px"><h2>Produits Premium ${isSub?'<span style="background:var(--success);color:#fff;padding:4px 10px;border-radius:20px;font-size:0.7rem">Abonné</span>':''}</h2>${u&&!isSub&&u.role!=="admin"?`<a href="#/subscribe" class="btn-primary"><i class="fa-solid fa-crown"></i> S'abonner 5,99€ → Paiement direct</a>`:''}</div><div class="product-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-top:16px">${state.products.map(card).join("")}</div></section>`}
function loginPage(){const pend=getPending(); return `<section class="auth-page"><div class="auth-card"><h1>CONNEXION</h1>${pend?`<p>Produit: ${esc(pend.name)}</p>`:''}<form id="login-form"><label>Email<input type="email" name="email" required></label><label>Mot de passe<input type="password" name="password" required></label><button class="btn-primary full">Connexion</button><p style="margin-top:12px;font-size:0.85rem;text-align:center">Pas de compte ? <a href="#/signup">S'inscrire → Paiement 5,99€</a></p></form></div></section>`}
function signupPage(){return `<section class="auth-page"><div class="auth-card" style="max-width:480px"><h1>Inscription - Étape 1/2</h1><div style="background:rgba(255,138,0,0.12);border:1px solid rgba(255,138,0,0.3);padding:12px;border-radius:10px;margin-bottom:14px"><div style="font-weight:800;margin-bottom:6px"><i class="fa-solid fa-credit-card" style="color:var(--accent)"></i> Paiement direct après inscription</div><div style="font-size:0.9rem;color:var(--muted)">Après création de compte, vous serez redirigé automatiquement vers la page de paiement sécurisé <strong style="color:var(--accent)">5,99€/mois</strong> pour activer votre accès premium immédiatement.</div></div><form id="signup-form"><label>Nom complet<input name="fullName" required placeholder="Votre nom"></label><label>Email<input type="email" name="email" required placeholder="email@exemple.com"></label><label>Mot de passe<input type="password" name="password" required placeholder="Min 6 caractères"></label><button class="btn-primary full" style="padding:14px;font-size:1.1rem;font-weight:800"><i class="fa-solid fa-arrow-right"></i> Créer mon compte → Payer 5,99€</button></form><p style="font-size:0.8rem;color:var(--muted);margin-top:12px;text-align:center"><i class="fa-solid fa-lock"></i> Paiement sécurisé Paddle - Carte, PayPal, Apple Pay<br>Accès immédiat après paiement - Résiliable à tout moment</p></div></section>`}
function walletPage(){
  const u=getUser(); if(!u){location.hash="#/login";return""} if(!state.isPremium && u.role!=="admin") return subscriptionRequiredScreen();
  const bal=u.balance||0, methods=state.paymentMethods||[], pend=getPending(); let miss=0, pendProd=null; if(pend){pendProd=state.products.find(p=>String(p.id)===String(pend.productId)); if(pendProd) miss=Math.max(0,Number(pendProd.prix)-bal)} const selId=getPM(), sel=selId?methods.find(m=>String(m.id)===String(selId)):null;
  return `<section class="page-shell"><h1>Recharger Solde ${euro(bal)}</h1><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div><h3>Moyens</h3>${methods.map(m=>`<button class="btn-secondary" data-select-method="${esc(m.id)}" style="width:100%;text-align:left;margin-bottom:6px">${esc(m.name)}</button>`).join("")}</div><div>${!sel?`<p>Choisissez moyen</p>`:`<h3>${esc(sel.name)}</h3><button class="btn-primary full" data-action="continue-to-payment">CONTINUER</button><div id="after-continue" style="display:none;margin-top:10px"><form id="wallet-recharge-form" style="display:grid;gap:6px"><label>Montant<input type="number" id="wallet-amount" value="${miss.toFixed(0)}" required></label><label>Réf<input type="text" id="wallet-ref"></label><label>Preuve<input type="file" id="wallet-proof" accept="image/*" required></label><button class="btn-primary">ENVOYER</button></form></div>`}</div></div></section>`;
}
function adminPage(){const u=getUser(); if(!u||u.role!=="admin") return `<h1>Admin uniquement</h1>`; return `<section class="page-shell"><h1>Admin - Produits + Paddle</h1><form id="admin-product-form" style="display:grid;gap:6px;max-width:400px"><input type="hidden" id="product-id"><label>Nom<input id="prod-nom" required></label><label>Prix<input type="number" id="prod-prix" required></label><label>Telegram<input id="prod-telegram" placeholder="@polarish87"></label><button class="btn-primary">Enregistrer</button></form><div style="margin-top:16px">${state.products.map(p=>`<div style="border:1px solid var(--line);padding:6px;margin-bottom:4px">${esc(p.nom)} ${euro(p.prix)} <button class="mini-btn" data-action="edit-product" data-id="${esc(p.id)}">Edit</button></div>`).join("")}</div></section>`}

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
    const res=await fetch('/api/paddle/create-checkout',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`}}); 
    if(!res.ok){ const txt=await res.text(); throw new Error(`Backend /api/paddle/create-checkout ${res.status}`); }
    const data=await res.json();
    console.log("Checkout data", data);
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
  const ed=e.target.closest('[data-action="edit-product"]'); if(ed){const p=state.products.find(x=>String(x.id)===String(ed.dataset.id)); if(!p) return; document.getElementById("product-id").value=p.id; document.getElementById("prod-nom").value=p.nom||""; document.getElementById("prod-prix").value=p.prix||""; document.getElementById("prod-telegram").value=p.telegram_username||p.telegram_link||""; return}
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
      e.preventDefault(); const id=document.getElementById("product-id").value||null; const tel=document.getElementById("prod-telegram").value.trim(); let tl=null, tu=null; if(tel){if(tel.startsWith("http")) tl=tel; else tu=tel;} const payload={nom:document.getElementById("prod-nom").value.trim(),prix:Number(document.getElementById("prod-prix").value),telegram_link:tl,telegram_username:tu}; 
      try{if(id){await supabase.from("products").update(payload).eq("id",id)} else {await supabase.from("products").insert({...payload, age:23, lieu:"Cotonou", image:"https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400"})} e.target.reset(); document.getElementById("product-id").value=""; await hydrate(); render(); toast("Produit enregistré","success")}catch(err){toast(err.message,"error")}
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
