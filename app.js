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
    // sync local user badge
    const u=getUser(); if(u){u.is_premium=state.isPremium; setUser(u);}
    return data;
  }catch(e){console.error(e); return {isActive:false}}
}
async function hydrate(){try{const {data:products}=await supabase.from("products").select("*").order("created_at",{ascending:false});state.products=products||[];const u=await refreshUser();if(u){const [dep,tx,pm,sub]=await Promise.all([supabase.from("deposit_requests").select("*").order("created_at",{ascending:false}),supabase.from("transactions").select("*").order("created_at",{ascending:false}),supabase.from("payment_methods").select("*").eq("enabled",true),checkPremium()]);state.depositRequests=dep.data||[];state.transactions=tx.data||[];state.paymentMethods=pm.data||[];}}catch(e){console.error(e)}}

function subscriptionRequiredScreen(){
  return `<section class="page-shell centered" style="text-align:center;padding:60px 20px;max-width:600px;margin:0 auto">
    <div style="background:var(--panel);border:2px solid var(--accent);border-radius:20px;padding:32px">
      <div style="font-size:3rem;margin-bottom:16px">🔒</div>
      <h1 style="margin:0 0 12px">Abonnement requis</h1>
      <p style="color:var(--muted);font-size:1.1rem;margin:0 0 20px">Abonnez-vous pour accéder à toutes les fonctionnalités du site.<br>L'abonnement coûte <strong>5,99 € par mois</strong> et donne accès premium pendant toute la durée.</p>
      <div style="background:var(--panel-soft);border-radius:12px;padding:16px;margin-bottom:20px;text-align:left">
        <p style="margin:0 0 8px"><i class="fa-solid fa-check" style="color:var(--success)"></i> Accès complet catalogue premium</p>
        <p style="margin:0 0 8px"><i class="fa-solid fa-check" style="color:var(--success)"></i> Paiement sécurisé par solde</p>
        <p style="margin:0 0 8px"><i class="fa-solid fa-check" style="color:var(--success)"></i> Commandes + Telegram associé</p>
        <p style="margin:0"><i class="fa-solid fa-check" style="color:var(--success)"></i> Support premium</p>
      </div>
      <button class="btn-primary full" id="subscribe-now-btn" style="padding:16px;font-size:1.1rem"><i class="fa-solid fa-crown"></i> S'abonner maintenant - 5,99€/mois</button>
      <p style="font-size:0.8rem;color:var(--muted);margin-top:12px">Paiement sécurisé via Paddle Billing - Price ID: ${PRICE_ID}<br>Après paiement, accès premium activé automatiquement</p>
      <div id="sub-status" style="margin-top:16px"></div>
    </div>
  </section>`;
}

