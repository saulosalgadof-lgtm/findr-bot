import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

const CLIENT_ID = process.env.MERCADOLIBRE_CLIENT_ID;
const CLIENT_SECRET = process.env.MERCADOLIBRE_CLIENT_SECRET;
const REDIRECT_URI = process.env.MERCADOLIBRE_REDIRECT_URI;

app.get("/", (req, res) => {
  res.send(`
    <h1>Findr Bot activo 🚀</h1>
    <p>Mercado Libre: ${req.query.connected === "true" ? "Conectado ✅" : "No conectado ❌"}</p>
    <a href="/connect">Conectar Mercado Libre</a>
  `);
});

// Iniciar conexión con Mercado Libre
app.get("/connect", (req, res) => {
  const authUrl =
    `https://auth.mercadolibre.com.mx/authorization` +
    `?response_type=code` +
    `&client_id=${CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

  res.redirect(authUrl);
});

// Recibir código de Mercado Libre
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
    const response = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code: code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Error Mercado Libre:", data);
      return res.status(response.status).send(`
        <h1>Error al obtener Access Token ❌</h1>
        <pre>${JSON.stringify(data, null, 2)}</pre>
      `);
    }

    console.log("Mercado Libre conectado correctamente.");
    console.log("User ID:", data.user_id);
    console.log("Token obtenido correctamente.");

    res.send(`
      <h1>¡Mercado Libre conectado! ✅</h1>
      <p>Findr ya obtuvo autorización para acceder a tu cuenta.</p>
      <p><strong>User ID:</strong> ${data.user_id}</p>
      <p>Access Token obtenido correctamente.</p>
    `);

  } catch (error) {
    console.error("Error interno:", error);

    res.status(500).send(`
      <h1>Error interno ❌</h1>
      <p>${error.message}</p>
    `);
  }
});

app.listen(PORT, () => {
  console.log(`Findr Bot escuchando en el puerto ${PORT}`);
});
