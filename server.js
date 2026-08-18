import express from "express";

const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());


// =====================================================
// CONFIGURACIÓN
// =====================================================

const SUPABASE_URL =
  process.env.SUPABASE_URL;

const SUPABASE_SECRET_KEY =
  process.env.SUPABASE_SECRET_KEY;

const MERCADOLIBRE_CLIENT_ID =
  process.env.MERCADOLIBRE_CLIENT_ID;

const MERCADOLIBRE_CLIENT_SECRET =
  process.env.MERCADOLIBRE_CLIENT_SECRET;

const MERCADOLIBRE_REDIRECT_URI =
  process.env.MERCADOLIBRE_REDIRECT_URI;


// =====================================================
// INICIO
// =====================================================

console.log(
  "======================================"
);

console.log(
  "FINDR BOT - STARTING"
);

console.log(
  "======================================"
);

console.log(
  "SUPABASE_URL:",
  SUPABASE_URL ? "OK" : "MISSING"
);

console.log(
  "SUPABASE_SECRET_KEY:",
  SUPABASE_SECRET_KEY ? "OK" : "MISSING"
);

console.log(
  "MERCADOLIBRE_CLIENT_ID:",
  MERCADOLIBRE_CLIENT_ID ? "OK" : "MISSING"
);

console.log(
  "MERCADOLIBRE_CLIENT_SECRET:",
  MERCADOLIBRE_CLIENT_SECRET ? "OK" : "MISSING"
);

console.log(
  "MERCADOLIBRE_REDIRECT_URI:",
  MERCADOLIBRE_REDIRECT_URI ? "OK" : "MISSING"
);

console.log(
  "======================================"
);


// =====================================================
// SUPABASE
// =====================================================

async function supabaseRequest(
  endpoint,
  options = {}
) {

  const response =
    await fetch(
      `${SUPABASE_URL}/rest/v1/${endpoint}`,
      {

        ...options,

        headers: {

          apikey:
            SUPABASE_SECRET_KEY,

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

    data =
      text
        ? JSON.parse(text)
        : null;

  } catch {

    data =
      text;

  }

  if (!response.ok) {

    const error =
      new Error(
        `Supabase ${response.status}: ${JSON.stringify(data)}`
      );

    error.status =
      response.status;

    error.data =
      data;

    throw error;

  }

  return data;
}


// =====================================================
// MERCADO LIBRE - GUARDAR CUENTA
// =====================================================

async function saveMercadoLibreAccount(
  tokenData
) {

  if (!tokenData.user_id) {

    throw new Error(
      "Mercado Libre no devolvió user_id."
    );

  }

  if (!tokenData.access_token) {

    throw new Error(
      "Mercado Libre no devolvió access_token."
    );

  }

  const userId =
    tokenData.user_id;

  const existing =
    await supabaseRequest(
      `mercadolibre_accounts?user_id=eq.${userId}&select=*`
    );

  const currentAccount =
    Array.isArray(existing) &&
    existing.length > 0
      ? existing[0]
      : null;

  const expiresAt =
    new Date(
      Date.now() +
      (tokenData.expires_in || 0) *
      1000
    ).toISOString();

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

  if (currentAccount) {

    await supabaseRequest(
      `mercadolibre_accounts?user_id=eq.${userId}`,
      {

        method:
          "PATCH",

        headers: {

          Prefer:
            "return=minimal"

        },

        body:
          JSON.stringify(
            accountData
          )

      }
    );

    console.log(
      "Mercado Libre account updated:",
      userId
    );

    return;
  }

  await supabaseRequest(
    "mercadolibre_accounts",
    {

      method:
        "POST",

      headers: {

        Prefer:
          "return=minimal"

      },

      body:
        JSON.stringify(
          accountData
        )

    }
  );

  console.log(
    "Mercado Libre account saved:",
    userId
  );

}


// =====================================================
// MERCADO LIBRE - OBTENER CUENTA
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
// MERCADO LIBRE - REFRESH TOKEN
// =====================================================

async function refreshMercadoLibreToken(
  account
) {

  if (!account.refresh_token) {

    throw new Error(
      "La cuenta no tiene refresh_token. Hay que volver a autorizar Mercado Libre."
    );

  }

  console.log(
    "Refreshing Mercado Libre token..."
  );

  const response =
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
      "Refresh token error:",
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
        (tokenData.expires_in || 0) *
        1000
      ).toISOString()

  };

}


