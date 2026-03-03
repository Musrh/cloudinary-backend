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

// 🔹 Endpoint GET pour mise à jour produits externes
app.get("/update-products-external", async (req, res) => {
  const keyword = req.query.keyword || "smartwatch";
  const logs = [];
  try {
    const run = await client.actor("akash9078/amazon-search-scraper").call({
      search: keyword,
      maxItems: 10,
    });
    logs.push("Actor appelé avec succès");

    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    logs.push(`${items.length} produits récupérés de l'actor`);

    const batch = db.batch();
    items.forEach((item) => {
      const docRef = db.collection("ProductsExternes").doc(item.asin || item.url);
      batch.set(docRef, {
        nom: item.title || "Produit Amazon",
        prix: parseFloat(item.price) || 0,
        image: item.image || null,
        source: "Amazon",
        url: item.url || "",
      }, { merge: true });
    });
    await batch.commit();
    logs.push(`${items.length} produits ajoutés dans Firestore`);

    res.send({ status: "ok", logs, produits: items });
  } catch (err) {
    logs.push(`Erreur: ${err.message}`);
    res.status(500).send({ status: "error", logs, message: "Erreur serveur" });
  }
});

// 🔹 Endpoint test pour vérifier le serveur
app.get("/", (req, res) => {
  res.send({ status: "running", message: "Bienvenue sur Node.js API" });
});

// 🔹 Démarrer le serveur
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
