// index.js
import express from "express";
import admin from "firebase-admin";
import { ApifyClient } from "apify-client";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// 🔹 Initialiser Firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// 🔹 Fonction pour mettre à jour les produits externes depuis Apify
async function updateExternalProducts(keyword = "smartwatch") {
  try {
    const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

    // Lance l'actor Amazon Product Search
    const run = await client.actor("apify/amazon-product-search").call({
      search: keyword,
      maxItems: 5, // nombre de produits à récupérer
    });

    // Récupère les produits dans le dataset par défaut
    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    if (!items || items.length === 0) {
      console.log("Aucun produit récupéré depuis Apify");
      return [];
    }

    const batch = db.batch();

    items.forEach((item) => {
      const docRef = db.collection("ProductsExternes").doc(item.asin || item.id);

      batch.set(
        docRef,
        {
          nom: item.title || "Produit",
          prix: parseFloat(item.price) || 0,
          image: item.image || "",
          source: "Amazon",
          url: item.url || "",
        },
        { merge: true }
      );
    });

    await batch.commit();
    console.log(`${items.length} produits externes mis à jour`);
    return items;
  } catch (err) {
    console.error("Erreur updateExternalProducts:", err.message);
    throw err;
  }
}

// 🔹 Endpoint pour lancer manuellement la mise à jour
app.get("/update-products-external", async (req, res) => {
  const keyword = req.query.keyword || "smartwatch";
  try {
    const produits = await updateExternalProducts(keyword);
    res.json({
      status: "ok",
      message: `${produits.length} produits externes mis à jour pour "${keyword}"`,
      sample: produits[0] || null,
    });
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur", details: err.message });
  }
});

// 🔹 Endpoint test
app.get("/", (req, res) => {
  res.json({ message: "Welcome to Node.js API", status: "running" });
});

// 🔹 Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
