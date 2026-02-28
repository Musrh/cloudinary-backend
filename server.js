import express from "express";
import cors from "cors";
import cloudinary from "cloudinary";

const app = express();
app.use(cors());
app.use(express.json());

// 🔹 Config Cloudinary (mettre tes vrais credentials dans variables d'environnement)
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// 🔹 Route pour signature
app.get("/signature", (req, res) => {
  const timestamp = Math.round(new Date().getTime() / 1000);
  const signature = cloudinary.v2.utils.api_sign_request({ timestamp }, process.env.CLOUDINARY_API_SECRET);
  res.json({
    signature,
    timestamp,
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server Cloudinary signé sur port ${PORT}`));
