import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(express.json());


// =====================================================
// CONFIGURACIÓN
// =====================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

const MERCADOLIBRE_CLIENT_ID =
  process.env.MERCADOLIBRE_CLIENT_ID;

const MERCADOLIBRE_CLIENT_SECRET =
  process.env.MERCADOLIBRE_CLIENT_SECRET;

const MERCADOLIBRE_REDIRECT_URI =
  process.env.MERCADOLIBRE_REDIRECT_URI;


// =====================================================
// VALIDACIÓN DE VARIABLES
// =====================================================

console.log("======================================");
console.log("FINDR BOT - INICIANDO");
console.log("======================================");

console.log(
  "SUPABASE_URL:",
  SUPABASE_URL ? "OK" : "FALTA"
);

console.log(
  "SUPABASE_SECRET_KEY:",
  SUPABASE_SECRET_KEY ? "OK" : "FALTA"
);

console.log(
  "MERCADOLIBRE_CLIENT_ID:",
  MERCADOLIBRE_CLIENT_ID ? "OK" : "FALTA"
);

console.log(
  "MERCADOLIBRE_CLIENT_SECRET:",
  MERCADOLIBRE_CLIENT_SECRET ? "OK" : "FALTA"
);

console.log(
  "MERCADOLIBRE_REDIRECT_URI:",
  MERCADOLIBRE_REDIRECT_URI ? "OK" : "FALTA"
);

console.log("======================================");


// =====================================================
// FUNCIONES SUPABASE
// =====================================================

