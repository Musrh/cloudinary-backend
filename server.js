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

// 🔹 Endpoint GET pour lancer la mise à jour
app.get("/update-products-external", async (req, res) => {
  const keyword = req.query.keyword || "smartwatch";
  const logs = [];
  try {
    logs.push(`Lancement updateExternalProducts pour "${keyword}"`);

    // Appel de l'actor Walmart (exemple)
    const run = await client.actor("brave_paradise/walmart-product-search-scraper").call({
      search: keyword,
      maxItems: 10,
    });
    logs.push("Actor Walmart appelé avec succès");

    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    logs.push(`${items.length} produits récupérés de l'actor`);

    if (!items || items.length === 0) {
      return res.send({ status: "ok", logs, produits: [] });
    }

    const batch = db.batch();

    items.forEach((item) => {
      // Créer un ID sûr pour Firestore si item.id ou item.url est manquant
      const docId = item.id || item.url || `${keyword}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const docRef = db.collection("ProductsExternes").doc(docId);

      batch.set(
        docRef,
        {
          nom: item.title || "Produit Walmart",
          prix: parseFloat(item.price) || 0,
          image: item.image || null,
          source: "Walmart",
          url: item.url || "",
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
