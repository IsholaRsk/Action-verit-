global.WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'POST') return res.status(200).json({ ok: true, message: "Telegram webhook - POST required" });

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID; // Ton chat ID perso pour recevoir les messages
  
  if (!BOT_TOKEN) {
    return res.status(200).json({ ok: true, message: "Bot not configured - set TELEGRAM_BOT_TOKEN" });
  }

  const update = req.body;
  console.log("Telegram update", JSON.stringify(update).slice(0,500));

  try {
    const message = update.message || update.callback_query?.message;
    const chatId = message?.chat?.id;
    const text = message?.text || "";
    const from = message?.from;

    if (!chatId) return res.json({ ok: true });

    // Auto-réponse
    const autoReply = `Bonjour ${from?.first_name || ''} 👋\n\nMerci pour votre message sur EscortHub !\n\n💳 Abonnement Premium 5,99€/mois requis pour accéder au catalogue complet\n🔗 Paiement sécurisé: https://www.escortepointfr.store/#/subscribe\n\nUn administrateur vous répondra dans quelques minutes.\n\nVeuillez nous signaler si vous constatez de fausses informations.`;

    // Envoie auto-réponse
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: autoReply,
        parse_mode: 'Markdown'
      })
    });

    // Transfère vers admin si configuré
    if (ADMIN_CHAT_ID && String(chatId) !== String(ADMIN_CHAT_ID)) {
      const forwardText = `📩 Nouveau message EscortHub\n\nDe: ${from?.first_name || ''} ${from?.last_name || ''} (@${from?.username || 'sans username'})\nChat ID: ${chatId}\nMessage: ${text}\n\nLien: https://www.escortepointfr.store/`;
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: ADMIN_CHAT_ID,
          text: forwardText
        })
      });
    }

    // Log dans Supabase si possible
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SECRET = process.env.SUPABASE_SECRET_KEY;
    if (SUPABASE_URL && SUPABASE_SECRET) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET);
      await supabase.from("admin_logs").insert({
        admin_id: null,
        action: 'telegram_message',
        target_table: 'telegram',
        details: { chatId, text: text.slice(0,500), from }
      });
    }

    res.json({ ok: true });
  } catch (e) {
    console.error("Telegram webhook error", e);
    res.json({ ok: true, error: e.message });
  }
};
