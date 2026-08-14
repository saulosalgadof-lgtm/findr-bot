import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

const CLIENT_ID = process.env.MERCADOLIBRE_CLIENT_ID;
const CLIENT_SECRET = process.env.MERCADOLIBRE_CLIENT_SECRET;
const REDIRECT_URI = process.env.MERCADOLIBRE_REDIRECT_URI;

let accessToken = null;
let refreshToken = null;

// Página principal
app.get("/", (req, res) => {
  res.send(`
    <h1>Findr Bot activo 🚀</h1>
    <p>Mercado Libre: ${accessToken ? "Conectado ✅" : "No conectado ❌"}</p>
    <a href="/connect">Conectar Mercado Libre</a>
  `);
});

// Iniciar autorización de Mercado Libre
app.get("/connect", (req, res) => {
  const authUrl =
    `https://auth.mercadolibre.com.mx/authorization` +
    `?response_type=code` +
    `&client_id=${encodeURIComponent(CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

  res.redirect(authUrl);
});

// Callback de Mercado Libre
app.get("/oauth/callback", async (req, res) => {
  const { code, error, error_description } = req.query;

  if (error) {
    return res.status(400).send(
      `OAuth error: ${error}${
        error_description ? ` - ${error_description}` : ""
      }`
    );
  }

  if (!code) {
    return res.status(400).send("No se recibió código OAuth.");
  }

  try {
    const response = await fetch(
      "https://api.mercadolibre.com/oauth/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          code: code,
          redirect_uri: REDIRECT_URI,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Error obteniendo token:", data);

      return res.status(400).send(`
        <h2>Error al obtener autorización</h2>
        <pre>${JSON.stringify(data, null, 2)}</pre>
      `);
    }

    accessToken = data.access_token;
    refreshToken = data.refresh_token;

    console.log("Mercado Libre conectado correctamente.");
    console.log("User ID:", data.user_id);

    // Verificar que el token funciona
    const userResponse = await fetch(
      "https://api.mercadolibre.com/users/me",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const userData = await userResponse.json();

    console.log("Usuario Mercado Libre:", userData);

    res.send(`
      <h1>¡Mercado Libre conectado! ✅</h1>
      <p>Findr ya tiene acceso autorizado.</p>
      <p><strong>User ID:</strong> ${data.user_id}</p>
      <p><strong>Nickname:</strong> ${
        userData.nickname || "No disponible"
      }</p>
      <br>
      <a href="/">Volver a Findr</a>
    `);

  } catch (err) {
    console.error(err);
    res.status(500).send("Error interno conectando con Mercado Libre.");
  }
});

app.listen(PORT, () => {
  console.log(`Findr Bot escuchando en el puerto ${PORT}`);
});