// =====================================================
// MERCADO LIBRE - TOKEN VÁLIDO
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

  const remaining =
    expiresAt -
    Date.now();

  if (
    !expiresAt ||
    remaining < 120000
  ) {

    account =
      await refreshMercadoLibreToken(
        account
      );

  }

  return account;
}


// =====================================================
// MERCADO LIBRE - REQUEST
// =====================================================

async function mercadoLibreRequest(
  endpoint
) {

  let account =
    await getValidMercadoLibreAccount();

  console.log(
    "ML REQUEST:",
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

  // -----------------------------------------------
  // TOKEN EXPIRADO / INVÁLIDO
  // -----------------------------------------------

  if (
    response.status === 401
  ) {

    console.log(
      "Access token invalid. Refreshing..."
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

    const error =
      new Error(
        `Mercado Libre ${response.status}: ${JSON.stringify(data)}`
      );

    error.status =
      response.status;

    error.data =
      data;

    throw error;

  }

  return data;
}


// =====================================================
// HOME
// =====================================================

app.get(
  "/",
  async (req, res) => {

    try {

      const account =
        await getMercadoLibreAccount();

      res.send(`

        <h1>FINDR Bot 🚀</h1>

        <p>
          Mercado Libre:
          <strong>Conectado ✅</strong>
        </p>

        <p>
          Supabase:
          <strong>Conectado ✅</strong>
        </p>

        <p>
          User ID:
          ${account.user_id}
        </p>

        <p>
          Nickname:
          ${account.nickname || "N/A"}
        </p>

        <hr>

        <h3>FINDR</h3>

        <p>
          <a href="/test-ml">
            Test Mercado Libre
          </a>
        </p>

        <p>
          <a href="/notifications-test">
            Test Notifications
          </a>
        </p>

        <p>
          <a href="/market-trends">
            Market Trends
          </a>
        </p>

        <p>
          <a href="/trend-intelligence?q=iphone%2011%20usado">
            Trend Intelligence
          </a>
        </p>

        <p>
          <a href="/trend-to-product?q=iphone%2011%20usado">
            Trend → Product
          </a>
        </p>

      `);

    } catch (error) {

      res.send(`

        <h1>FINDR Bot 🚀</h1>

        <p>
          Mercado Libre:
          <strong>No conectado ⚠️</strong>
        </p>

        <p>
          <a href="/auth/mercadolibre">
            Conectar Mercado Libre
          </a>
        </p>

        <p>
          Error:
          ${error.message}
        </p>

      `);

    }

  }
);


// =====================================================
// OAUTH - INICIO
// =====================================================

app.get(
  "/auth/mercadolibre",
  (req, res) => {

    const authorizationUrl =
      "https://auth.mercadolibre.com.mx/authorization" +

      "?response_type=code" +

      `&client_id=${encodeURIComponent(
        MERCADOLIBRE_CLIENT_ID
      )}` +

      `&redirect_uri=${encodeURIComponent(
        MERCADOLIBRE_REDIRECT_URI
      )}`;

    res.redirect(
      authorizationUrl
    );

  }
);


// =====================================================
// OAUTH - CALLBACK
// =====================================================

app.get(
  "/oauth/callback",
  async (req, res) => {

    const {
      code,
      error,
      error_description
    } = req.query;

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

      const response =
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

                code,

                redirect_uri:
                  MERCADOLIBRE_REDIRECT_URI

              })

          }
        );

      const tokenData =
        await response.json();

      if (!response.ok) {

        console.error(
          "OAuth error:",
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

      await saveMercadoLibreAccount(
        tokenData
      );

      res.send(`

        <h1>
          Mercado Libre conectado ✅
        </h1>

        <p>
          User ID:
          ${tokenData.user_id}
        </p>

        <p>
          Tokens guardados correctamente.
        </p>

        <p>
          <a href="/test-ml">
            Probar conexión
          </a>
        </p>

      `);

    } catch (error) {

      console.error(
        "OAuth callback error:",
        error
      );

      res.status(500).send(`

        <h1>
          Error interno ❌
        </h1>

        <pre>
${error.message}
        </pre>

      `);

    }

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

      const user =
        await mercadoLibreRequest(
          `/users/${account.user_id}`
        );

      res.json({

        success:
          true,

        user_id:
          user.id,

        nickname:
          user.nickname ||
          null,

        country:
          user.country_id ||
          null,

        access_token:
          "valid"

      });

    } catch (error) {

      console.error(
        "Test ML error:",
        error
      );

      res.status(
        error.status || 500
      ).json({

        success:
          false,

        error:
          error.data ||
          error.message

      });

    }

  }
);


