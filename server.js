import express from "express";
import admin from "firebase-admin";
import fetch from "node-fetch"; // npm install node-fetch@2

const app = express();
const PORT = process.env.PORT || 3000;

// 🔹 Init Firebase
try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (err) {
  console.error("Erreur Firebase initialization:", err);
  process.exit(1);
}

const db = admin.firestore();

// 🔹 Root test
app.get("/", (req, res) => {
  res.json({ message: "Backend API running", timestamp: new Date().toISOString() });
});

// 🔹 Endpoint pour mettre à jour ProductsExternes
app.get("/update-products-external", async (req, res) => {
  const keyword = req.query.keyword || "smartwatch";

  try {
    console.log("Update ProductsExternes pour:", keyword);

    const response = await fetch(
      `https://aliexpress-datahub.p.rapidapi.com/item_search?keywords=${encodeURIComponent(keyword)}&page=1&limit=5`,
      {
        method: "GET",
        headers: {
          "x-rapidapi-host": "aliexpress-datahub.p.rapidapi.com",
          "x-rapidapi-key": process.env.RAPIDAPI_KEY
        }
      }
    );

    if (!response.ok) {
      console.error("Erreur API AliExpress:", response.status, response.statusText);
      return res.status(500).json({ error: "Erreur API AliExpress", status: response.status });
    }

    const data = await response.json();
    console.log("Données reçues:", data);

    if (!data.result || !Array.isArray(data.result)) {
      return res.status(200).json({ status: "ok", message: "Aucun produit reçu" });
    }

    const batch = db.batch();

    data.result.forEach(item => {
      const docRef = db.collection("ProductsExternes").doc(item.itemId); // id unique AliExpress
      batch.set(docRef, {
        nom: item.title,
        prix: parseFloat(item.price) || 0,
        image: item.imageUrl || item.image,
        source: "AliExpress",
        url: item.productUrl || item.url,
        createdAt: new Date()
      }, { merge: true });
    });

    await batch.commit();

    res.json({ status: "ok", message: `${data.result.length} produits ajoutés ou mis à jour` });
  } catch (err) {
    console.error("Erreur update:", err);
    res.status(500).json({ error: "Erreur serveur", details: err.message });
  }
});

// 🔹 Gestion des crashs globaux
process.on('uncaughtException', err => console.error("Uncaught Exception:", err));
process.on('unhandledRejection', (reason, promise) => console.error("Unhandled Rejection:", promise, "reason:", reason));

// 🔹 Start server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
