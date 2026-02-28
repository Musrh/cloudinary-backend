// server.js
import express from "express";
import cors from "cors";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const app = express();
app.use(cors());
app.use(express.json());

// 🔹 Endpoint pour générer signature Cloudinary (upload signé)
app.get("/api/cloudinary-signature", (req, res) => {
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = cloudinary.utils.api_sign_request(
      { timestamp },
      process.env.CLOUDINARY_API_SECRET
    );
    res.json({
      signature,
      timestamp,
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur lors de la génération de signature" });
  }
});

// 🔹 Test simple pour vérifier que le serveur tourne
app.get("/", (req, res) => {
  res.send("Server Cloudinary signé OK ✅");
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server Cloudinary signé sur port ${PORT}`);
});
