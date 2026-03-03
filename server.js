
import express from "express";
import admin from "firebase-admin";
import { ApifyClient } from "apify-client";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

// 🔹 Initialisation Firebase
let db;
try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  db = admin.firestore();
  console.log("✅ Firebase initialisé avec succès");
} catch (err) {
  console.error("❌ Erreur d'initialisation Firebase:", err.message);
}

// 🔹 Initialisation Apify
let client;
try {
  client = new ApifyClient({ token: process.env.APIFY_TOKEN });
  console.log("✅ ApifyClient initialisé avec succès");
} catch (err) {
  console.error("❌ Erreur d'initialisation Apify:", err.message);
}

// 🔹 Fonction pour mettre à jour les produits externes
async function updateExternalProducts(keyword = "smartwatch") {
  const logs = [];
  try {
    logs.push(`Recherche de produits pour le mot-clé "${keyword}"`);

    // Appel de l'actor
    const run = await client.actor("akash9078/amazon-search-scraper").call({
      search: keyword,
      maxItems: 5,
    });
    logs.push("✅ Actor Apify appelé avec succès");

    // Récupération des items
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    logs.push(`✅ ${items.length} produits récupérés depuis l'actor`);

    if (items.length === 0) {
      logs.push("⚠️ Aucun produit récupéré");
      return logs;
    }

    // Batch Firestore
    const batch = db.batch();
    items.forEach((item) => {
      const docId = item.asin || item.url || `item-${Date.now()}`;
      const docRef = db.collection("ProductsExternes").doc(docId);

      batch.set(docRef, {
        nom: item.title || "Produit Amazon",
        prix: parseFloat(item.price) || 0,
        image: item.image || null,
        source: "Amazon",
        url: item.url || "",
      }, { merge: true });
    });

    await batch.commit();
    logs.push(`✅ ${items.length} produits ajoutés/mergés dans Firestore`);
    return logs;
  } catch (err) {
    logs.push(`❌ Erreur updateExternalProducts: ${err.message}`);
    console.error("updateExternalProducts error:", err);
    throw logs;
  }
}

// 🔹 Endpoint GET
app.get("/update-products-external", async (req, res) => {
  const keyword = req.query.keyword || "smartwatch";
  const logs = [];
  try {
    const updateLogs = await updateExternalProducts(keyword);
    logs.push(...updateLogs);
    res.send({ status: "
