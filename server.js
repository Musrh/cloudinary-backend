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

// 🔹 Fonction principale pour mettre à jour les produits externes
async function updateExternalProducts(keyword = "smartwatch") {
  const logs = [];
  try {
    logs.push(`Recherche de produits pour le mot-clé "${keyword}"...`);

    // Appel de l'actor Amazon Search Scraper
    const run = await client.actor("akash9078/amazon-search-scraper").call({
      search: keyword,
      maxItems: 10, // nombre maximum de produits
    });
    logs.push("Actor appelé avec succès");

    // Récupération des produits depuis le dataset par défaut
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    logs.push(`${items.length} produits récupérés depuis l'actor`);

    if (items.length === 0) return logs;

    // Préparer batch Firestore
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

    return logs;
  } catch (err) {
    logs.push(`Erreur: ${err.message}`);
    console.error("updateExternalProducts error:", err);
    throw logs;
  }
}

// 🔹 Endpoint GET pour mettre à jour les produits externes
app.get("/update-products-external", async (req, res) => {
  const keyword = req.query.keyword || "smartwatch";
  try {
    const logs = await updateExternalProducts(keyword);
    res.send({ status: "ok", logs });
  } catch (logs) {
    res.status(500).send({ status: "error", logs, message: "Erreur serveur" });
  }
});

// 🔹 Endpoint test pour vérifier que le serveur fonctionne
app.get("/", (req, res) => {
  res.send({ status: "running", message: "Bienvenue sur Node.js API" });
});

// 🔹 Démarrage du serveur
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
