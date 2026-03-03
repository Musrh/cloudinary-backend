import express from "express";
import admin from "firebase-admin";
import fetch from "node-fetch"; // npm install node-fetch@2

const app = express();
const PORT = process.env.PORT || 3000;

// 🔹 Init Firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 🔹 Root
app.get("/", (req, res) => {
  res.json({ message: "API running", timestamp: new Date().toISOString() });
});

// 🔹 Update ProductsExternes
app.get("/update-products-external", async (req, res) => {
  const keyword = req.query.keyword || "smartwatch";

  try {
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

    const data = await response.json();

    if (!data.result || !Array.isArray(data.result)) {
      return res.json({ status: "error", message: "Aucun produit reçu", data });
    }

    const batch = db.batch();

    data.result.forEach(item => {
      const docRef = db.collection("ProductsExternes").doc(item.itemId);
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

    res.json({ status: "ok", message: `${data.result.length} produits ajoutés` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// 🔹 Start server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
