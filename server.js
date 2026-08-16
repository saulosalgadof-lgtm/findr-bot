import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

const MERCADOLIBRE_CLIENT_ID = process.env.MERCADOLIBRE_CLIENT_ID;
const MERCADOLIBRE_CLIENT_SECRET = process.env.MERCADOLIBRE_CLIENT_SECRET;
const MERCADOLIBRE_REDIRECT_URI = process.env.MERCADOLIBRE_REDIRECT_URI;


// ==========================================
// HOME
// ==========================================

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


// ==========================================
// MERCADO LIBRE OAUTH CALLBACK
// ==========================================

app.get("/oauth/callback", async (req, res) => {

  const { code, error, error_description } = req.query;

  // ------------------------------------------
  // 1. Revisar errores de OAuth
  // ------------------------------------------

  if (error) {
    return res.status(400).send(
      `OAuth error: ${error}${error_description ? ` - ${error_description}` : ""}`
    );
  }

  if (!code) {
    return res.status(400).send("No se recibió código OAuth.");
  }


  try {

    // ------------------------------------------
    // 2. Intercambiar CODE por TOKENS
    // ------------------------------------------

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

    if (!tokenResponse.ok) {

      console.error("Mercado Libre OAuth error:", tokenData);

      return res.status(400).send(`
        <h1>Error conectando Mercado Libre ❌</h1>
        <pre>${JSON.stringify(tokenData, null, 2)}</pre>
      `);
    }


    // ------------------------------------------
    // 3. Extraer información de los tokens
    // ------------------------------------------

    const {
      access_token,
      refresh_token,
      expires_in,
      user_id
    } = tokenData;


    if (!access_token || !refresh_token || !user_id) {
      throw new Error(
        "Mercado Libre no devolvió los datos necesarios."
      );
    }


    // ------------------------------------------
    // 4. Obtener información del usuario
    // ------------------------------------------

    const userResponse = await fetch(
      `https://api.mercadolibre.com/users/${user_id}`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`
        }
      }
    );

    const userData = await userResponse.json();

    if (!userResponse.ok) {

      console.error("Mercado Libre user error:", userData);

      throw new Error(
        "No se pudo obtener la información del usuario de Mercado Libre."
      );
    }

    const nickname = userData.nickname || null;


    // ------------------------------------------
    // 5. Calcular expiración del Access Token
    // ------------------------------------------

    const expiresAt = new Date(
      Date.now() + (expires_in * 1000)
    ).toISOString();


    // ------------------------------------------
    // 6. Revisar si la cuenta ya existe
    // ------------------------------------------

    const existingResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/mercadolibre_accounts?user_id=eq.${user_id}&select=id`,
      {
        headers: {
          apikey: SUPABASE_SECRET_KEY,
          Authorization: `Bearer ${SUPABASE_SECRET_KEY}`
        }
      }
    );

    if (!existingResponse.ok) {
      throw new Error(
        `Error consultando Supabase: ${existingResponse.status}`
      );
    }

    const existingAccounts = await existingResponse.json();


    // ------------------------------------------
    // 7. Guardar o actualizar la cuenta
    // ------------------------------------------

    const accountData = {
      user_id: user_id,
      nickname: nickname,
      access_token: access_token,
      refresh_token: refresh_token,
      expires_at: expiresAt
    };


    if (existingAccounts.length > 0) {

      // La cuenta ya existe → actualizarla

      const accountId = existingAccounts[0].id;

      const updateResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/mercadolibre_accounts?id=eq.${accountId}`,
        {
          method: "PATCH",

          headers: {
            apikey: SUPABASE_SECRET_KEY,
            Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal"
          },

          body: JSON.stringify(accountData)
        }
      );

      if (!updateResponse.ok) {
        const errorData = await updateResponse.text();

        throw new Error(
          `Error actualizando Supabase: ${errorData}`
        );
      }

      console.log(
        `Cuenta Mercado Libre actualizada: ${user_id}`
      );

    } else {

      // No existe → crearla

      const insertResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/mercadolibre_accounts`,
        {
          method: "POST",

          headers: {
            apikey: SUPABASE_SECRET_KEY,
            Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal"
          },

          body: JSON.stringify(accountData)
        }
      );

      if (!insertResponse.ok) {
        const errorData = await insertResponse.text();

        throw new Error(
          `Error guardando en Supabase: ${errorData}`
        );
      }

      console.log(
        `Nueva cuenta Mercado Libre guardada: ${user_id}`
      );
    }


    // ------------------------------------------
    // 8. Respuesta final
    // ------------------------------------------

    res.send(`
      <h1>¡Mercado Libre conectado! ✅</h1>

      <p>FINDR ya tiene acceso autorizado.</p>

      <p>
        <strong>User ID:</strong> ${user_id}
      </p>

      <p>
        <strong>Nickname:</strong> ${nickname || "No disponible"}
      </p>

      <p>
        <strong>Cuenta guardada en FINDR:</strong> ✅
      </p>
    `);


  } catch (error) {

    console.error("OAuth error:", error);

    res.status(500).send(`
      <h1>Error interno de FINDR ❌</h1>
      <p>${error.message}</p>
    `);
  }
});


// ==========================================
// SERVER
// ==========================================

app.listen(PORT, () => {
  console.log(
    `Findr Bot escuchando en el puerto ${PORT}`
  );
});