async function supabaseRequest(endpoint, options = {}) {

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${endpoint}`,
    {
      ...options,

      headers: {
        apikey: SUPABASE_SECRET_KEY,

        Authorization:
          `Bearer ${SUPABASE_SECRET_KEY}`,

        "Content-Type":
          "application/json",

        ...(options.headers || {})
      }
    }
  );

  const text =
    await response.text();

  let data;

  try {
    data = text
      ? JSON.parse(text)
      : null;
  } catch {
    data = text;
  }

  if (!response.ok) {

    throw new Error(
      `Supabase ${response.status}: ${JSON.stringify(data)}`
    );
  }

  return data;
}


// =====================================================
// GUARDAR CUENTA MERCADO LIBRE
// =====================================================

async function saveMercadoLibreAccount(tokenData) {

  const userId =
    tokenData.user_id;

  if (!userId) {

    throw new Error(
      "Mercado Libre no devolvió user_id."
    );
  }

  // -----------------------------------------
  // Buscar cuenta existente
  // -----------------------------------------

  const existing =
    await supabaseRequest(
      `mercadolibre_accounts?user_id=eq.${userId}&select=*`
    );

  const currentAccount =
    Array.isArray(existing) &&
    existing.length > 0
      ? existing[0]
      : null;


  // -----------------------------------------
  // Calcular expiración
  // -----------------------------------------

  const expiresAt =
    new Date(
      Date.now() +
      (tokenData.expires_in || 0) * 1000
    ).toISOString();


  // -----------------------------------------
  // Preparar datos
  // -----------------------------------------

  const accountData = {

    user_id:
      userId,

    nickname:
      tokenData.nickname ||
      currentAccount?.nickname ||
      null,

    access_token:
      tokenData.access_token,

    refresh_token:
      tokenData.refresh_token ||
      currentAccount?.refresh_token ||
      null,

    expires_at:
      expiresAt
  };


  // -----------------------------------------
  // Actualizar cuenta existente
  // -----------------------------------------

  if (currentAccount) {

    await supabaseRequest(
      `mercadolibre_accounts?user_id=eq.${userId}`,
      {
        method: "PATCH",

        headers: {
          Prefer:
            "return=minimal"
        },

        body:
          JSON.stringify(accountData)
      }
    );

    console.log(
      "Cuenta Mercado Libre actualizada:",
      userId
    );

    return;
  }


  // -----------------------------------------
  // Crear nueva cuenta
  // -----------------------------------------

  await supabaseRequest(
    "mercadolibre_accounts",
    {
      method: "POST",

      headers: {
        Prefer:
          "return=minimal"
      },

      body:
        JSON.stringify(accountData)
    }
  );

  console.log(
    "Nueva cuenta Mercado Libre guardada:",
    userId
  );
}


// =====================================================
// OBTENER CUENTA MERCADO LIBRE
// =====================================================

async function getMercadoLibreAccount() {

  const accounts =
    await supabaseRequest(
      "mercadolibre_accounts?select=*&order=created_at.asc&limit=1"
    );

  if (
    !accounts ||
    accounts.length === 0
  ) {

    throw new Error(
      "No existe ninguna cuenta de Mercado Libre conectada."
    );
  }

  return accounts[0];
}


// =====================================================
// REFRESH TOKEN MERCADO LIBRE
// =====================================================

async function refreshMercadoLibreToken(account) {

  if (!account.refresh_token) {

    throw new Error(
      "La cuenta no tiene refresh_token. Hay que volver a autorizar Mercado Libre."
    );
  }

  console.log(
    "Refrescando Access Token de Mercado Libre..."
  );


  const response =
    await fetch(
      "https://api.mercadolibre.com/oauth/token",
      {
        method: "POST",

        headers: {

          accept:
            "application/json",

          "content-type":
            "application/x-www-form-urlencoded"
        },

        body:
          new URLSearchParams({

            grant_type:
              "refresh_token",

            client_id:
              MERCADOLIBRE_CLIENT_ID,

            client_secret:
              MERCADOLIBRE_CLIENT_SECRET,

            refresh_token:
              account.refresh_token
          })
      }
    );


  const tokenData =
    await response.json();


  if (!response.ok) {

    console.error(
      "Error refrescando Mercado Libre:",
      tokenData
    );

    throw new Error(
      `No se pudo refrescar el token: ${JSON.stringify(tokenData)}`
    );
  }


  await saveMercadoLibreAccount({

    ...tokenData,

    user_id:
      account.user_id,

    nickname:
      account.nickname
  });


  console.log(
    "Access Token actualizado correctamente."
  );


  return {

    ...account,

    access_token:
      tokenData.access_token,

    refresh_token:
      tokenData.refresh_token ||
      account.refresh_token,

    expires_at:
      new Date(
        Date.now() +
        (tokenData.expires_in || 0) * 1000
      ).toISOString()
  };
}


// =====================================================
// OBTENER CUENTA CON TOKEN VÁLIDO
// =====================================================

async function getValidMercadoLibreAccount() {

  let account =
    await getMercadoLibreAccount();


  const expiresAt =
    account.expires_at
      ? new Date(
          account.expires_at
        ).getTime()
      : 0;


  const now =
    Date.now();


  // -----------------------------------------
  // Renovar si está expirado o próximo a expirar
  // -----------------------------------------

  if (
    !expiresAt ||
    expiresAt - now <
      60 * 1000
  ) {

    account =
      await refreshMercadoLibreToken(
        account
      );
  }


  return account;
}


// =====================================================
// CLIENTE API MERCADO LIBRE
// =====================================================

async function mercadoLibreRequest(endpoint) {

  let account =
    await getValidMercadoLibreAccount();


  console.log(
    "Consultando Mercado Libre:",
    endpoint
  );


  let response =
    await fetch(
      `https://api.mercadolibre.com${endpoint}`,
      {
        headers: {

          Authorization:
            `Bearer ${account.access_token}`,

          accept:
            "application/json"
        }
      }
    );


  let data =
    await response.json();


  // -----------------------------------------
  // Access Token inválido
  // -----------------------------------------

  if (
    response.status === 401 ||
    data?.message ===
      "invalid access token"
  ) {

    console.log(
      "Access Token inválido. Intentando refresh..."
    );


    account =
      await refreshMercadoLibreToken(
        account
      );


    response =
      await fetch(
        `https://api.mercadolibre.com${endpoint}`,
        {
          headers: {

            Authorization:
              `Bearer ${account.access_token}`,

            accept:
              "application/json"
          }
        }
      );


    data =
      await response.json();
  }


  if (!response.ok) {

    throw new Error(
      `Mercado Libre ${response.status}: ${JSON.stringify(data)}`
    );
  }


  return data;
}


// =====================================================
// HOME
// =====================================================

app.get("/", async (req, res) => {

  try {

    const account =
      await getMercadoLibreAccount();


    res.send(`

      <h1>
        Findr Bot activo 🚀
      </h1>

      <p>
        Mercado Libre: conectado ✅
      </p>

      <p>
        Supabase: conectado ✅
      </p>

      <p>
        Usuario ML:
        ${account.user_id}
      </p>

      <p>
        Nickname:
        ${account.nickname || "No disponible"}
      </p>

      <hr>

      <p>
        <a href="/auth/mercadolibre">
          Conectar Mercado Libre
        </a>
      </p>

      <p>
        <a href="/test-ml">
          Probar Mercado Libre
        </a>
      </p>

      <p>
        <a href="/test-supabase">
          Probar Supabase
        </a>
      </p>

      <p>
        <a href="/search-ml?q=iphone">
          Probar búsqueda
        </a>
      </p>

    `);

  } catch (error) {

    console.error(error);


    res.send(`

      <h1>
        Findr Bot activo 🚀
      </h1>

      <p>
        Supabase: conectado ✅
      </p>

      <p>
        Mercado Libre: no conectado ⚠️
      </p>

      <p>
        ${error.message}
      </p>

      <p>
        <a href="/auth/mercadolibre">
          Conectar Mercado Libre
        </a>
      </p>

    `);
  }
});


