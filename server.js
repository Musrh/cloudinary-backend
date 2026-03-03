// server.js (CommonJS)
const express = require("express");
const admin = require("firebase-admin");
const { ApifyClient } = require("apify-client");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

// 🔹 Initialiser Firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// 🔹 Initialiser Apify
const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

// 🔹 Fonction pour mettre à jour les produits externes
async function updateExternalProducts(keyword = "smartwatch") {
  const logs = [];
  try {
    logs.push(`Lancement updateExternalProducts pour "${keyword}"`);

    // Appel de l'actor Apify
    const run = await client.actor("akash9078/amazon-search-scraper").call({
      search: keyword,
      maxItems: 10,
    });
    logs.push("Actor appelé avec succès");

    // Récupération des résultats
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    logs.push(`${items.length} produits récupérés de l'actor`);

    if (!items || items.length === 0) {
      logs.push("Aucun produit à ajouter dans Firestore");
      return logs;
    }

    // Mise à jour batch Firestore
    const batch = db.batch();
    items.forEach((item) => {
      const docId = item.asin || item.url;
      const docRef = db.collection("ProductsExternes").doc(docId);

      batch.set(
        docRef,
        {
          nom: item.title || "Produit Amazon",
          prix: parseFloat(item.price) || 0,
          image: item.image || null,
          source: "Amazon",
          url: item.url || "",
        },
        { merge: true }
      );
    });

    await batch.commit();
    logs.push(`${items.length} produits ajoutés dans Firestore`);
    return logs;
  } catch (err) {
    logs.push(`Erreur updateExternalProducts: ${err.message}`);
    console.error(err);
    return logs;
  }
}

// 🔹 Endpoint GET pour lancer la mise à jour
app.get("/update-products-external", async (req, res) => {
  const keyword = req.query.keyword || "smartwatch";

  const logs = await updateExternalProducts(keyword);

  // Si erreur détectée dans les logs
  const hasError = logs.some((l) => l.startsWith("Erreur"));
  if (hasError) {
    return res.status(500).send({ status: "error", logs, message: "Erreur serveur" });
  }

  res.send({ status: "ok", logs, message: `Mise à jour terminée pour "${keyword}"` });
});

// 🔹 Endpoint test
app.get("/", (req, res) => {
  res.send({ status: "running", message: "Bienvenue sur Node.js API" });
});

// 🔹 Lancement serveur
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
