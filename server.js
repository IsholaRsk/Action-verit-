"use strict";
try { require("dotenv").config(); } catch {}
try { if (typeof global.WebSocket === 'undefined') { global.WebSocket = require("ws"); } } catch {}
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

const PORT = process.env.PORT || 3000;
const STATIC_DIR = __dirname;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabaseAdmin = null;
try {
  if (SUPABASE_URL && SUPABASE_SECRET_KEY) {
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  }
} catch (e) { console.error("Supabase client error", e.message); }

const app = express();
app.use(cors({ origin: (origin, cb) => cb(null, origin || true), credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use((req, _, next) => { if (req.path.startsWith("/api/")) console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`); next(); });

async function requireUser(req, res) {
  if (!supabaseAdmin) { res.status(500).json({ error: "Supabase non configuré" }); return null; }
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) { res.status(401).json({ error: "Auth requise" }); return null; }
  const token = auth.slice(7).trim();
  if (!token) { res.status(401).json({ error: "Token manquant" }); return null; }
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) { res.status(401).json({ error: "Session invalide" }); return null; }
  return data.user;
}
async function requireAdmin(req, res) {
  const user = await requireUser(req, res);
  if (!user) return null;
  const { data: profile, error } = await supabaseAdmin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (error || !profile || profile.role !== "admin") { res.status(403).json({ error: "Admin requis" }); return null; }
  return user;
}

// ===== PADDLE BILLING - ABONNEMENT 5.99€ pri_01m1e8e2ybr9rjmaq0kz4ezpnk =====
const PADDLE_PRICE_ID = process.env.PADDLE_PRICE_ID || "pri_01m1e8e2ybr9rjmaq0kz4ezpnk";
const PADDLE_WEBHOOK_SECRET = process.env.PADDLE_WEBHOOK_SECRET || "";
const crypto = require("crypto");

function verifyPaddleSignatureNode(rawBody, signatureHeader, secret){
  if(!signatureHeader || !secret) return false;
  const parts={}; signatureHeader.split(';').forEach(p=>{const [k,v]=p.split('='); if(k&&v) parts[k.trim()]=v.trim();});
  const ts=parts['ts'], h1=parts['h1']; if(!ts||!h1) return false;
  const signed = `${ts}:${rawBody}`;
  const computed = crypto.createHmac('sha256', secret).update(signed).digest('hex');
  try{ return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(h1)); }catch{ return computed===h1; }
}

// Webhook doit recevoir raw body - on ajoute middleware raw pour cette route
app.post("/api/paddle-webhook", express.raw({type:'*/*'}), async (req,res)=>{
  const rawBody = req.body instanceof Buffer ? req.body.toString('utf8') : (typeof req.body==='string'?req.body:JSON.stringify(req.body));
  const sig = req.headers['paddle-signature'] || req.headers['Paddle-Signature'] || '';
  if(PADDLE_WEBHOOK_SECRET && !verifyPaddleSignatureNode(rawBody, sig, PADDLE_WEBHOOK_SECRET)){
    console.error("Paddle signature invalide", sig);
    return res.status(401).json({error:"Signature invalide"});
  }
  let event; try{ event = typeof req.body==='object' && !(req.body instanceof Buffer) ? req.body : JSON.parse(rawBody); }catch{ return res.status(400).json({error:"JSON invalide"}); }
  const eventType = event.event_type || 'unknown';
  const data = event.data || {};
  const subId = data.id || data.subscription_id || null;
  const custId = data.customer_id || data.customer?.id || null;
  let userId = data.custom_data?.user_id || data.custom_data?.userId || data.customData?.user_id || null;
  let priceId = data.items?.[0]?.price?.id || data.price_id || PADDLE_PRICE_ID;
  let status = data.status || 'inactive';
  let curStart = data.current_billing_period?.starts_at || data.started_at || null;
  let curEnd = data.current_billing_period?.ends_at || data.next_billed_at || null;
  let nextBilled = data.next_billed_at || curEnd;

  // Si pas de user_id, cherche via customer_id
  if(!userId && custId && supabaseAdmin){
    const {data:existing} = await supabaseAdmin.from("paddle_subscriptions").select("user_id").eq("paddle_customer_id", custId).maybeSingle();
    if(existing?.user_id) userId = existing.user_id;
  }

  console.log(`Paddle webhook ${eventType} sub=${subId} cust=${custId} user=${userId} status=${status}`);

  if((subId || userId) && supabaseAdmin){
    const upsert = {
      paddle_customer_id: custId,
      paddle_subscription_id: subId,
      price_id: priceId,
      status,
      current_period_start: curStart,
      current_period_end: curEnd,
      next_billed_at: nextBilled,
      updated_at: new Date().toISOString(),
      data: event
    };
    if(userId) upsert.user_id = userId;
    const {error} = await supabaseAdmin.from("paddle_subscriptions").upsert(upsert, {onConflict: userId ? 'user_id' : 'paddle_subscription_id'});
    if(error){ console.error("Supabase upsert paddle error", error.message); return res.status(500).json({error:error.message}); }
  }

  res.json({received:true, event:eventType, status});
});

// Compatibilité avec endpoint PHP demandé: https://escortepointfr.store/paddle-webhook.php
// On expose aussi /paddle-webhook.php qui fait même chose
app.post("/paddle-webhook.php", express.raw({type:'*/*'}), async (req,res)=>{
  // réutilise même logique
  req.headers['paddle-signature'] = req.headers['paddle-signature'] || req.headers['Paddle-Signature'] || '';
  // forward to handler
  const rawBody = req.body instanceof Buffer ? req.body.toString('utf8') : JSON.stringify(req.body);
  const sig = req.headers['paddle-signature'] || '';
  if(PADDLE_WEBHOOK_SECRET && !verifyPaddleSignatureNode(rawBody, sig, PADDLE_WEBHOOK_SECRET)){
    return res.status(401).json({error:"Signature invalide"});
  }
  let event; try{ event = JSON.parse(rawBody); }catch{ return res.status(400).json({error:"JSON invalide"}); }
  const data=event.data||{}; const subId=data.id||null; const custId=data.customer_id||null; let userId=data.custom_data?.user_id||null;
  const status=data.status||'inactive'; const priceId=data.items?.[0]?.price?.id||PADDLE_PRICE_ID;
  const curEnd=data.current_billing_period?.ends_at||data.next_billed_at||null;
  if(supabaseAdmin && (subId||userId)){
    const upsert={ paddle_customer_id:custId, paddle_subscription_id:subId, price_id:priceId, status, current_period_end:curEnd, next_billed_at:curEnd, updated_at:new Date().toISOString(), data:event };
    if(userId) upsert.user_id=userId;
    await supabaseAdmin.from("paddle_subscriptions").upsert(upsert, {onConflict: userId?'user_id':'paddle_subscription_id'});
  }
  res.json({received:true, event:event.event_type});
});

// Vérification abonnement côté serveur - NE JAMAIS faire confiance frontend
app.get("/api/subscription/status", async (req,res)=>{
  const user = await requireUser(req,res); if(!user) return;
  if(!supabaseAdmin) return res.status(500).json({error:"Supabase non configuré"});
  const {data, error} = await supabaseAdmin.from("paddle_subscriptions").select("*").eq("user_id", user.id).maybeSingle();
  if(error) return res.status(500).json({error:error.message});
  const isActive = data && ['active','trialing'].includes(data.status) && (!data.current_period_end || new Date(data.current_period_end) > new Date());
  res.json({ subscription: data||null, isActive, isPremium: isActive, priceId: PADDLE_PRICE_ID });
});

// Création checkout - retourne infos pour frontend Paddle.js (pas de secret)
app.post("/api/paddle/create-checkout", async (req,res)=>{
  const user = await requireUser(req,res); if(!user) return;
  // On ne crée pas de transaction côté serveur Paddle ici pour rester simple,
  // on retourne les infos nécessaires pour Paddle.Checkout.open côté frontend
  // Le vrai check se fait via webhook + /api/subscription/status
  res.json({
    priceId: PADDLE_PRICE_ID,
    customerEmail: user.email,
    customData: { user_id: user.id },
    // Le frontend utilisera Paddle.Initialize avec token client (via env) puis Checkout.open
  });
});

// Endpoint pour gérer abonnement (portail client Paddle)
app.get("/api/paddle/manage", async (req,res)=>{
  const user = await requireUser(req,res); if(!user) return;
  const {data} = await supabaseAdmin.from("paddle_subscriptions").select("paddle_customer_id").eq("user_id", user.id).maybeSingle();
  // Paddle Billing a un Customer Portal - URL à construire côté frontend ou retourne customer_id
  res.json({ customerId: data?.paddle_customer_id||null, message:"Utilisez Paddle Customer Portal avec customer_id" });
});

app.get("/api/health", (req, res) => { res.json({ ok: true, timestamp: new Date().toISOString(), supabaseConfigured: !!supabaseAdmin, paddlePriceId: PADDLE_PRICE_ID, paddleWebhookConfigured: !!PADDLE_WEBHOOK_SECRET }); });
app.use("/api", (req, res, next) => { if (req.path === "/health") return next(); if (!supabaseAdmin) return res.status(500).json({ error: "Supabase non configuré" }); next(); });

// PRODUCTS
app.get("/api/products", async (req, res) => {
  const { data, error } = await supabaseAdmin.from("products").select("*").order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ products: data || [] });
});
app.post("/api/products", async (req, res) => {
  const admin = await requireAdmin(req, res); if (!admin) return;
  const b=req.body;
  const payload={ ...(b.id?{id:b.id}:{}), nom:String(b.nom||"").trim(), age:Number(b.age), lieu:String(b.lieu||"").trim(), prix:Number(b.prix), image:String(b.image||"").trim(), updated_at:new Date().toISOString() };
  if (!payload.nom || payload.age<18 || !payload.lieu || payload.prix<=0 || !payload.image) return res.status(400).json({ error:"Données invalides" });
  if (!payload.id) delete payload.id;
  const { data, error } = await supabaseAdmin.from("products").upsert(payload).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ product: data });
});
app.delete("/api/products/:id", async (req, res) => {
  const admin = await requireAdmin(req, res); if (!admin) return;
  const { error } = await supabaseAdmin.from("products").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message:"Produit supprimé" });
});

// PAYMENTS LEGACY
app.post("/api/payments", async (req, res) => {
  const user = await requireUser(req, res); if (!user) return;
  const b=req.body; const amount=Number(b.amount);
  if (!Number.isFinite(amount)||amount<=0) return res.status(400).json({ error:"Montant invalide" });
  const payload={ user_id:user.id, product_id:b.productId||null, ad_id:b.adId||null, target:String(b.target||"product"), amount, method:b.method||"transcash", status:"pending", validation:"pending", proof_url:b.proofUrl||"" };
  const { data, error } = await supabaseAdmin.from("payments").insert(payload).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ payment:data });
});
app.get("/api/payments", async (req, res) => {
  const admin = await requireAdmin(req, res); if (!admin) return;
  const { data, error } = await supabaseAdmin.from("payments").select("*").order("created_at",{ascending:false});
  if (error) return res.status(500).json({ error:error.message });
  res.json({ payments:data||[] });
});
app.patch("/api/payments/:id", async (req, res) => {
  const admin = await requireAdmin(req, res); if (!admin) return;
  const allowed={}; if(["pending","accepted","declined"].includes(req.body.status)) allowed.status=req.body.status; if(["pending","valid","invalid"].includes(req.body.validation)) allowed.validation=req.body.validation; allowed.updated_at=new Date().toISOString();
  const { data: payment, error } = await supabaseAdmin.from("payments").update(allowed).eq("id",req.params.id).select().single();
  if (error) return res.status(500).json({ error:error.message });
  if(payment.target==="ad"&&payment.ad_id){ await supabaseAdmin.from("ads").update({ status: payment.status==="accepted"?"active":"declined" }).eq("id",payment.ad_id); }
  res.json({ payment });
});

// ===== TRANSACTION VALIDATION FOR ADMIN =====
app.get("/api/deposit-requests", async (req, res) => {
  const admin = await requireAdmin(req, res); if (!admin) return;
  const { data, error } = await supabaseAdmin.from("deposit_requests").select("*").order("created_at",{ascending:false});
  if (error) return res.status(500).json({ error:error.message });
  res.json({ deposit_requests:data||[] });
});
app.get("/api/my/deposit-requests", async (req, res) => {
  const user = await requireUser(req, res); if (!user) return;
  const { data, error } = await supabaseAdmin.from("deposit_requests").select("*").eq("user_id",user.id).order("created_at",{ascending:false});
  if (error) return res.status(500).json({ error:error.message });
  res.json({ deposit_requests:data||[] });
});
app.post("/api/deposit-requests", async (req, res) => {
  const user = await requireUser(req, res); if (!user) return;
  const b=req.body;
  const amount=Number(b.amount);
  if(!Number.isFinite(amount)||amount<=0) return res.status(400).json({ error:"Montant invalide" });
  if(!b.payment_method||!b.transaction_reference||!b.proof_path) return res.status(400).json({ error:"Champs manquants" });
  const payload={ user_id:user.id, amount, currency:b.currency||"EUR", payment_method:b.payment_method, payment_method_id:b.payment_method_id||null, transaction_reference:String(b.transaction_reference).trim(), crypto_tx_hash:b.crypto_tx_hash||null, proof_path:String(b.proof_path).trim(), proof_url:String(b.proof_path).trim(), status:"pending" };
  const { data, error } = await supabaseAdmin.from("deposit_requests").insert(payload).select().single();
  if (error) return res.status(500).json({ error:error.message });
  res.status(201).json({ deposit_request:data, message:"Votre demande de recharge est en cours de traitement. Votre compte sera crédité uniquement après vérification et approbation par un administrateur." });
});
app.post("/api/deposit-requests/:id/approve", async (req, res) => {
  const admin = await requireAdmin(req, res); if (!admin) return;
  try{
    const { data, error } = await supabaseAdmin.rpc("approve_deposit",{ request_id:req.params.id });
    if(error) throw error;
    res.json({ result:data, message:`${data.amount}€ crédités ${data.old_balance}→${data.new_balance}` });
  }catch(e){ res.status(400).json({ error:e.message }); }
});
app.post("/api/deposit-requests/:id/reject", async (req, res) => {
  const admin = await requireAdmin(req, res); if (!admin) return;
  const reason=String(req.body.reason||"").trim();
  if(!reason||reason.length<3) return res.status(400).json({ error:"Motif requis min 3" });
  try{
    const { data, error } = await supabaseAdmin.rpc("reject_deposit",{ request_id:req.params.id, reason });
    if(error) throw error;
    res.json({ result:data });
  }catch(e){ res.status(400).json({ error:e.message }); }
});

// PAYMENT METHODS
app.get("/api/payment-methods", async (req, res) => {
  const { data, error } = await supabaseAdmin.from("payment_methods").select("*").eq("enabled",true).order("type");
  if (error) return res.status(500).json({ error:error.message });
  res.json({ payment_methods:data||[] });
});
app.get("/api/admin/payment-methods", async (req, res) => {
  const admin = await requireAdmin(req, res); if (!admin) return;
  const { data, error } = await supabaseAdmin.from("payment_methods").select("*").order("created_at",{ascending:false});
  if (error) return res.status(500).json({ error:error.message });
  res.json({ payment_methods:data||[] });
});
app.post("/api/admin/payment-methods", async (req, res) => {
  const admin = await requireAdmin(req, res); if (!admin) return;
  const b=req.body;
  if(!b.name||!b.instructions) return res.status(400).json({ error:"Nom + instructions requis" });
  const payload={ name:b.name, type:b.type||"other", currency:b.currency||"EUR", instructions:b.instructions, wallet_address:b.wallet_address||null, network:b.network||null, enabled:b.enabled!==false };
  const { data, error } = await supabaseAdmin.from("payment_methods").insert(payload).select().single();
  if (error) return res.status(500).json({ error:error.message });
  res.status(201).json({ payment_method:data });
});
app.patch("/api/admin/payment-methods/:id", async (req, res) => {
  const admin = await requireAdmin(req, res); if (!admin) return;
  const { data, error } = await supabaseAdmin.from("payment_methods").update({ ...req.body, updated_at:new Date().toISOString() }).eq("id",req.params.id).select().single();
  if (error) return res.status(500).json({ error:error.message });
  res.json({ payment_method:data });
});
app.delete("/api/admin/payment-methods/:id", async (req, res) => {
  const admin = await requireAdmin(req, res); if (!admin) return;
  const { error } = await supabaseAdmin.from("payment_methods").delete().eq("id",req.params.id);
  if (error) return res.status(500).json({ error:error.message });
  res.json({ message:"Supprimé" });
});

// TRANSACTIONS
app.get("/api/transactions", async (req, res) => {
  const admin = await requireAdmin(req, res); if (!admin) return;
  const { data, error } = await supabaseAdmin.from("transactions").select("*").order("created_at",{ascending:false}).limit(100);
  if (error) return res.status(500).json({ error:error.message });
  res.json({ transactions:data||[] });
});
app.get("/api/my/transactions", async (req, res) => {
  const user = await requireUser(req, res); if (!user) return;
  const { data, error } = await supabaseAdmin.from("transactions").select("*").eq("user_id",user.id).order("created_at",{ascending:false});
  if (error) return res.status(500).json({ error:error.message });
  res.json({ transactions:data||[] });
});

// NOTIFICATIONS
app.get("/api/notifications", async (req, res) => {
  const user = await requireUser(req, res); if (!user) return;
  const { data, error } = await supabaseAdmin.from("notifications").select("*").eq("user_id",user.id).order("created_at",{ascending:false}).limit(50);
  if (error) return res.status(500).json({ error:error.message });
  res.json({ notifications:data||[] });
});
app.post("/api/notifications/:id/read", async (req, res) => {
  const user = await requireUser(req, res); if (!user) return;
  const { error } = await supabaseAdmin.from("notifications").update({ is_read:true, read:true }).eq("id",req.params.id).eq("user_id",user.id);
  if (error) return res.status(500).json({ error:error.message });
  res.json({ ok:true });
});

// PAY PRODUCT ATOMIC
app.post("/api/pay-product/:id", async (req, res) => {
  const user = await requireUser(req, res); if (!user) return;
  try{
    const { data, error } = await supabaseAdmin.rpc("pay_product",{ p_product_id:req.params.id });
    if(error) throw error;
    res.json({ result:data });
  }catch(e){ res.status(400).json({ error:e.message }); }
});

// WALLET
app.get("/api/wallet", async (req, res) => {
  const user = await requireUser(req, res); if (!user) return;
  const { data: profile, error } = await supabaseAdmin.from("profiles").select("id,username,full_name,balance,total_credited,total_spent,role").eq("id",user.id).maybeSingle();
  if (error) return res.status(500).json({ error:error.message });
  res.json({ wallet:{ user_id:user.id, balance:Number(profile?.balance||0), total_credited:Number(profile?.total_credited||0), total_spent:Number(profile?.total_spent||0), username:profile?.username||"", role:profile?.role||"user" } });
});

// ADS
app.get("/api/ads", async (req, res) => {
  const { data, error } = await supabaseAdmin.from("ads").select("*").eq("status","active").order("created_at",{ascending:false});
  if (error) return res.status(500).json({ error:error.message });
  res.json({ ads:data||[] });
});
app.post("/api/ads", async (req, res) => {
  const user = await requireUser(req, res); if (!user) return;
  const b=req.body; const title=String(b.title||"").trim(); const text=String(b.text||"").trim(); const mediaUrl=String(b.mediaUrl||"").trim();
  if (!title||(!text&&!mediaUrl)) return res.status(400).json({ error:"Titre requis" });
  const payload={ user_id:user.id, title, text, media_type:String(b.mediaType||"text"), media_url:mediaUrl, status:"pending" };
  const { data, error } = await supabaseAdmin.from("ads").insert(payload).select().single();
  if (error) return res.status(500).json({ error:error.message });
  res.status(201).json({ ad:data });
});
app.delete("/api/ads/:id", async (req, res) => {
  const admin = await requireAdmin(req, res); if (!admin) return;
  const { error } = await supabaseAdmin.from("ads").delete().eq("id",req.params.id);
  if (error) return res.status(500).json({ error:error.message });
  res.json({ message:"Supprimé" });
});

// SETTINGS
app.get("/api/settings", async (req, res) => {
  const { data, error } = await supabaseAdmin.from("settings").select("key,value");
  if (error) return res.status(500).json({ error:error.message });
  const settings={}; for(const item of data||[]){ if(item.key==="payment_redirect_url") settings.paymentRedirectUrl=item.value; }
  res.json({ settings });
});
app.patch("/api/settings", async (req, res) => {
  const admin = await requireAdmin(req, res); if (!admin) return;
  const url=String(req.body.paymentRedirectUrl||req.body.url||"").trim();
  if (!url) return res.status(400).json({ error:"Lien requis" });
  try{ new URL(url); }catch{ return res.status(400).json({ error:"URL invalide" }); }
  const { data, error } = await supabaseAdmin.from("settings").upsert({ key:"payment_redirect_url", value:url, updated_at:new Date().toISOString() }).select().single();
  if (error) return res.status(500).json({ error:error.message });
  res.json({ settings:{ paymentRedirectUrl:data.value } });
});

app.use(express.static(STATIC_DIR, { extensions:["html"], setHeaders:(res,filePath)=>{ if(filePath.endsWith(".html")) res.setHeader("Cache-Control","no-cache"); } }));
app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error:"Route API introuvable" });
  const indexPath=path.join(STATIC_DIR,"index.html");
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  res.status(404).send("404");
});
app.use((err, req, res, next)=>{ console.error("❌",err); res.status(500).json({ error:"Erreur interne", details:err.message }); });

if (require.main===module){
  app.listen(PORT,"0.0.0.0",()=>{ console.log(`✅ EscortHub backend http://localhost:${PORT} - Validation Transactions Admin OK`); });
}
module.exports=app;
