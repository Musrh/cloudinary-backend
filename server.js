// server.js
import express from "express";
import admin from "firebase-admin";
import { ApifyClient } from "apify-client";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// 🔹 Initialiser Firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 🔹 Initialiser Apify
const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

// 🔹 Endpoint GET pour lancer la mise à jour des produits externes
app.get("/update-products-external", async (req, res) => {
  const keyword = req.query.keyword || "smartwatch";
  const maxItems = parseInt(req.query.maxItems) || 10;
  const logs = [];

  try {
    logs.push(`Lancement updateExternalProducts pour "${keyword}" via eBay`);

    // Appel de l'actor eBay
    const run = await client.actor("dtrungtin/ebay-items-scraper").call({
      search: keyword,
      maxItems
    });

    logs.push("Actor eBay appelé avec succès");

    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    logs.push(`${items.length} produits récupérés de l'actor eBay`);

    if (!items || items.length === 0) {
      return res.send({ status: "ok", logs, produits: [] });
    }

    const batch = db.batch();

    items.forEach((item) => {
      // Créer un ID sûr pour Firestore
      const docId = item.itemId || item.url || `${keyword}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const docRef = db.collection("ProductsExternes").doc(docId);

      batch.set(
        docRef,
        {
          nom: item.title || "Produit eBay",
          prix: parseFloat(item.price) || 0,
          image: item.image || null,
          url: item.url || "",
          source: "eBay",
          shipping: item.shipping || "",
          seller: item.seller || ""
        },
        { merge: true }
      );
    });

    await batch.commit();
    logs.push(`${items.length} produits ajoutés dans Firestore`);

    res.send({ status: "ok", logs, produits: items });
  } catch (err) {
    logs.push(`Erreur updateExternalProducts: ${err.message}`);
    res.status(500).send({ status: "error", logs, message: "Erreur serveur" });
  }
});

// 🔹 Endpoint test
app.get("/", (req, res) => {
  res.send({ status: "running", message: "Bienvenue sur Node.js API" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