// =====================================================
// NOTIFICACIONES
// =====================================================

app.post(
  "/notifications",
  (req, res) => {

    console.log(
      "======================================"
    );

    console.log(
      "📩 MERCADO LIBRE NOTIFICATION"
    );

    console.log(
      JSON.stringify(
        req.body,
        null,
        2
      )
    );

    console.log(
      "======================================"
    );

    // Respondemos inmediatamente
    // a Mercado Libre.

    res.sendStatus(200);

    processMercadoLibreNotification(
      req.body
    )
    .catch(
      error => {

        console.error(
          "Notification processing error:",
          error
        );

      }
    );

  }
);


// =====================================================
// PROCESAR NOTIFICACIÓN
// =====================================================

async function processMercadoLibreNotification(
  notification
) {

  if (!notification) {
    return;
  }

  const topic =
    notification.topic;

  const resource =
    notification.resource;

  const userId =
    notification.user_id;

  console.log(
    "Topic:",
    topic
  );

  console.log(
    "Resource:",
    resource
  );

  console.log(
    "User ID:",
    userId
  );

  if (
    topic !== "items"
  ) {

    console.log(
      "Topic no implementado:",
      topic
    );

    return;

  }

  if (!resource) {

    console.log(
      "Notification without resource."
    );

    return;

  }

  const item =
    await mercadoLibreRequest(
      resource
    );

  const itemData = {

    id:
      item.id,

    user_id:
      userId,

    title:
      item.title ||
      null,

    price:
      item.price ||
      null,

    currency_id:
      item.currency_id ||
      null,

    condition:
      item.condition ||
      null,

    status:
      item.status ||
      null,

    category_id:
      item.category_id ||
      null,

    permalink:
      item.permalink ||
      null,

    thumbnail:
      item.thumbnail ||
      null,

    available_quantity:
      item.available_quantity ||
      0,

    sold_quantity:
      item.sold_quantity ||
      0,

    raw_data:
      item,

    updated_at:
      new Date().toISOString()

  };

  await supabaseRequest(
    "ml_items?on_conflict=id",
    {

      method:
        "POST",

      headers: {

        Prefer:
          "resolution=merge-duplicates,return=minimal"

      },

      body:
        JSON.stringify(
          itemData
        )

    }
  );

  console.log(
    "Item saved:",
    item.id
  );

}


// =====================================================
// TEST NOTIFICACIONES
// =====================================================

app.get(
  "/notifications-test",
  (req, res) => {

    res.json({

      success:
        true,

      message:
        "Endpoint /notifications activo.",

      method:
        "POST"

    });

  }
);


// =====================================================
// PRODUCT SEARCH
// =====================================================

