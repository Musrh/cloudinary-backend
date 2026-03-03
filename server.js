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

// 🔹 Fonction pour mettre à jour les produits externes depuis Walmart
async function updateExternalProducts(keyword = "smartwatch") {
    const logs = [`Lancement updateExternalProducts pour "${keyword}"`];

    try {
        // Appeler l'actor Walmart
        const run = await client.actor("brave_paradise/walmart-product-search-scraper").call({
            search: keyword,
            maxItems: 10, // nombre de produits
        });
        logs.push("Actor Walmart appelé avec succès");

        // Récupérer les résultats
        const { items } = await client.dataset(run.defaultDatasetId).listItems();
        logs.push(`${items.length} produits récupérés de l'actor`);

        if (!items || items.length === 0) {
            return logs;
        }

        // Enregistrer dans Firestore
        const batch = db.batch();
        items.forEach(item => {
            const docRef = db.collection("ProductsExternes").doc(item.id || item.url);
            batch.set(docRef, {
                nom: item.title || "Produit Walmart",
                prix: parseFloat(item.price) || 0,
                image: item.image || null,
                source: "Walmart",
                url: item.url || "",
            }, { merge: true });
        });

        await batch.commit();
        logs.push(`${items.length} produits ajoutés dans Firestore`);

        return logs;
    } catch (err) {
        logs.push(`Erreur updateExternalProducts: ${err.message}`);
        throw err;
    }
}

// 🔹 Endpoint GET pour mise à jour manuelle
app.get("/update-products-external", async (req, res) => {
    const keyword = req.query.keyword || "smartwatch";

    try {
        const logs = await updateExternalProducts(keyword);
        res.send({ status: "ok", logs });
    } catch (err) {
        res.status(500).send({ status: "error", logs: [err.message], message: "Erreur serveur" });
    }
});

// 🔹 Endpoint test
app.get("/", (req, res) => {
    res.send({ status: "running", message: "Bienvenue sur Node.js API" });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
