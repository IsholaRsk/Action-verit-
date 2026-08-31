// Simple health check - no Supabase, no crash
module.exports = (req, res) => {
  res.status(200).json({ ok: true, message: "Static deployment OK - no server crash", timestamp: new Date().toISOString() });
};