function productsPage(){return `<section class="section"><h2>Catalogue complet ${state.isPremium?'<span style="background:var(--success);color:#fff;padding:4px 10px;border-radius:20px;font-size:0.7rem">Abonné</span>':''}</h2><div class="product-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-top:16px">${state.products.map(card).join("")||"<p>Aucun produit - ajoutez en admin</p>"}</div></section>`}
function card(p){return `<div style="border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--panel)"><div style="background-image:url('${esc(p.image||'')}');height:160px;background-size:cover;background-position:center"></div><div style="padding:10px"><h3>${esc(p.nom)} ${euro(p.prix)}</h3><button class="btn-primary small" data-action="commander" data-id="${esc(p.id)}">COMMANDER</button> <button class="btn-secondary small" data-action="view-product" data-id="${esc(p.id)}">Voir</button></div></div>`}
function productPage(id){const p=state.products.find(x=>String(x.id)===String(id)); if(!p) return `<h1>Produit introuvable</h1>`; return `<section class="page-shell"><a href="#/products" class="btn-secondary">Retour</a><h1>${esc(p.nom)} - ${euro(p.prix)}</h1><img src="${esc(p.image||'')}" style="width:100%;max-width:400px;height:300px;object-fit:cover;border-radius:10px"/><p>Prix: ${euro(p.prix)} - Telegram: ${esc(p.telegram_username||p.telegram_link||'config admin')}</p><button class="btn-primary full" data-action="commander" data-id="${esc(p.id)}">COMMANDER → /payment?product=${esc(p.id)} → Telegram</button></section>`}
function paymentPage(pid){
  const p=state.products.find(x=>String(x.id)===String(pid)); if(!p) return `<h1>Produit introuvable</h1>`; const u=getUser(); if(!u){setPending({productId:p.id,price:Number(p.prix),name:p.nom}); return `<section class="page-shell centered"><h1>Connexion requise</h1><p>Vous devez être connecté pour commander ${esc(p.nom)}</p><a href="#/login" class="btn-primary">Connexion</a></section>`}
  // PREMIUM CHECK - serveur vérifie, pas frontend seul
  if(!state.isPremium && u.role!=="admin"){ return subscriptionRequiredScreen(); }
  const bal=Number(u.balance||0), price=Number(p.prix||0), miss=Math.max(0,price-bal), can=bal>=price;
  return `<section class="page-shell"><h1>PAGE PAIEMENT /payment?product=${esc(p.id)} ${state.isPremium?'<span style="background:var(--success);color:#fff;padding:4px 10px;border-radius:20px;font-size:0.7rem;margin-left:10px"><i class="fa-solid fa-crown"></i> Abonné</span>':''}</h1><p>Produit: ${esc(p.nom)} Prix: ${euro(price)} Solde: ${euro(bal)} Manquant: ${euro(miss)}</p>
  ${can?`<button class="btn-primary full" data-action="pay-product" data-id="${esc(p.id)}" data-price="${price}">PAYER ${price.toFixed(0)}€ → ${euro(bal-price)} → commande → Telegram</button>`:`<div style="background:rgba(255,0,0,0.1);padding:10px;border-radius:8px">Solde insuffisant - Prix ${euro(price)} Solde ${euro(bal)} Manque ${euro(miss)}</div><button class="btn-primary full" data-action="recharge-for-product" data-id="${esc(p.id)}" data-missing="${miss}" data-price="${price}">RECHARGER MON COMPTE</button>`}
  <p><small>Après profil choisi → redirection Telegram ${tgUrl(p)}</small></p></section>`;
}
function ordersPage(){
  const u=getUser(); if(!u){location.hash="#/login";return""} if(!state.isPremium && u.role!=="admin") return subscriptionRequiredScreen();
  const orders=(state.transactions||[]).filter(t=>String(t.user_id)===String(u.id)&&t.type==='purchase'); return `<section class="page-shell"><h1>Mes commandes (${orders.length}) ${state.isPremium?'<span style="background:var(--success);color:#fff;padding:4px 10px;border-radius:20px;font-size:0.7rem"><i class="fa-solid fa-crown"></i> Abonné</span>':''}</h1>${orders.map(o=>{const prod=state.products.find(p=>String(p.id)===String(o.product_id)); return `<div style="border:1px solid var(--line);padding:10px;margin-bottom:8px;border-radius:8px"><strong>Commande #${esc(o.id.slice(0,8))} ${esc(prod?.nom||'')} ${euro(Math.abs(Number(o.amount)))} Payée</strong><br><button class="btn-primary small" data-action="view-order" data-id="${esc(o.id)}">VOIR LA COMMANDE</button></div>`}).join("")||"Aucune commande"}</section>`;
}
function orderDetail(oid){const u=getUser(); if(!state.isPremium && u?.role!=="admin") return subscriptionRequiredScreen(); const o=(state.transactions||[]).find(t=>String(t.id)===String(oid)); if(!o) return `<h1>Commande introuvable</h1>`; const prod=state.products.find(p=>String(p.id)===String(o.product_id)); const url=tgUrl(prod); return `<section class="page-shell"><a href="#/orders" class="btn-secondary">Retour</a><h1>Commande #${esc(o.id.slice(0,8))} Payée</h1><p>Produit: ${esc(prod?.nom||'')} Prix: ${euro(Math.abs(Number(o.amount)))}</p><a href="${esc(url)}" target="_blank" class="btn-primary full"><i class="fa-brands fa-telegram"></i> CONTACTER SUR TELEGRAM</a></section>`}
function home(){const u=getUser(); const isSub=state.isPremium; return `<section class="section"><div style="display:flex;justify-content:space-between;align-items:center"><h2>Produits - COMMANDER → paiement → Telegram ${isSub?'<span style="background:var(--success);color:#fff;padding:4px 10px;border-radius:20px;font-size:0.7rem">Abonné</span>':''}</h2>${u&&!isSub&&u.role!=="admin"?`<button class="btn-primary" id="home-subscribe-btn"><i class="fa-solid fa-crown"></i> S'abonner 5,99€</button>`:""}</div><div class="product-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-top:16px">${state.products.map(card).join("")}</div></section>`}
function loginPage(){const pend=getPending(); return `<section class="auth-page"><div class="auth-card"><h1>CONNEXION</h1>${pend?`<p>Produit: ${esc(pend.name)} - Retour auto /payment?product=${esc(pend.productId)}</p>`:""}<form id="login-form"><label>Email<input type="email" name="email" required></label><label>Mot de passe<input type="password" name="password" required></label><button class="btn-primary">Connexion</button></form></div></section>`}
function signupPage(){return `<section class="auth-page"><div class="auth-card"><h1>Inscription</h1><form id="signup-form"><label>Nom<input name="fullName" required></label><label>Email<input type="email" name="email" required></label><label>Mot de passe<input type="password" name="password" required></label><button class="btn-primary">Créer</button></form></div></section>`}
function walletPage(){
  const u=getUser(); if(!u){location.hash="#/login";return""} if(!state.isPremium && u.role!=="admin") return subscriptionRequiredScreen();
  const bal=u.balance||0, methods=state.paymentMethods||[], pend=getPending(); let miss=0, pendProd=null; if(pend){pendProd=state.products.find(p=>String(p.id)===String(pend.productId)); if(pendProd) miss=Math.max(0,Number(pendProd.prix)-bal)} const selId=getPM(), sel=selId?methods.find(m=>String(m.id)===String(selId)):null;
  return `<section class="page-shell"><h1>Recharger Solde ${euro(bal)} ${state.isPremium?'<span style="background:var(--success);color:#fff;padding:4px 8px;border-radius:20px;font-size:0.6rem">Abonné</span>':''}</h1><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div><h3>Moyens</h3>${methods.map(m=>`<button class="btn-secondary" data-select-method="${esc(m.id)}" style="width:100%;text-align:left;margin-bottom:6px">${esc(m.name)}</button>`).join("")}</div><div>${!sel?`<p>Choisissez moyen</p>`:`<h3>${esc(sel.name)}</h3><button class="btn-primary full" data-action="continue-to-payment">CONTINUER</button><div id="after-continue" style="display:none;margin-top:10px"><form id="wallet-recharge-form" style="display:grid;gap:6px"><label>Montant<input type="number" id="wallet-amount" value="${miss.toFixed(0)}" required></label><label>Réf<input type="text" id="wallet-ref"></label><label>Hash TX<input type="text" id="wallet-crypto-hash"></label><label>Preuve<input type="file" id="wallet-proof" accept="image/*,application/pdf" required></label><button class="btn-primary">ENVOYER pending</button></form></div>`}</div></div></section>`;
}
function adminPage(){const u=getUser(); if(!u||u.role!=="admin") return `<h1>Admin uniquement</h1>`; return `<section class="page-shell"><h1>Admin - Produits Telegram + Paddle Abonnements</h1><p>Abonnés actifs: ${(state.profiles||[]).filter(p=>p.is_premium).length||'?'}</p><form id="admin-product-form" style="display:grid;gap:6px;max-width:400px"><input type="hidden" id="product-id"><label>Nom<input id="prod-nom" required></label><label>Prix<input type="number" id="prod-prix" required></label><label>Telegram<input id="prod-telegram" placeholder="@polarish87"></label><button class="btn-primary">Enregistrer</button></form><div style="margin-top:16px">${state.products.map(p=>`<div style="border:1px solid var(--line);padding:6px;margin-bottom:4px">${esc(p.nom)} ${euro(p.prix)} TG:${esc(p.telegram_username||p.telegram_link||'non')} <button class="mini-btn" data-action="edit-product" data-id="${esc(p.id)}">Edit</button></div>`).join("")}</div></section>`}
function notFound(){return `<section class="page-shell"><h1>404</h1></section>`}

// PADDLE CHECKOUT - lien paiement 5,99€
async function openCheckout(){
  const u=getUser(); if(!u){location.hash="#/login"; return}
  const statusEl=$("#sub-status")||$("#home-sub-status")||document.getElementById("sub-status");
  if(statusEl) statusEl.innerHTML=`<div style="background:rgba(255,138,0,0.1);padding:10px;border-radius:8px"><i class="fa-solid fa-spinner fa-spin"></i> Ouverture checkout Paddle... Price ${PRICE_ID} 5,99€/mois<br><small>Token: ${(window.PADDLE_CLIENT_TOKEN||'').slice(0,12)}... Env: ${window.PADDLE_ENV}</small></div>`;
  try{
    const {data:{session}}=await supabase.auth.getSession(); 
    if(!session?.access_token) throw new Error("Session expirée, reconnectez-vous");
    const res=await fetch('/api/paddle/create-checkout',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`}}); 
    if(!res.ok){ const txt=await res.text(); throw new Error(`API checkout ${res.status}: ${txt.slice(0,200)}`); }
    const data=await res.json();
    // Charge Paddle.js v2 si besoin
    if(!window.Paddle){
      await new Promise((r,j)=>{
        const s=document.createElement('script'); 
        s.src='https://cdn.paddle.com/paddle/v2/paddle.js'; 
        s.onload=()=>{console.log("Paddle.js loaded"); r();}; 
        s.onerror=()=>j(new Error("Impossible charger Paddle.js - vérifiez connexion"));
        document.head.appendChild(s);
      });
    }
    const clientToken=window.PADDLE_CLIENT_TOKEN||CONFIG.PADDLE_CLIENT_TOKEN||""; 
    const env=window.PADDLE_ENV||"production";
    if(!clientToken) throw new Error("PADDLE_CLIENT_TOKEN manquant");
    console.log("Init Paddle", env, clientToken.slice(0,15)+"...");
    window.Paddle.Environment.set(env); 
    window.Paddle.Initialize({token:clientToken});
    
    // Fallback lien direct si overlay bloque
    const fallbackUrl=`https://buy.paddle.com/checkout?items[0][priceId]=${data.priceId||PRICE_ID}&customer[email]=${encodeURIComponent(u.email)}&customData[user_id]=${encodeURIComponent(u.id)}`;
    if(statusEl) statusEl.innerHTML+=`<div style="margin-top:10px"><a href="${fallbackUrl}" target="_blank" class="btn-secondary small">Si popup ne s'ouvre pas, cliquez ici - Paiement direct</a><br><small style="color:var(--muted)">Lien: ${esc(fallbackUrl.slice(0,60))}...</small></div>`;
    
    window.Paddle.Checkout.open({
      items:[{priceId: data.priceId||PRICE_ID, quantity:1}],
      customer:{email: u.email||data.customerEmail},
      customData:{user_id: u.id},
      settings:{displayMode:'overlay', theme:'dark', locale:'fr'},
      eventCallback: async (ev)=>{
        console.log("Paddle event", ev);
        if(ev.name==='checkout.completed'){
          if(statusEl) statusEl.innerHTML=`<div style="background:rgba(0,255,0,0.1);padding:12px;border-radius:8px"><i class="fa-solid fa-check"></i> Paiement confirmé ! Activation premium en cours... Attente webhook Paddle → /api/paddle-webhook<br><small>Transaction: ${esc(ev.data?.transaction_id||'')}</small></div>`;
          let tries=0; const interval=setInterval(async()=>{
            tries++; const st=await checkPremium(); 
            if(st.isActive){clearInterval(interval); toast("✅ Abonnement activé !","success",6000); if(statusEl) statusEl.innerHTML=`<div style="background:rgba(0,255,0,0.15);border:2px solid var(--success);padding:16px;border-radius:12px;text-align:center"><h3 style="margin:0;color:var(--success)"><i class="fa-solid fa-crown"></i> Abonnement actif !</h3><p>5,99€/mois - Premium activé</p><a href="#/" class="btn-primary" style="margin-top:12px">Accéder au site</a></div>`; await hydrate(); render();} 
            else if(tries>15){clearInterval(interval); if(statusEl) statusEl.innerHTML+=`<p style="color:var(--muted)">Webhook en attente... Si ça tarde, contact admin ou recharge page. Status: ${JSON.stringify(st).slice(0,200)}</p>`;}
          },3000);
        } else if(ev.name==='checkout.error' || ev.name==='checkout.closed'){
          console.warn("Paddle checkout error/closed", ev);
          if(ev.name==='checkout.error' && statusEl) statusEl.innerHTML+=`<div style="background:rgba(255,0,0,0.1);padding:8px;border-radius:8px;margin-top:8px">Erreur Paddle: ${esc(ev.data?.error||JSON.stringify(ev).slice(0,200))}<br><a href="${fallbackUrl}" target="_blank">Essayez paiement direct</a></div>`;
        }
      }
    });
  }catch(err){
    console.error("Checkout error", err);
    toast("Erreur checkout: "+err.message,"error");
    if(statusEl) statusEl.innerHTML=`<div style="background:rgba(255,0,0,0.1);padding:10px;border-radius:8px;color:var(--danger)">Erreur: ${esc(err.message)}<br><small>Vérifie: 1) Token live_... 2) Price ${PRICE_ID} existe en PRODUCTION Paddle 3) SUPABASE_SECRET_KEY configuré serveur</small><br><br><a href="https://buy.paddle.com/checkout?items[0][priceId]=${PRICE_ID}" target="_blank" class="btn-primary small">Paiement direct Paddle (fallback)</a></div>`;
  }
}

async function handleClick(e){
  const subBtn=e.target.closest('#subscribe-now-btn')||e.target.closest('#home-subscribe-btn'); if(subBtn){openCheckout(); return}
  const manageBtn=e.target.closest('#manage-sub-btn'); if(manageBtn){
    try{const {data:{session}}=await supabase.auth.getSession(); const res=await fetch('/api/paddle/manage',{headers:{Authorization:`Bearer ${session.access_token}`}}); const data=await res.json(); if(data.customerId){toast(`Customer ID: ${data.customerId} - Utilisez portail Paddle pour gérer`,"info"); window.open(`https://customer-portal.paddle.com/cpl_${data.customerId}`,"_blank");} else toast("Aucun abonnement trouvé","error");}catch(err){toast(err.message,"error")} return
  }
  const view=e.target.closest('[data-action="view-product"]'); if(view){location.hash=`#/product/${view.dataset.id}`; return}
  const cmd=e.target.closest('[data-action="commander"]'); if(cmd){
    const u=getUser(), p=state.products.find(x=>String(x.id)===String(cmd.dataset.id)); if(!p) return; setPending({productId:p.id,price:Number(p.prix),name:p.nom});
    if(!u){toast("Connexion obligatoire","error"); location.hash="#/login"; return}
    if(!state.isPremium && u.role!=="admin"){toast("🔒 Abonnement requis - 5,99€/mois","error"); location.hash=`#/payment/${p.id}`; return}
    const tg=tgUrl(p); location.hash=`#/payment/${p.id}`; setTimeout(()=>window.open(tg,"_blank"),700); return
  }
  const r=e.target.closest('[data-action="recharge-for-product"]'); if(r){const p=state.products.find(x=>String(x.id)===String(r.dataset.id)); if(p) setPending({productId:p.id,price:Number(r.dataset.price),missing:Number(r.dataset.missing),name:p.nom}); location.hash="#/wallet"; return}
  const pay=e.target.closest('[data-action="pay-product"]'); if(pay){
    const u=getUser(); if(!u){location.hash="#/login"; return}
    if(!state.isPremium && u.role!=="admin"){toast("🔒 Abonnement requis pour payer","error"); render(); return}
    const price=Number(pay.dataset.price); if(Number(u.balance)<price){const miss=price-Number(u.balance); setPending({productId:pay.dataset.id,price,missing:miss,name:state.products.find(x=>String(x.id)===String(pay.dataset.id))?.nom||''}); location.hash="#/wallet"; return}
    pay.disabled=true; try{const {data,error}=await supabase.rpc("pay_product",{p_product_id:pay.dataset.id}); if(error) throw error; const prod=state.products.find(x=>String(x.id)===String(pay.dataset.id)); const tg=tgUrl(prod); toast(`Paiement confirmé → Telegram`,"success"); const cur=getUser(); if(cur){cur.balance=data.new_balance||data.new; setUser(cur)} await hydrate(); setTimeout(()=>{window.open(tg,"_blank"); location.hash="#/orders"},900); render();}catch(err){toast(err.message,"error"); pay.disabled=false} return}
  const sel=e.target.closest('[data-select-method]'); if(sel){setPM(sel.dataset.selectMethod); render(); return}
  const cont=e.target.closest('[data-action="continue-to-payment"]'); if(cont){const a=document.getElementById("after-continue"); if(a) a.style.display="block"; cont.disabled=true; return}
  const vo=e.target.closest('[data-action="view-order"]'); if(vo){location.hash=`#/order/${vo.dataset.id}`; return}
  const vp=e.target.closest('[data-action="view-proof"]'); if(vp){try{const {data}=await supabase.storage.from("deposit-proofs").createSignedUrl(vp.dataset.path,600); const el=vp.nextElementSibling; if(el) el.innerHTML=`<a href="${data.signedUrl}" target="_blank"><img src="${data.signedUrl}" style="max-width:250px"/></a>`}catch{toast("Erreur preuve","error")} return}
  const ap=e.target.closest('[data-action="approve-deposit"]'); if(ap){ap.disabled=true; try{const {error}=await supabase.rpc("approve_deposit",{request_id:ap.dataset.id}); if(error) throw error; toast("Approuvé 30+100=130","success"); await hydrate(); render()}catch(err){toast(err.message,"error"); ap.disabled=false} return}
  const rj=e.target.closest('[data-action="reject-deposit"]'); if(rj){const rs=prompt("Motif","Preuve invalide"); if(!rs) return; try{const {error}=await supabase.rpc("reject_deposit",{request_id:rj.dataset.id,reason:rs.trim()}); if(error) throw error; toast("Refusé","info"); await hydrate(); render()}catch(err){toast(err.message,"error")} return}
  const ed=e.target.closest('[data-action="edit-product"]'); if(ed){const p=state.products.find(x=>String(x.id)===String(ed.dataset.id)); if(!p) return; document.getElementById("product-id").value=p.id; document.getElementById("prod-nom").value=p.nom||""; document.getElementById("prod-prix").value=p.prix||""; document.getElementById("prod-telegram").value=p.telegram_username||p.telegram_link||""; return}
  const del=e.target.closest('[data-action="delete-product"]'); if(del){if(!confirm("Supprimer?")) return; await supabase.from("products").delete().eq("id",del.dataset.id); await hydrate(); render(); return}
}

function bind(){
  document.addEventListener("submit", async e=>{
    if(e.target.id==="login-form"){e.preventDefault(); try{const {error}=await supabase.auth.signInWithPassword({email:e.target.email.value.trim(),password:e.target.password.value}); if(error) throw error; await hydrate(); const pend=getPending(); if(pend&&pend.productId){location.hash=`#/payment/${pend.productId}`;} else {location.hash=getUser()?.role==="admin"?"#/admin":"#/";} render();}catch(err){toast(err.message,"error")}}
    if(e.target.id==="signup-form"){e.preventDefault(); try{const {error}=await supabase.auth.signUp({email:e.target.email.value.trim(),password:e.target.password.value}); if(error) throw error; const {error:le}=await supabase.auth.signInWithPassword({email:e.target.email.value.trim(),password:e.target.password.value}); if(le) throw le; await hydrate(); const pend=getPending(); if(pend) location.hash=`#/payment/${pend.productId}`; else location.hash="#/"; render();}catch(err){toast(err.message,"error")}}
    if(e.target.id==="wallet-recharge-form"){e.preventDefault(); const u=getUser(); if(!state.isPremium && u.role!=="admin"){toast("🔒 Abonnement requis","error"); return} const amount=Number(document.getElementById("wallet-amount").value||0); const ref=document.getElementById("wallet-ref").value.trim()||`REF-${Date.now()}`; const hash=document.getElementById("wallet-crypto-hash")?.value.trim()||null; const file=document.getElementById("wallet-proof").files[0]; const mid=getPM(); const m=state.paymentMethods.find(x=>String(x.id)===String(mid)); if(!m||!amount||!file){toast("Champs requis","error");return} const btn=e.target.querySelector('button'); btn.disabled=true; try{const path=`${u.id}/${crypto.randomUUID()}.${file.name.split(".").pop()}`; const {error:up}=await supabase.storage.from("deposit-proofs").upload(path,file); if(up) throw up; const payload={user_id:u.id,amount,currency:"EUR",payment_method:m.name,payment_method_id:mid,transaction_reference:ref,crypto_tx_hash:hash,proof_path:path,proof_url:path,status:"pending"}; const {error:ins}=await supabase.from("deposit_requests").insert(payload); if(ins) throw ins; toast("En attente validation admin","success"); await hydrate(); render();}catch(err){toast(err.message,"error")} finally{btn.disabled=false}}
    if(e.target.id==="admin-product-form"){e.preventDefault(); const id=document.getElementById("product-id").value||null; const tel=document.getElementById("prod-telegram").value.trim(); let tl=null, tu=null; if(tel){if(tel.startsWith("http")) tl=tel; else tu=tel;} const payload={nom:document.getElementById("prod-nom").value.trim(),prix:Number(document.getElementById("prod-prix").value),telegram_link:tl,telegram_username:tu}; try{if(id){await supabase.from("products").update(payload).eq("id",id)} else {await supabase.from("products").insert({...payload, age:23, lieu:"Cotonou", image:"https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400"})} e.target.reset(); document.getElementById("product-id").value=""; await hydrate(); render(); toast("Produit + Telegram","success")}catch(err){toast(err.message,"error")}}
  });
}
async function render(){
  const app=$("#app"); const hash=location.hash||"#/"; const parts=hash.replace("#","").split("/").filter(Boolean); const q=new URLSearchParams(hash.split("?")[1]||""); let route=parts[0]||"home", qProd=q.get("product"); if(route==="payment"&&parts[1]) qProd=parts[1]; if(hash.includes("product=")) qProd=hash.split("product=")[1]?.split("&")[0], route="payment";
  let html=""; if(route==="login") html=loginPage(); else if(route==="signup") html=signupPage(); else if(route==="wallet") html=walletPage(); else if(route==="products") html=productsPage(); else if(route==="product"&&parts[1]) html=productPage(parts[1]); else if(route==="payment"&&qProd) html=paymentPage(qProd); else if(route==="orders") html=ordersPage(); else if(route==="order"&&parts[1]) html=orderDetail(parts[1]); else if(route==="admin") html=adminPage(); else html=home();
  app.innerHTML=html;
  const u=getUser(), login=$("#login-link"), signup=$("#signup-link"), logout=$("#logout-btn"); let w=$("#wallet-link"), a=$("#admin-link"), o=$("#orders-link");
  if(u){if(!w){w=document.createElement("a"); w.id="wallet-link"; w.href="#/wallet"; w.className="nav-link"; w.style.background="rgba(255,138,0,0.12)"; w.style.padding="6px 10px"; w.style.borderRadius="20px"; document.querySelector(".header-actions")?.prepend(w)} w.innerHTML=`${Number(u.balance||0).toFixed(0)}€ ${state.isPremium?'<span style="background:var(--success);color:#fff;padding:2px 6px;border-radius:10px;font-size:0.6rem">Abonné</span>':''}`; if(!o){o=document.createElement("a"); o.id="orders-link"; o.href="#/orders"; o.className="nav-link"; o.innerHTML="Mes commandes"; document.querySelector(".header-actions")?.prepend(o)} if(u.role==="admin"){if(!a){a=document.createElement("a"); a.id="admin-link"; a.href="#/admin"; a.className="nav-link"; a.innerHTML="Dashboard"; document.querySelector(".header-actions")?.appendChild(a)} login?.classList.add("hidden"); signup?.classList.add("hidden"); logout?.classList.remove("hidden")} else {a?.remove(); login?.classList.add("hidden"); signup?.classList.add("hidden"); logout?.classList.remove("hidden")}} else {w?.remove(); a?.remove(); o?.remove(); login?.classList.remove("hidden"); signup?.classList.remove("hidden"); logout?.classList.add("hidden")}
}
document.getElementById("logout-btn")?.addEventListener("click", async()=>{await supabase.auth.signOut(); setUser(null); setPending(null); setPM(null); location.hash="#/"; render()});
document.body.addEventListener("click", handleClick);
bind();
window.addEventListener("hashchange", render);
hydrate().then(()=>{render(); document.getElementById("page-loader")?.classList.add("hidden")});
