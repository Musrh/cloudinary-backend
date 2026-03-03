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

// 🔹 Fonction pour mettre à jour les produits externes
async function updateExternalProducts(keyword = "smartwatch") {
  try {
    const run = await client.actor("akash9078/amazon-search-scraper").call({
      search: keyword,
      maxItems: 10, // nombre de produits à récupérer
    });

    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    if (!items || items.length === 0) {
      console.log("Aucun produit récupéré depuis l'actor Apify");
      return [];
    }

    const batch = db.batch();

    items.forEach((item) => {
      // Utiliser un ID unique pour Firestore, ex: ASIN ou URL
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
    console.log(`${items.length} produits externes mis à jour dans Firestore`);
    return items;
  } catch (err) {
    console.error("Erreur updateExternalProducts:", err.message);
    throw err;
  }
}

// 🔹 Endpoint GET pour lancer la mise à jour
app.get("/update-products-external", async (req, res) => {
  const keyword = req.query.keyword || "smartwatch";

  try {
    const produits = await updateExternalProducts(keyword);
    res.send({
      status: "ok",
      message: `${produits.length} produits externes mis à jour pour "${keyword}"`,
      produits,
    });
  } catch (err) {
    res.status(500).send({ status: "error", message: "Erreur serveur", details: err.message });
  }
});

// 🔹 Endpoint test
app.get("/", (req, res) => {
  res.send({ status: "running", message: "Bienvenue sur Node.js API" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
