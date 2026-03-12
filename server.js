import express from "express";
import cors from "cors";
import Stripe from "stripe";
import admin from "firebase-admin";
import paypal from "@paypal/checkout-server-sdk";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ----------------------------
// Middlewares
// ----------------------------
app.use(express.json());

// ⚠️ Autoriser uniquement ton front GitHub Pages
app.use(cors({
  origin: "https://wellshoppings.com", 
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"],
}));

// ----------------------------
// Firebase
// ----------------------------
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ----------------------------
// Stripe
// ----------------------------
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ----------------------------
// PayPal
const paypalEnv =
  process.env.PAYPAL_ENV === "live"
    ? new paypal.core.LiveEnvironment(process.env.PAYPAL_CLIENT_ID, process.env.PAYPAL_SECRET)
    : new paypal.core.SandboxEnvironment(process.env.PAYPAL_CLIENT_ID, process.env.PAYPAL_SECRET);

const paypalClient = new paypal.core.PayPalHttpClient(paypalEnv);

// ----------------------------
// ROUTES
// ----------------------------

// racine
app.get("/", (req, res) => res.send("Backend payments running ✅"));

// health check
app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));

// import produits externes
app.get("/import-products", async (req, res) => {
  try {
    const response = await axios.get("https://fakestoreapi.com/products");
    const products = response.data;

    const batch = db.batch();
    products.forEach((item) => {
      const ref = db.collection("ProductsExternes").doc(item.id.toString());
      batch.set(ref, {
        nom: item.title,
        prix: item.price,
        description: item.description,
        categorie: item.category,
        image: item.image,
        source: "FakeStoreAPI",
      });
    });

    await batch.commit();

    res.send({ status: "ok", message: products.length + " produits importés" });
  } catch (err) {
    res.status(500).send({ status: "error", message: err.message });
  }
});

// ----------------------------
// Stripe checkout session
// ----------------------------
app.post("/create-stripe-session", async (req, res) => {
  const items = req.body.items || [];
  try {
    const line_items = items.map((i) => ({
      price_data: {
        currency: "eur",
        product_data: {
          name: i.nom,
          description: i.description || "Produit WellShoppings",
          images: [i.image || "/placeholder.png"],
        },
        unit_amount: i.prix * 100,
      },
      quantity: i.quantity,
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items,
      mode: "payment",
      metadata: { items: JSON.stringify(items) },
      success_url: "https://wellshoppings.com/#/success",
      cancel_url: "https://wellshoppings.com/#/cancel",
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Stripe error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------
// PayPal order
// ----------------------------
app.post("/create-paypal-order", async (req, res) => {
  const items = req.body.items || [];
  const total = items.reduce((sum, i) => sum + i.prix * i.quantity, 0).toFixed(2);

  const request = new paypal.orders.OrdersCreateRequest();
  request.prefer("return=representation");
  request.requestBody({
    intent: "CAPTURE",
    purchase_units: [{ amount: { currency_code: "EUR", value: total } }],
  });

  try {
    const order = await paypalClient.execute(request);
    res.json({ id: order.result.id });
  } catch (err) {
    console.error("PayPal create order error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------
// PayPal capture
// ----------------------------
app.post("/capture-paypal-order", async (req, res) => {
  const { orderId, user, items } = req.body;
  try {
    const request = new paypal.orders.OrdersCaptureRequest(orderId);
    request.requestBody({});
    const capture = await paypalClient.execute(request);

    await db.collection("commandes").add({
      paypalOrderId: orderId,
      email: user.email,
      montant: capture.result.purchase_units[0].payments.captures[0].amount.value,
      devise: capture.result.purchase_units[0].payments.captures[0].amount.currency_code,
      statut: "payé",
      date: admin.firestore.FieldValue.serverTimestamp(),
      items,
    });

    res.json({ capture });
    console.log("✅ Commande PayPal enregistrée dans Firestore");
  } catch (err) {
    console.error("Capture PayPal error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------
// Start server
app.listen(PORT, () => console.log(`🚀 Backend payments running on port ${PORT}`));
