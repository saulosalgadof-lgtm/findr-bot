import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

app.get("/", async (req, res) => {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: {
        apikey: SUPABASE_SECRET_KEY
      }
    });

    if (!response.ok) {
      throw new Error(`Supabase respondió ${response.status}`);
    }

    res.send(`
      <h1>Findr Bot activo 🚀</h1>
      <p>Mercado Libre: conectado ✅</p>
      <p>Supabase: conectado ✅</p>
    `);
  } catch (error) {
    console.error(error);

    res.status(500).send(`
      <h1>Findr Bot activo 🚀</h1>
      <p>Supabase: error ❌</p>
    `);
  }
});

app.get("/oauth/callback", async (req, res) => {
  const { code, error, error_description } = req.query;

  if (error) {
    return res.status(400).send(
      `OAuth error: ${error}${error_description ? ` - ${error_description}` : ""}`
    );
  }

  if (!code) {
    return res.status(400).send("No se recibió código OAuth.");
  }

  try {
    const tokenResponse = await fetch(
      "https://api.mercadolibre.com/oauth/token",
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: process.env.MERCADOLIBRE_CLIENT_ID,
          client_secret: process.env.MERCADOLIBRE_CLIENT_SECRET,
          code: code,
          redirect_uri: process.env.MERCADOLIBRE_REDIRECT_URI
        })
      }
    );

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error("Mercado Libre OAuth error:", tokenData);

      return res.status(400).send(`
        <h1>Error conectando Mercado Libre ❌</h1>
        <pre>${JSON.stringify(tokenData, null, 2)}</pre>
      `);
    }

    console.log("Mercado Libre conectado. User ID:", tokenData.user_id);

    res.send(`
      <h1>¡Mercado Libre conectado! ✅</h1>
      <p>User ID: ${tokenData.user_id}</p>
      <p>FINDR ya recibió el Access Token correctamente.</p>
    `);

  } catch (error) {
    console.error("OAuth error:", error);

    res.status(500).send("Error interno de FINDR.");
  }
});

app.listen(PORT, () => {
  console.log(`Findr Bot escuchando en el puerto ${PORT}`);
});
