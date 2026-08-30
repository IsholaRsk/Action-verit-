/**
 * LUNACORE — Backend API (fichier unique)
 * ----------------------------------------
 * Node.js pur (aucune dépendance externe, pas de npm install requis).
 * Remplace les routes /app/api/* de la version Next.js + le schema.prisma
 * (les mêmes entités Product / Order / OrderItem sont gérées ici en mémoire).
 *
 * Lancement :
 *   node server.js
 *   (PORT=4000 node server.js pour changer de port, défaut 3000)
 *
 * Sert aussi les fichiers statiques du frontend (index.html, style.css)
 * s'ils se trouvent dans le même dossier, donc `node server.js` suffit
 * pour lancer boutique + API ensemble sur http://localhost:3000
 *
 * Endpoints :
 *   GET    /api/products                 liste (filtres: ?category=&tag=&search=)
 *   GET    /api/products/:slug           détail d'un produit
 *
 *   GET    /api/cart                     panier de la session courante
 *   POST   /api/cart                     { productId, size, qty? } ajoute un article
 *   PATCH  /api/cart                     { productId, size, qty } fixe la quantité
 *   DELETE /api/cart/:productId/:size    retire un article
 *   DELETE /api/cart                     vide le panier
 *
 *   POST   /api/orders                   { email, shipping, items?, total? } crée une commande
 *   GET    /api/orders                   liste des commandes (admin)
 *   GET    /api/orders/:id               détail d'une commande
 */

"use strict";

const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;
const STATIC_DIR = __dirname;

/* =========================================================
   "Base de données" en mémoire — miroir du prisma/schema.prisma
   ========================================================= */

/** @type {Product[]} */
const PRODUCTS = [
  {
    id: "p1", slug: "kimono-liu-kang", name: "Kimono Liu Kang",
    price: 180, compareAtPrice: 260, category: "men",
    image: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800",
    images: [
      "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=1200",
      "https://images.unsplash.com/photo-1520975954732-35dd22299614?w=1200",
    ],
    description: "Kimono technique en coton lourd, coupe oversize, imprimé calligraphié dans le dos. Pièce signature de la collection SS23.",
    sizes: ["S", "M", "L", "XL"], stock: 24, tags: ["new", "sale"],
  },
  {
    id: "p2", slug: "asobai-stalker", name: "Asobai Stalker",
    price: 165, compareAtPrice: 220, category: "men",
    image: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800",
    images: ["https://images.unsplash.com/photo-1551028719-00167b16eac5?w=1200"],
    description: "Veste utilitaire multi-poches, tissu déperlant, capuche ajustable.",
    sizes: ["S", "M", "L", "XL"], stock: 15, tags: ["new", "sale"],
  },
  {
    id: "p3", slug: "shadow-hoodie", name: "Shadow Tech Hoodie",
    price: 140, category: "men",
    image: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800",
    images: ["https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=1200"],
    description: "Hoodie technique gris anthracite, doublure polaire, capuche renforcée.",
    sizes: ["S", "M", "L", "XL", "XXL"], stock: 32, tags: ["new"],
  },
  {
    id: "p4", slug: "raven-longsleeve", name: "Raven Longsleeve",
    price: 95, category: "men",
    image: "https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=800",
    images: ["https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=1200"],
    description: "T-shirt manches longues en jersey lourd, print graphique minimal.",
    sizes: ["S", "M", "L", "XL"], stock: 40, tags: ["new"],
  },
  {
    id: "p5", slug: "duo-print-crewneck", name: "Duo Print Crewneck",
    price: 110, category: "men",
    image: "https://images.unsplash.com/photo-1517438476312-10d79c077509?w=800",
    images: ["https://images.unsplash.com/photo-1517438476312-10d79c077509?w=1200"],
    description: "Sweat col rond épais, print duo à l'avant, finitions côtelées.",
    sizes: ["S", "M", "L", "XL"], stock: 18, tags: [],
  },
  {
    id: "p6", slug: "tactical-sling-bag", name: "Tactical Sling Bag",
    price: 85, category: "accessories",
    image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800",
    images: ["https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=1200"],
    description: "Sac banane tactique multi-compartiments, sangle réglable, résistant à l'eau.",
    sizes: ["Unique"], stock: 50, tags: [],
  },
  {
    id: "p7", slug: "horn-headpiece", name: "Horn Headpiece",
    price: 60, category: "women",
    image: "https://images.unsplash.com/photo-1445205170230-053b83016050?w=800",
    images: ["https://images.unsplash.com/photo-1445205170230-053b83016050?w=1200"],
    description: "Accessoire de tête sculptural, pièce éditoriale de la collection PF23.",
    sizes: ["Unique"], stock: 10, tags: ["new"],
  },
  {
    id: "p8", slug: "cropped-tech-set", name: "Cropped Tech Set",
    price: 130, category: "women",
    image: "https://images.unsplash.com/photo-1548624313-0396c75f1b6a?w=800",
    images: ["https://images.unsplash.com/photo-1548624313-0396c75f1b6a?w=1200"],
    description: "Ensemble crop top et pantalon technique, taille haute, coupe ajustée.",
    sizes: ["XS", "S", "M", "L"], stock: 22, tags: ["new"],
  },
];

