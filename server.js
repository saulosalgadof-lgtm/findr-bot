import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

const MERCADOLIBRE_CLIENT_ID = process.env.MERCADOLIBRE_CLIENT_ID;
const MERCADOLIBRE_CLIENT_SECRET = process.env.MERCADOLIBRE_CLIENT_SECRET;
const MERCADOLIBRE_REDIRECT_URI = process.env.MERCADOLIBRE_REDIRECT_URI;

// =====================================================
// INICIO
// =====================================================

app.get("/", async (req, res) => {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: {
        apikey: SUPABASE_SECRET_KEY,
        Authorization: `Bearer ${SUPABASE_SECRET_KEY}`
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

// =====================================================
// OAUTH MERCADO LIBRE
// =====================================================

app.get("/oauth/callback", async (req, res) => {
  const { code, error, error_description } = req.query;

  // ---------------------------------------------------
  // 1. Revisar errores de OAuth
  // ---------------------------------------------------

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
    // -------------------------------------------------
    // 2. Intercambiar código OAuth por tokens
    // -------------------------------------------------

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
          client_id: MERCADOLIBRE_CLIENT_ID,
          client_secret: MERCADOLIBRE_CLIENT_SECRET,
          code: code,
          redirect_uri: MERCADOLIBRE_REDIRECT_URI
        })
      }
    );

    const tokenData = await tokenResponse.json();

    // -------------------------------------------------
    // 3. Revisar respuesta de Mercado Libre
    // -------------------------------------------------

    if (!tokenResponse.ok) {
      console.error("Mercado Libre OAuth error:", tokenData);

      return res.status(400).send(`
        <h1>Error conectando Mercado Libre ❌</h1>
        <pre>${JSON.stringify(tokenData, null, 2)}</pre>
      `);
    }

    const userId = tokenData.user_id;
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;

    // -------------------------------------------------
    // 4. Calcular expiración del Access Token
    // -------------------------------------------------

    const expiresAt = new Date(
      Date.now() + tokenData.expires_in * 1000
    ).toISOString();

    // -------------------------------------------------
    // 5. Obtener información del usuario
    // -------------------------------------------------

    const userResponse = await fetch(
      `https://api.mercadolibre.com/users/${userId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    if (!userResponse.ok) {
      throw new Error(
        `No se pudo obtener el usuario de Mercado Libre: ${userResponse.status}`
      );
    }

    const userData = await userResponse.json();

    const nickname = userData.nickname || null;

    console.log("Mercado Libre conectado.");
    console.log("User ID:", userId);
    console.log("Nickname:", nickname);

    // -------------------------------------------------
    // 6. Guardar cuenta en Supabase
    // -------------------------------------------------

    const supabaseResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/mercadolibre_accounts?on_conflict=user_id`,
      {
        method: "POST",

        headers: {
          apikey: SUPABASE_SECRET_KEY,
          Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal"
        },

        body: JSON.stringify({
          user_id: userId,
          nickname: nickname,
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_at: expiresAt
        })
      }
    );

    // -------------------------------------------------
    // 7. Revisar respuesta de Supabase
    // -------------------------------------------------

    if (!supabaseResponse.ok) {
      const errorText = await supabaseResponse.text();

      console.error("Supabase error:", errorText);

      throw new Error(
        `No se pudo guardar la cuenta en Supabase: ${supabaseResponse.status}`
      );
    }

    // -------------------------------------------------
    // 8. Confirmación
    // -------------------------------------------------

    console.log(
      `Mercado Libre conectado y guardado. User ID: ${userId}`
    );

    res.send(`
      <h1>¡Mercado Libre conectado! ✅</h1>

      <p><strong>Cuenta:</strong> ${
        nickname || "Sin nickname"
      }</p>

      <p>FINDR guardó correctamente la conexión en Supabase.</p>

      <p>Puedes cerrar esta ventana.</p>
    `);

  } catch (error) {

    // -------------------------------------------------
    // ERROR GENERAL
    // -------------------------------------------------

    console.error("OAuth error:", error);

    res.status(500).send(`
      <h1>Error interno de FINDR ❌</h1>
      <p>No se pudo completar la conexión con Mercado Libre.</p>
    `);
  }
});

// =====================================================
// SERVIDOR
// =====================================================

app.listen(PORT, () => {
  console.log(
    `Findr Bot escuchando en el puerto ${PORT}`
  );
});
