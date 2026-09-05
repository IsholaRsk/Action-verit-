# Bot Telegram Auto - EscortHub

## Créer le bot (2 min)
1. Va sur Telegram -> cherche @BotFather
2. Envoie /newbot
3. Nom: EscortHub Bot
4. Username: EscortHubSupportBot (doit finir par bot)
5. BotFather te donne token: `123456:ABC-...`

## Configurer
Dans Vercel -> Settings -> Environment Variables, ajoute:
- TELEGRAM_BOT_TOKEN = ton token du bot
- TELEGRAM_ADMIN_CHAT_ID = ton chat ID perso (pour recevoir les messages)

Pour trouver ton chat ID:
1. Envoie un message à ton bot
2. Va sur https://api.telegram.org/bot<TON_TOKEN>/getUpdates
3. Cherche "chat":{"id": 123456789} -> c'est ton ADMIN_CHAT_ID

## Webhook
Après déploiement, configure webhook:
```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://www.escortepointfr.store/api/telegram-webhook
```

## Fonctionnalités
- Auto-réponse 5,99€ + lien paiement
- Transfert vers admin
- Log dans Supabase
