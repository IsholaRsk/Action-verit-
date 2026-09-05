module.exports = (req, res) => {
  res.json({ ok: true, message: "API Vercel OK", timestamp: new Date().toISOString(), paddlePriceId: process.env.PADDLE_PRICE_ID || "pri_01m1e8e2ybr9rjmaq0kz4ezpnk" });
};
