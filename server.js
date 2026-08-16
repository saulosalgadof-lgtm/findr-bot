import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// VARIABLES DE ENTORNO
// ==========================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

const MERCADOLIBRE_CLIENT_ID =
  process.env.MERCADOLIBRE_CLIENT_ID;

const MERCADOLIBRE_CLIENT_SECRET =
  process.env.MERCADOLIBRE_CLIENT_SECRET;

const MERCADOLIBRE_REDIRECT_URI =
  process.env.MERCADOLIBRE_REDIRECT_URI;


// ==========================================
// HOME
// ==========================================

app.get("/", async (req, res) => {

  try {

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/`,
      {
        headers: {
          apikey: SUPABASE_SECRET_KEY,
          Authorization: `Bearer ${SUPABASE_SECRET_KEY}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(
        `Supabase respondió ${response.status}`
      );
    }

    res.send(`
      <h1>Findr Bot activo 🚀</h1>

      <p>Mercado Libre: conectado ✅</p>

      <p>Supabase: conectado ✅</p>

      <br>

      <a href="/connect">
        <button>
          Conectar Mercado Libre
        </button>
      </a>
    `);

  } catch (error) {

    console.error(error);

    res.status(500).send(`
      <h1>Findr Bot activo 🚀</h1>

      <p>Supabase: error ❌</p>

      <br>

      <a href="/connect">
        Conectar Mercado Libre
      </a>
    `);
  }
});


// ==========================================
// INICIAR OAUTH MERCADO LIBRE
// ==========================================

app.get("/connect", (req, res) => {

  const authUrl =
    "https://auth.mercadolibre.com.mx/authorization" +
    `?response_type=code` +
    `&client_id=${encodeURIComponent(
      MERCADOLIBRE_CLIENT_ID
    )}` +
    `&redirect_uri=${encodeURIComponent(
      MERCADOLIBRE_REDIRECT_URI
    )}`;

  console.log("Iniciando OAuth Mercado Libre");

  res.redirect(authUrl);
});


// ==========================================
// CALLBACK OAUTH
// ==========================================

app.get("/oauth/callback", async (req, res) => {

  const {
    code,
    error,
    error_description
  } = req.query;


  // ------------------------------------------
  // ERROR OAUTH
  // ------------------------------------------

  if (error) {

    return res.status(400).send(`
      <h1>Error de Mercado Libre ❌</h1>

      <p>
        ${error}
      </p>

      ${
        error_description
          ? `<p>${error_description}</p>`
          : ""
      }
    `);
  }


  if (!code) {

    return res.status(400).send(
      "No se recibió código OAuth."
    );
  }


  try {

    // ----------------------------------------
    // 1. INTERCAMBIAR CODE POR TOKENS
    // ----------------------------------------

    const tokenResponse = await fetch(
      "https://api.mercadolibre.com/oauth/token",
      {
        method: "POST",

        headers: {
          accept: "application/json",
          "content-type":
            "application/x-www-form-urlencoded"
        },

        body: new URLSearchParams({

          grant_type:
            "authorization_code",

          client_id:
            MERCADOLIBRE_CLIENT_ID,

          client_secret:
            MERCADOLIBRE_CLIENT_SECRET,

          code:
            code,

          redirect_uri:
            MERCADOLIBRE_REDIRECT_URI
        })
      }
    );


    const tokenData =
      await tokenResponse.json();


    // ----------------------------------------
    // 2. VALIDAR RESPUESTA
    // ----------------------------------------

    if (!tokenResponse.ok) {

      console.error(
        "Mercado Libre OAuth error:",
        tokenData
      );

      return res.status(400).send(`
        <h1>Error conectando Mercado Libre ❌</h1>

        <pre>
${JSON.stringify(tokenData, null, 2)}
        </pre>
      `);
    }


    const userId =
      tokenData.user_id;

    const accessToken =
      tokenData.access_token;

    const refreshToken =
      tokenData.refresh_token;


    // ----------------------------------------
    // 3. CALCULAR EXPIRACIÓN
    // ----------------------------------------

    const expiresAt =
      new Date(
        Date.now() +
        tokenData.expires_in * 1000
      ).toISOString();


    // ----------------------------------------
    // 4. OBTENER USUARIO
    // ----------------------------------------

    const userResponse =
      await fetch(
        `https://api.mercadolibre.com/users/${userId}`,
        {
          headers: {
            Authorization:
              `Bearer ${accessToken}`
          }
        }
      );


    if (!userResponse.ok) {

      throw new Error(
        "No se pudo obtener información del usuario de Mercado Libre."
      );
    }


    const userData =
      await userResponse.json();


    const nickname =
      userData.nickname || null;


    // ----------------------------------------
    // 5. GUARDAR EN SUPABASE
    // ----------------------------------------

    const supabaseResponse =
      await fetch(
        `${SUPABASE_URL}/rest/v1/mercadolibre_accounts?on_conflict=user_id`,
        {
          method: "POST",

          headers: {

            apikey:
              SUPABASE_SECRET_KEY,

            Authorization:
              `Bearer ${SUPABASE_SECRET_KEY}`,

            "Content-Type":
              "application/json",

            Prefer:
              "resolution=merge-duplicates,return=minimal"
          },

          body: JSON.stringify({

            user_id:
              userId,

            nickname:
              nickname,

            access_token:
              accessToken,

            refresh_token:
              refreshToken,

            expires_at:
              expiresAt
          })
        }
      );


    // ----------------------------------------
    // 6. VALIDAR SUPABASE
    // ----------------------------------------

    if (!supabaseResponse.ok) {

      const errorText =
        await supabaseResponse.text();

      console.error(
        "Supabase error:",
        errorText
      );

      throw new Error(
        `No se pudo guardar la cuenta en Supabase: ${supabaseResponse.status}`
      );
    }


    console.log(
      "================================="
    );

    console.log(
      "Mercado Libre conectado"
    );

    console.log(
      "User ID:",
      userId
    );

    console.log(
      "Nickname:",
      nickname
    );

    console.log(
      "Cuenta guardada en Supabase"
    );

    console.log(
      "================================="
    );


    // ----------------------------------------
    // 7. RESPUESTA FINAL
    // ----------------------------------------

    res.send(`

      <h1>
        ¡Mercado Libre conectado! ✅
      </h1>

      <p>
        <strong>Cuenta:</strong>
        ${nickname || "Sin nickname"}
      </p>

      <p>
        FINDR guardó correctamente
        la conexión en Supabase.
      </p>

      <p>
        <strong>Estado:</strong> 🟢 Activo
      </p>

      <br>

      <a href="/">
        Volver a FINDR
      </a>

    `);

  } catch (error) {

    console.error(
      "OAuth error:",
      error
    );

    res.status(500).send(`

      <h1>
        Error interno de FINDR ❌
      </h1>

      <p>
        No se pudo completar
        la conexión con Mercado Libre.
      </p>

      <p>
        Revisa los logs de Render.
      </p>

    `);
  }
});


// ==========================================
// SERVIDOR
// ==========================================

app.listen(PORT, () => {

  console.log(
    `Findr Bot escuchando en el puerto ${PORT}`
  );

});