app.get(
  "/products-search",
  async (req, res) => {

    try {

      const query =
        req.query.q;

      if (!query) {

        return res.status(400).json({

          success: false,

          error:
            "Debes proporcionar q."

        });

      }

      const limit =
        Math.min(
          Number(req.query.limit) || 10,
          50
        );

      const offset =
        Math.max(
          Number(req.query.offset) || 0,
          0
        );

      const params =
        new URLSearchParams({

          status:
            "active",

          site_id:
            "MLM",

          q:
            query,

          limit:
            String(limit),

          offset:
            String(offset)

        });

      const data =
        await mercadoLibreRequest(
          `/products/search?${params.toString()}`
        );

      res.json({

        success:
          true,

        query,

        total_results:
          data.paging?.total ||
          0,

        results:
          data.results ||
          []

      });

    } catch (error) {

      console.error(
        "Product search error:",
        error
      );

      res.status(
        error.status || 500
      ).json({

        success:
          false,

        status:
          error.status ||
          null,

        error:
          error.data ||
          error.message

      });

    }

  }
);


// =====================================================
// PRODUCT DETAIL
// =====================================================

app.get(
  "/product-detail",
  async (req, res) => {

    try {

      const productId =
        req.query.product_id;

      if (!productId) {

        return res.status(400).json({

          success: false,

          error:
            "Debes proporcionar product_id."

        });

      }

      const product =
        await mercadoLibreRequest(
          `/products/${encodeURIComponent(
            productId
          )}`
        );

      res.json({

        success:
          true,

        product

      });

    } catch (error) {

      console.error(
        "Product detail error:",
        error
      );

      res.status(
        error.status || 500
      ).json({

        success:
          false,

        status:
          error.status ||
          null,

        product_id:
          req.query.product_id ||
          null,

        error:
          error.data ||
          error.message

      });

    }

  }
);


// =====================================================
// PRODUCT ITEMS / COMPETENCIA
// =====================================================

app.get(
  "/product-items",
  async (req, res) => {

    try {

      const productId =
        req.query.product_id;

      if (!productId) {

        return res.status(400).json({

          success: false,

          error:
            "Debes proporcionar product_id."

        });

      }

      const limit =
        Math.min(
          Number(req.query.limit) || 50,
          100
        );

      const offset =
        Math.max(
          Number(req.query.offset) || 0,
          0
        );

      const params =
        new URLSearchParams({

          limit:
            String(limit),

          offset:
            String(offset)

        });

      const data =
        await mercadoLibreRequest(
          `/products/${encodeURIComponent(
            productId
          )}/items?${params.toString()}`
        );

      res.json({

        success:
          true,

        product_id:
          productId,

        total_results:
          data.paging?.total ||
          0,

        results:
          data.results ||
          []

      });

    } catch (error) {

      console.error(
        "Product items error:",
        error
      );

      res.status(
        error.status || 500
      ).json({

        success:
          false,

        status:
          error.status ||
          null,

        product_id:
          req.query.product_id ||
          null,

        error:
          error.data ||
          error.message

      });

    }

  }
);


// =====================================================
// ITEM DETAIL
// =====================================================

app.get(
  "/item-detail",
  async (req, res) => {

    try {

      const itemId =
        req.query.item_id;

      if (!itemId) {

        return res.status(400).json({

          success: false,

          error:
            "Debes proporcionar item_id."

        });

      }

      const item =
        await mercadoLibreRequest(
          `/items/${encodeURIComponent(
            itemId
          )}`
        );

      res.json({

        success:
          true,

        item: {

          item_id:
            item.id,

          site_id:
            item.site_id ||
            null,

          title:
            item.title ||
            null,

          seller_id:
            item.seller_id ||
            null,

          category_id:
            item.category_id ||
            null,

          price:
            item.price ||
            null,

          base_price:
            item.base_price ||
            null,

          original_price:
            item.original_price ||
            null,

          currency_id:
            item.currency_id ||
            null,

          initial_quantity:
            item.initial_quantity ||
            0,

          available_quantity:
            item.available_quantity ||
            0,

          sold_quantity:
            item.sold_quantity ||
            0,

          condition:
            item.condition ||
            null,

          status:
            item.status ||
            null,

          catalog_product_id:
            item.catalog_product_id ||
            null,

          domain_id:
            item.domain_id ||
            null,

          listing_type_id:
            item.listing_type_id ||
            null,

          catalog_listing:
            item.catalog_listing ||
            false,

          permalink:
            item.permalink ||
            null,

          shipping:
            item.shipping ||
            null,

          tags:
            item.tags ||
            [],

          date_created:
            item.date_created ||
            null,

          last_updated:
            item.last_updated ||
            null

        }

      });

    } catch (error) {

      console.error(
        "Item detail error:",
        error
      );

      res.status(
        error.status || 500
      ).json({

        success:
          false,

        status:
          error.status ||
          null,

        item_id:
          req.query.item_id ||
          null,

        error:
          error.data ||
          error.message

      });

    }

  }
);