/** @type {Order[]} */
const ORDERS = [];

/** sessionId -> [{ productId, size, qty }] */
const CARTS = new Map();

/* =========================================================
   Helpers
   ========================================================= */

function findProduct(idOrSlug) {
  return PRODUCTS.find((p) => p.id === idOrSlug || p.slug === idOrSlug) || null;
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 5 * 1024 * 1024) {
        reject(new Error("Payload trop volumineux"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error("JSON invalide"));
      }
    });
    req.on("error", reject);
  });
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const out = {};
  header.split(";").forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx === -1) return;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

function getSessionId(req, res) {
  const cookies = parseCookies(req);
  let sid = cookies.sid;
  if (!sid) {
    sid = crypto.randomUUID();
    res.setHeader(
      "Set-Cookie",
      `sid=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`
    );
  }
  if (!CARTS.has(sid)) CARTS.set(sid, []);
  return sid;
}

function cartWithDetails(sid) {
  const items = CARTS.get(sid) || [];
  const detailed = items.map((i) => {
    const product = findProduct(i.productId);
    return {
      productId: i.productId,
      slug: product ? product.slug : null,
      name: product ? product.name : "Produit inconnu",
      image: product ? product.image : null,
      price: product ? product.price : 0,
      size: i.size,
      qty: i.qty,
    };
  });
  const totalItems = detailed.reduce((s, i) => s + i.qty, 0);
  const totalPrice = detailed.reduce((s, i) => s + i.qty * i.price, 0);
  return { items: detailed, totalItems, totalPrice };
}