// =====================================================
// INICIAR OAUTH MERCADO LIBRE
// =====================================================

app.get(
  "/auth/mercadolibre",
  (req, res) => {

    const authorizationUrl =
      "https://auth.mercadolibre.com.mx/authorization" +

      `?response_type=code` +

      `&client_id=${encodeURIComponent(
        MERCADOLIBRE_CLIENT_ID
      )}` +

      `&redirect_uri=${encodeURIComponent(
        MERCADOLIBRE_REDIRECT_URI
      )}`;


    console.log(
      "Redirigiendo a Mercado Libre..."
    );


    res.redirect(
      authorizationUrl
    );
  }
);


// =====================================================
// OAUTH CALLBACK
// =====================================================

app.get(
  "/oauth/callback",
  async (req, res) => {

    const {
      code,
      error,
      error_description
    } = req.query;


    // -----------------------------------------
    // Error OAuth
    // -----------------------------------------

    if (error) {

      return res.status(400).send(`

        <h1>
          Error de Mercado Libre ❌
        </h1>

        <p>
          ${error}
        </p>

        <p>
          ${error_description || ""}
        </p>

      `);
    }


    if (!code) {

      return res.status(400).send(
        "No se recibió código OAuth."
      );
    }


    try {

      console.log(
        "Código OAuth recibido."
      );


      // ---------------------------------------
      // Intercambiar code por tokens
      // ---------------------------------------

      const tokenResponse =
        await fetch(
          "https://api.mercadolibre.com/oauth/token",
          {

            method:
              "POST",

            headers: {

              accept:
                "application/json",

              "content-type":
                "application/x-www-form-urlencoded"
            },

            body:
              new URLSearchParams({

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


      // ---------------------------------------
      // Validar respuesta
      // ---------------------------------------

      if (!tokenResponse.ok) {

        console.error(
          "Mercado Libre OAuth error:",
          tokenData
        );


        return res.status(400).send(`

          <h1>
            Error conectando Mercado Libre ❌
          </h1>

          <pre>
${JSON.stringify(
  tokenData,
  null,
  2
)}
          </pre>

        `);
      }


      // ---------------------------------------
      // Guardar cuenta
      // ---------------------------------------

      await saveMercadoLibreAccount(
        tokenData
      );


      console.log(
        "Mercado Libre conectado correctamente."
      );


      console.log(
        "User ID:",
        tokenData.user_id
      );


      // ---------------------------------------
      // Respuesta
      // ---------------------------------------

      res.send(`

        <h1>
          ¡Mercado Libre conectado! ✅
        </h1>

        <p>
          FINDR recibió correctamente
          los tokens.
        </p>

        <p>
          User ID:
          <strong>
            ${tokenData.user_id}
          </strong>
        </p>

        <p>
          La conexión fue guardada
          en Supabase.
        </p>

        <p>
          Puedes cerrar esta ventana.
        </p>

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
          ${error.message}
        </p>

      `);
    }
  }
);


// =====================================================
// NOTIFICACIONES DE MERCADO LIBRE
// =====================================================

app.post(
  "/notifications",
  (req, res) => {

    console.log(
      "📩 Notificación de Mercado Libre:"
    );


    console.log(
      JSON.stringify(
        req.body,
        null,
        2
      )
    );


    // Mercado Libre espera una respuesta rápida
    res.sendStatus(200);
  }
);


// =====================================================
// PRUEBA DEL ENDPOINT DE NOTIFICACIONES
// =====================================================

app.get(
  "/notifications-test",
  (req, res) => {

    res.json({

      success:
        true,

      message:
        "Endpoint de notificaciones activo",

      endpoint:
        "/notifications",

      method:
        "POST"
    });
  }
);


// =====================================================
// TEST MERCADO LIBRE
// =====================================================

app.get(
  "/test-ml",
  async (req, res) => {

    try {

      const account =
        await getValidMercadoLibreAccount();


      const userData =
        await mercadoLibreRequest(
          `/users/${account.user_id}`
        );


      res.send(`

        <h1>
          Mercado Libre funcionando 🚀
        </h1>

        <p>
          Conexión: ✅
        </p>

        <p>
          User ID:
          <strong>
            ${userData.id}
          </strong>
        </p>

        <p>
          Nickname:
          <strong>
            ${userData.nickname || "N/A"}
          </strong>
        </p>

        <p>
          País:
          <strong>
            ${userData.country_id || "N/A"}
          </strong>
        </p>

        <p>
          Access Token válido: ✅
        </p>

        <p>
          Mercado Libre API respondió: ✅
        </p>

      `);

    } catch (error) {

      console.error(
        "Test Mercado Libre error:",
        error
      );


      res.status(500).send(`

        <h1>
          Error de Mercado Libre ❌
        </h1>

        <pre>
${error.message}
        </pre>

      `);
    }
  }
);


// =====================================================
// BÚSQUEDA MERCADO LIBRE
// =====================================================

app.get(
  "/search-ml",
  async (req, res) => {

    try {

      const query =
        req.query.q;


      if (!query) {

        return res.status(400).json({

          success:
            false,

          error:
            "Debes proporcionar una búsqueda. Ejemplo: /search-ml?q=iphone"
        });
      }


      const limit =
        Math.min(
          Number(req.query.limit) || 10,
          50
        );


      const offset =
        Number(req.query.offset) || 0;


      const params =
        new URLSearchParams({

          q:
            query,

          limit:
            String(limit),

          offset:
            String(offset)
        });


      const data =
        await mercadoLibreRequest(
          `/sites/MLM/search?${params.toString()}`
        );


      const listings =
        data.results.map(
          (item) => ({

            id:
              item.id,

            title:
              item.title,

            price:
              item.price,

            currency_id:
              item.currency_id,

            condition:
              item.condition,

            permalink:
              item.permalink,

            seller_id:
              item.seller?.id ||
              null,

            seller_nickname:
              item.seller?.nickname ||
              null,

            category_id:
              item.category_id,

            thumbnail:
              item.thumbnail,

            available_quantity:
              item.available_quantity
          })
        );


      res.json({

        success:
          true,

        query,

        total_results:
          data.paging?.total ||
          0,

        limit,

        offset,

        results:
          listings
      });

    } catch (error) {

      console.error(
        "Error buscando Mercado Libre:",
        error
      );


      res.status(500).json({

        success:
          false,

        error:
          error.message
      });
    }
  }
);


// =====================================================
// TEST BÚSQUEDA PÚBLICA
// =====================================================

app.get(
  "/test-search-public",
  async (req, res) => {

    try {

      const query =
        req.query.q ||
        "iphone";


      const params =
        new URLSearchParams({

          q:
            query,

          limit:
            "5"
        });


      console.log(
        "Probando búsqueda pública:",
        query
      );


      const response =
        await fetch(
          `https://api.mercadolibre.com/sites/MLM/search?${params.toString()}`,
          {

            headers: {

              accept:
                "application/json"
            }
          }
        );


      const data =
        await response.json();


      console.log(
        "Respuesta búsqueda pública:",
        response.status
      );


      if (!response.ok) {

        return res.status(
          response.status
        ).json({

          success:
            false,

          status:
            response.status,

          error:
            data
        });
      }


      res.json({

        success:
          true,

        query,

        total_results:
          data.paging?.total ||
          0,

        results:
          data.results?.slice(
            0,
            5
          ) ||
          []
      });

    } catch (error) {

      console.error(
        "Error búsqueda pública:",
        error
      );


      res.status(500).json({

        success:
          false,

        error:
          error.message
      });
    }
  }
);


// =====================================================
// TEST SUPABASE
// =====================================================

app.get(
  "/test-supabase",
  async (req, res) => {

    try {

      const accounts =
        await supabaseRequest(
          "mercadolibre_accounts?select=user_id,nickname,expires_at"
        );


      res.json({

        success:
          true,

        accounts
      });

    } catch (error) {

      console.error(
        "Supabase test error:",
        error
      );


      res.status(500).json({

        success:
          false,

        error:
          error.message
      });
    }
  }
);


// =====================================================
// SERVIDOR
// =====================================================

app.listen(
  PORT,
  () => {

    console.log(
      `Findr Bot escuchando en el puerto ${PORT}`
    );

  }
);