// =====================================================
// MARKET TRENDS
// =====================================================

app.get(
  "/market-trends",
  async (req, res) => {

    try {

      const data =
        await mercadoLibreRequest(
          "/trends/MLM"
        );

      const trends =
        Array.isArray(data)
          ? data
          : [];

      res.json({

        success:
          true,

        site_id:
          "MLM",

        total:
          trends.length,

        trends

      });

    } catch (error) {

      console.error(
        "Market trends error:",
        error
      );

      res.status(
        error.status || 500
      ).json({

        success:
          false,

        status:
          error.status ||
          null,

        error:
          error.data ||
          error.message

      });

    }

  }
);


// =====================================================
// TREND INTELLIGENCE V2
// =====================================================

function parseTrendQuery(
  rawQuery
) {

  const original =
    String(rawQuery || "")
      .trim();

  const normalized =
    original
      .toLowerCase()
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .replace(
        /[^\w\s-]/g,
        " "
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim();

  let condition =
    null;

  let productQuery =
    normalized;


  // -----------------------------------------------
  // USED
  // -----------------------------------------------

  const usedPatterns = [

    "usado",
    "usada",
    "usados",
    "usadas",
    "segunda mano",
    "segunda-mano",
    "seminuevo",
    "seminueva",
    "seminuevos",
    "seminuevas"

  ];


  for (
    const pattern
    of usedPatterns
  ) {

    if (
      productQuery.includes(
        pattern
      )
    ) {

      condition =
        "used";

      productQuery =
        productQuery.replace(
          pattern,
          " "
        );

      break;

    }

  }


  // -----------------------------------------------
  // REFURBISHED
  // -----------------------------------------------

  const refurbishedPatterns = [

    "reacondicionado",
    "reacondicionada",
    "reacondicionados",
    "reacondicionadas",
    "refurbished"

  ];


  if (!condition) {

    for (
      const pattern
      of refurbishedPatterns
    ) {

      if (
        productQuery.includes(
          pattern
        )
      ) {

        condition =
          "refurbished";

        productQuery =
          productQuery.replace(
            pattern,
            " "
          );

        break;

      }

    }

  }


  productQuery =
    productQuery
      .replace(
        /\s+/g,
        " "
      )
      .trim();


  return {

    raw_query:
      original,

    product_query:
      productQuery,

    condition,

    parser_version:
      "v2"

  };

}


// =====================================================
// TREND INTELLIGENCE TEST
// =====================================================

app.get(
  "/trend-intelligence",
  async (req, res) => {

    try {

      const query =
        req.query.q;

      if (!query) {

        return res.status(400).json({

          success: false,

          error:
            "Debes proporcionar q."

        });

      }

      const parsed =
        parseTrendQuery(
          query
        );

      res.json({

        success:
          true,

        ...parsed

      });

    } catch (error) {

      console.error(
        "Trend Intelligence error:",
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
// TREND → PRODUCT V2
// =====================================================

app.get(
  "/trend-to-product",
  async (req, res) => {

    try {

      const query =
        req.query.q;

      if (!query) {

        return res.status(400).json({

          success: false,

          error:
            "Debes proporcionar q."

        });

      }


      // -----------------------------------------------
      // 1. INTERPRETAR TENDENCIA
      // -----------------------------------------------

      const parsed =
        parseTrendQuery(
          query
        );


      console.log(
        "======================================"
      );

      console.log(
        "FINDR - TREND → PRODUCT V2"
      );

      console.log(
        "Raw query:",
        parsed.raw_query
      );

      console.log(
        "Product query:",
        parsed.product_query
      );

      console.log(
        "Condition:",
        parsed.condition
      );

      console.log(
        "======================================"
      );


      // -----------------------------------------------
      // 2. BUSCAR PRODUCTO
      // -----------------------------------------------

      const limit =
        Math.min(
          Number(req.query.limit) || 10,
          50
        );


      const params =
        new URLSearchParams({

          status:
            "active",

          site_id:
            "MLM",

          q:
            parsed.product_query,

          limit:
            String(limit)

        });


      const data =
        await mercadoLibreRequest(
          `/products/search?${params.toString()}`
        );


      const products =
        data.results ||
        [];


      // -----------------------------------------------
      // 3. NORMALIZAR
      // -----------------------------------------------

      const normalized =
        products.map(
          product => {

            const attributes = {};


            if (
              Array.isArray(
                product.attributes
              )
            ) {

              for (
                const attribute
                of product.attributes
              ) {

                attributes[
                  attribute.id
                ] =
                  attribute.value_name ||
                  null;

              }

            }


            return {

              product_id:
                product.id,

              name:
                product.name ||
                null,

              domain_id:
                product.domain_id ||
                null,

              status:
                product.status ||
                null,

              parent_id:
                product.parent_id ||
                null,

              children_ids:
                product.children_ids ||
                [],

              listing_strategy:
                product.settings?.listing_strategy ||
                null,

              brand:
                attributes.BRAND ||
                null,

              line:
                attributes.LINE ||
                null,

              model:
                attributes.MODEL ||
                null,

              memory:
                attributes.INTERNAL_MEMORY ||
                null,

              color:
                attributes.COLOR ||
                null,

              gtin:
                attributes.GTIN ||
                null,

              attributes

            };

          }
        );


      // -----------------------------------------------
      // 4. RELEVANCIA
      // -----------------------------------------------

      const queryWords =
        parsed.product_query
          .toLowerCase()
          .split(/\s+/)
          .filter(
            word =>
              word.length >= 2
          );


      const ranked =
        normalized
          .map(
            product => {

              const text =
                [

                  product.name,

                  product.brand,

                  product.line,

                  product.model,

                  product.memory,

                  product.color

                ]
                  .filter(Boolean)
                  .join(" ")
                  .toLowerCase();


              let score =
                0;


              for (
                const word
                of queryWords
              ) {

                if (
                  text.includes(word)
                ) {

                  score += 1;

                }

              }


              // Marca
              if (
                product.brand &&
                parsed.product_query
                  .toLowerCase()
                  .includes(
                    product.brand
                      .toLowerCase()
                  )
              ) {

                score += 2;

              }


              // Modelo
              if (
                product.model &&
                parsed.product_query
                  .toLowerCase()
                  .includes(
                    product.model
                      .toLowerCase()
                  )
              ) {

                score += 2;

              }


              return {

                ...product,

                relevance_score:
                  score

              };

            }
          )
          .sort(
            (a, b) =>
              b.relevance_score -
              a.relevance_score
          );


      // -----------------------------------------------
      // 5. RESPUESTA
      // -----------------------------------------------

      res.json({

        success:
          true,

        raw_query:
          parsed.raw_query,

        product_query:
          parsed.product_query,

        requested_condition:
          parsed.condition,

        search_total:
          data.paging?.total ||
          0,

        products_found:
          products.length,

        results:
          ranked

      });


    } catch (error) {

      console.error(
        "Trend → Product V2 error:",
        error
      );


      res.status(
        error.status || 500
      ).json({

        success:
          false,

        status:
          error.status ||
          null,

        error:
          error.data ||
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
      `FINDR Bot listening on port ${PORT}`
    );

  }
);