function setCors(req, res) {
  const origin = req.headers.origin;
  res.setHeader("Access-Control-Allow-Origin", origin || "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
};

function serveStatic(req, res, pathname) {
  let filePath = pathname === "/" ? "/index.html" : pathname;
  filePath = path.join(STATIC_DIR, path.normalize(filePath).replace(/^(\.\.[/\\])+/, ""));

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 — Page introuvable");
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

/* =========================================================
   Routes /api/products
   ========================================================= */

function handleProducts(req, res, segments, query) {
  if (req.method === "GET" && segments.length === 0) {
    let list = PRODUCTS;
    const category = query.get("category");
    const tag = query.get("tag");
    const search = query.get("search");
    if (category && category !== "all") list = list.filter((p) => p.category === category);
    if (tag) list = list.filter((p) => p.tags.includes(tag));
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    return sendJson(res, 200, { products: list });
  }

  if (req.method === "GET" && segments.length === 1) {
    const product = findProduct(segments[0]);
    if (!product) return sendJson(res, 404, { error: "Produit introuvable." });
    return sendJson(res, 200, { product });
  }

  return sendJson(res, 405, { error: "Méthode non autorisée." });
}

/* =========================================================
   Routes /api/cart
   ========================================================= */

async function handleCart(req, res, segments) {
  const sid = getSessionId(req, res);

  if (req.method === "GET" && segments.length === 0) {
    return sendJson(res, 200, cartWithDetails(sid));
  }

  if (req.method === "POST" && segments.length === 0) {
    const body = await readBody(req);
    const { productId, size, qty } = body;
    const product = findProduct(productId);
    if (!product || !size) {
      return sendJson(res, 400, { error: "productId et size requis." });
    }
    const addQty = Number.isFinite(qty) && qty > 0 ? qty : 1;
    const items = CARTS.get(sid);
    const existing = items.find((i) => i.productId === product.id && i.size === size);
    if (existing) existing.qty += addQty;
    else items.push({ productId: product.id, size, qty: addQty });
    return sendJson(res, 200, cartWithDetails(sid));
  }

  if (req.method === "PATCH" && segments.length === 0) {
    const body = await readBody(req);
    const { productId, size, qty } = body;
    if (!productId || !size || !Number.isFinite(qty)) {
      return sendJson(res, 400, { error: "productId, size et qty requis." });
    }
    let items = CARTS.get(sid);
    if (qty <= 0) {
      items = items.filter((i) => !(i.productId === productId && i.size === size));
    } else {
      items = items.map((i) =>
        i.productId === productId && i.size === size ? { ...i, qty } : i
      );
    }
    CARTS.set(sid, items);
    return sendJson(res, 200, cartWithDetails(sid));
  }

  if (req.method === "DELETE" && segments.length === 2) {
    const [productId, size] = segments;
    const items = CARTS.get(sid).filter(
      (i) => !(i.productId === productId && i.size === decodeURIComponent(size))
    );
    CARTS.set(sid, items);
    return sendJson(res, 200, cartWithDetails(sid));
  }

  if (req.method === "DELETE" && segments.length === 0) {
    CARTS.set(sid, []);
    return sendJson(res, 200, cartWithDetails(sid));
  }

  return sendJson(res, 405, { error: "Méthode non autorisée." });
}

/* =========================================================
   Routes /api/orders
   ========================================================= */

async function handleOrders(req, res, segments) {
  if (req.method === "POST" && segments.length === 0) {
    const body = await readBody(req);
    const sid = getSessionId(req, res);
    const { email, shipping } = body;
    let items = body.items;

    // Si aucun panier n'est fourni explicitement, on utilise celui de la session.
    if (!items || items.length === 0) {
      items = cartWithDetails(sid).items;
    }

    if (!email || !items || items.length === 0) {
      return sendJson(res, 400, { error: "Email et articles requis." });
    }
    if (!shipping || !shipping.fullName || !shipping.address || !shipping.city) {
      return sendJson(res, 400, { error: "Adresse de livraison incomplète." });
    }

    // Vérification + décrément du stock
    for (const item of items) {
      const product = findProduct(item.productId || item.id);
      if (!product) {
        return sendJson(res, 400, { error: `Produit inconnu : ${item.productId || item.id}` });
      }
      if (product.stock < item.qty) {
        return sendJson(res, 409, { error: `Stock insuffisant pour ${product.name}.` });
      }
    }
    for (const item of items) {
      const product = findProduct(item.productId || item.id);
      product.stock -= item.qty;
    }

    const total =
      typeof body.total === "number"
        ? body.total
        : items.reduce((s, i) => s + i.price * i.qty, 0);

    const order = {
      id: `ORD-${Date.now()}`,
      email,
      shipping,
      items,
      total,
      status: "pending_payment",
      createdAt: new Date().toISOString(),
    };
    ORDERS.push(order);
    CARTS.set(sid, []); // le panier est vidé après la commande

    // TODO production : créer une session de paiement Stripe ici et
    // retourner son URL de redirection :
    // const session = await stripe.checkout.sessions.create({ ... });
    // return sendJson(res, 200, { orderId: order.id, checkoutUrl: session.url });

    return sendJson(res, 200, { orderId: order.id, status: "created" });
  }

  if (req.method === "GET" && segments.length === 0) {
    return sendJson(res, 200, { orders: ORDERS });
  }

  if (req.method === "GET" && segments.length === 1) {
    const order = ORDERS.find((o) => o.id === segments[0]);
    if (!order) return sendJson(res, 404, { error: "Commande introuvable." });
    return sendJson(res, 200, { order });
  }

  return sendJson(res, 405, { error: "Méthode non autorisée." });
}

/* =========================================================
   Serveur HTTP + routeur principal
   ========================================================= */

const server = http.createServer(async (req, res) => {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  const query = url.searchParams;

  if (!pathname.startsWith("/api/")) {
    return serveStatic(req, res, pathname);
  }

  const segments = pathname.split("/").filter(Boolean).slice(1); // enlève "api"
  const resource = segments.shift();

  try {
    if (resource === "products") return handleProducts(req, res, segments, query);
    if (resource === "cart") return await handleCart(req, res, segments);
    if (resource === "orders") return await handleOrders(req, res, segments);
    return sendJson(res, 404, { error: "Route API inconnue." });
  } catch (err) {
    return sendJson(res, 500, { error: err.message || "Erreur serveur." });
  }
});

server.listen(PORT, () => {
  console.log(`LUNACORE backend en écoute sur http://localhost:${PORT}`);
  console.log(`  - Frontend : http://localhost:${PORT}/`);
  console.log(`  - API      : http://localhost:${PORT}/api/products`);
});
