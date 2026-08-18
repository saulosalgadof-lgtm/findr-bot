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

const SITE_ID = "MLM";


// =====================================================
// STARTUP
// =====================================================

console.log("======================================");
console.log("FINDR BOT - STARTING");
console.log("======================================");

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

console.log("SITE_ID:", SITE_ID);

console.log("======================================");


// =====================================================
// SUPABASE
// =====================================================

async function supabaseRequest(
  endpoint,
  options = {}
) {

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

    data =
      text
        ? JSON.parse(text)
        : null;

  } catch {

    data = text;

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
      (tokenData.expires_in || 0) * 1000
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
      "Mercado Libre account updated:",
      userId
    );

    return;
  }

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
        (tokenData.expires_in || 0) * 1000
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
// MERCADO LIBRE - REQUEST AUTENTICADO
// =====================================================

async function mercadoLibreRequest(
  endpoint,
  options = {}
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
        ...options,

        headers: {

          Authorization:
            `Bearer ${account.access_token}`,

          accept:
            "application/json",

          ...(options.headers || {})
        }
      }
    );

  let data;

  const text =
    await response.text();

  try {

    data =
      text
        ? JSON.parse(text)
        : null;

  } catch {

    data = text;

  }


  // -----------------------------------------------
  // TOKEN EXPIRADO
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
          ...options,

          headers: {

            Authorization:
              `Bearer ${account.access_token}`,

            accept:
              "application/json",

            ...(options.headers || {})
          }
        }
      );

    const retryText =
      await response.text();

    try {

      data =
        retryText
          ? JSON.parse(retryText)
          : null;

    } catch {

      data =
        retryText;

    }
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

        <h3>Diagnóstico</h3>

        <p>
          <a href="/ml-diagnostic">
            Diagnóstico Mercado Libre
          </a>
        </p>

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

        <p>
          <a href="/products-search?q=iphone%2011">
            Product Search
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
      )}` +

      `&scope=${encodeURIComponent(
        "offline_access read"
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
          <a href="/ml-diagnostic">
            Ejecutar diagnóstico
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

          success:
            false,

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
            SITE_ID,

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

        paging:
          data.paging ||
          null,

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

          success:
            false,

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

          success:
            false,

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

          success:
            false,

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
          `/trends/${SITE_ID}`
        );

      const trends =
        Array.isArray(data)
          ? data
          : [];

      res.json({

        success:
          true,

        site_id:
          SITE_ID,

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
    const pattern of usedPatterns
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

          success:
            false,

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
// DOMAIN DISCOVERY
// =====================================================

async function discoverDomain(
  query
) {

  const params =
    new URLSearchParams({

      q:
        query,

      limit:
        "3"

    });

  const data =
    await mercadoLibreRequest(
      `/sites/${SITE_ID}/domain_discovery/search?${params.toString()}`
    );

  const results =
    Array.isArray(data)
      ? data
      : [];

  if (
    results.length === 0
  ) {

    return null;
  }

  return {

    domain_id:
      results[0].domain_id ||
      null,

    domain_name:
      results[0].domain_name ||
      null,

    category_id:
      results[0].category_id ||
      null,

    category_name:
      results[0].category_name ||
      null,

    attributes:
      results[0].attributes ||
      [],

    alternatives:
      results

  };
}


// =====================================================
// TREND → DOMAIN → PRODUCT V3
// =====================================================

app.get(
  "/trend-to-product",
  async (req, res) => {

    try {

      const query =
        req.query.q;

      if (!query) {

        return res.status(400).json({

          success:
            false,

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
        "FINDR - TREND → DOMAIN → PRODUCT"
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
      // 2. DESCUBRIR DOMINIO
      // -----------------------------------------------

      const domain =
        await discoverDomain(
          parsed.product_query
        );

      if (!domain) {

        return res.json({

          success:
            true,

          raw_query:
            parsed.raw_query,

          product_query:
            parsed.product_query,

          requested_condition:
            parsed.condition,

          domain:
            null,

          search_total:
            0,

          products_found:
            0,

          results:
            []

        });
      }

      console.log(
        "Domain discovered:",
        domain.domain_id
      );


      // -----------------------------------------------
      // 3. PRODUCT SEARCH DENTRO DEL DOMINIO
      // -----------------------------------------------

      const limit =
        Math.min(
          Number(
            req.query.limit
          ) || 10,
          50
        );

      const params =
        new URLSearchParams({

          status:
            "active",

          site_id:
            SITE_ID,

          q:
            parsed.product_query,

          domain_id:
            domain.domain_id,

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
      // 4. NORMALIZAR PRODUCTOS
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
      // 5. RESPONSE
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

        domain: {

          domain_id:
            domain.domain_id,

          domain_name:
            domain.domain_name,

          category_id:
            domain.category_id,

          category_name:
            domain.category_name

        },

        search_total:
          data.paging?.total ||
          0,

        products_found:
          products.length,

        results:
          normalized

      });

    } catch (error) {

      console.error(
        "Trend → Domain → Product error:",
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
// MARKETPLACE SEARCH
// =====================================================
//
// NOTA:
// /sites/MLM/search está devolviendo 403 para nuestra
// aplicación. NO lo utilizamos en la arquitectura actual.
//
// La búsqueda de catálogo se hace mediante:
//
// /products/search
//
// =====================================================

app.get(
  "/marketplace-search-public",
  async (req, res) => {

    try {

      const query =
        req.query.q;

      if (!query) {

        return res.status(400).json({

          success:
            false,

          error:
            "Debes proporcionar q."

        });
      }

      const limit =
        Math.min(
          Number(
            req.query.limit
          ) || 20,
          50
        );

      const offset =
        Math.max(
          Number(
            req.query.offset
          ) || 0,
          0
        );


      const params =
        new URLSearchParams({

          status:
            "active",

          site_id:
            SITE_ID,

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

        mode:
          "catalog_product_search",

        query,

        total:
          data.paging?.total ||
          0,

        paging:
          data.paging ||
          null,

        results:
          data.results ||
          []

      });

    } catch (error) {

      console.error(
        "Marketplace search error:",
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
// DIAGNÓSTICO DE ACCESO MERCADO LIBRE
// =====================================================

app.get(
  "/ml-diagnostic",
  async (req, res) => {

    const results = {};


    // -----------------------------------------------
    // 1. USER
    // -----------------------------------------------

    try {

      const account =
        await getValidMercadoLibreAccount();

      const user =
        await mercadoLibreRequest(
          `/users/${account.user_id}`
        );

      results.user = {

        success:
          true,

        status:
          200,

        user_id:
          user.id,

        nickname:
          user.nickname,

        country:
          user.country_id ||
          null

      };

    } catch (error) {

      results.user = {

        success:
          false,

        status:
          error.status ||
          null,

        error:
          error.data ||
          error.message

      };

    }


    // -----------------------------------------------
    // 2. PRODUCT SEARCH
    // -----------------------------------------------

    try {

      const params =
        new URLSearchParams({

          status:
            "active",

          site_id:
            SITE_ID,

          q:
            "iphone 11",

          limit:
            "3"

        });

      const products =
        await mercadoLibreRequest(
          `/products/search?${params.toString()}`
        );

      results.product_search = {

        success:
          true,

        status:
          200,

        total:
          products.paging?.total ||
          0,

        results:
          products.results?.length ||
          0

      };

    } catch (error) {

      results.product_search = {

        success:
          false,

        status:
          error.status ||
          null,

        error:
          error.data ||
          error.message

      };

    }


    // -----------------------------------------------
    // 3. DOMAIN DISCOVERY
    // -----------------------------------------------

    try {

      const params =
        new URLSearchParams({

          q:
            "iphone 11",

          limit:
            "3"

        });

      const domains =
        await mercadoLibreRequest(
          `/sites/${SITE_ID}/domain_discovery/search?${params.toString()}`
        );

      results.domain_discovery = {

        success:
          true,

        status:
          200,

        results:
          Array.isArray(domains)
            ? domains.length
            : 0,

        first_domain:
          Array.isArray(domains) &&
          domains.length
            ? domains[0].domain_id
            : null

      };

    } catch (error) {

      results.domain_discovery = {

        success:
          false,

        status:
          error.status ||
          null,

        error:
          error.data ||
          error.message

      };

    }


    // -----------------------------------------------
    // 4. MARKETPLACE SEARCH
    // -----------------------------------------------
    //
    // Se conserva únicamente como diagnóstico.
    // NO forma parte de FINDR.
    //

    try {

      const params =
        new URLSearchParams({

          q:
            "iphone 11",

          limit:
            "3"

        });

      const search =
        await mercadoLibreRequest(
          `/sites/${SITE_ID}/search?${params.toString()}`
        );

      results.marketplace_search = {

        success:
          true,

        status:
          200,

        total:
          search.paging?.total ||
          0,

        results:
          search.results?.length ||
          0

      };

    } catch (error) {

      results.marketplace_search = {

        success:
          false,

        status:
          error.status ||
          null,

        error:
          error.data ||
          error.message

      };

    }


    // -----------------------------------------------
    // RESPONSE
    // -----------------------------------------------

    res.json({

      success:
        true,

      diagnostic:
        results

    });

  }
);

// =====================================================
// PRODUCT LISTINGS / COMPETENCIA
// =====================================================
//
// Obtiene las publicaciones de distintos vendedores
// asociadas a un producto de catálogo.
//
// Endpoint Mercado Libre:
// /products/{PRODUCT_ID}/items
//
// =====================================================

app.get(
  "/product-listings",
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
          Number(req.query.limit) || 20,
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

      const endpoint =
        `/products/${encodeURIComponent(
          productId
        )}/items?${params.toString()}`;

      console.log(
        "======================================"
      );

      console.log(
        "FINDR PRODUCT LISTINGS"
      );

      console.log(
        "Product ID:",
        productId
      );

      console.log(
        "Endpoint:",
        endpoint
      );

      console.log(
        "======================================"
      );

      const data =
        await mercadoLibreRequest(
          endpoint
        );

      res.json({

        success: true,

        product_id:
          productId,

        total:
          data.paging?.total ||
          0,

        limit,

        offset,

        results:
          data.results ||
          [],

        experiments:
          data.experiments ||
          null

      });

    } catch (error) {

      console.error(
        "Product listings error:",
        error
      );

      res.status(
        error.status || 500
      ).json({

        success: false,

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
// PRODUCT COMPETITION / BUY BOX
// =====================================================
//
// Obtiene el detalle de un producto de catálogo
// y extrae la publicación ganadora (buy_box_winner).
//
// Mercado Libre:
// GET /products/{PRODUCT_ID}
//
// =====================================================

app.get(
  "/product-competition",
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

      console.log(
        "======================================"
      );

      console.log(
        "FINDR PRODUCT COMPETITION"
      );

      console.log(
        "Product ID:",
        productId
      );

      console.log(
        "======================================"
      );


      // -----------------------------------------------
      // PRODUCT DETAIL
      // -----------------------------------------------

      const product =
        await mercadoLibreRequest(
          `/products/${encodeURIComponent(
            productId
          )}`
        );


      // -----------------------------------------------
      // BUY BOX
      // -----------------------------------------------

      const winner =
        product.buy_box_winner ||
        null;


      // -----------------------------------------------
      // RESPUESTA NORMALIZADA
      // -----------------------------------------------

      res.json({

        success: true,

        product: {

          product_id:
            product.id ||
            null,

          name:
            product.name ||
            null,

          family_name:
            product.family_name ||
            null,

          domain_id:
            product.domain_id ||
            null,

          status:
            product.status ||
            null,

          sold_quantity:
            product.sold_quantity ||
            0,

          permalink:
            product.permalink ||
            null

        },

        competition: {

          has_buy_box_winner:
            !!winner,

          winner:
            winner
              ? {

                  item_id:
                    winner.item_id ||
                    null,

                  seller_id:
                    winner.seller_id ||
                    null,

                  price:
                    winner.price ||
                    null,

                  currency_id:
                    winner.currency_id ||
                    null,

                  sold_quantity:
                    winner.sold_quantity ||
                    0,

                  available_quantity:
                    winner.available_quantity ||
                    0,

                  condition:
                    winner.condition ||
                    null,

                  original_price:
                    winner.original_price ||
                    null,

                  listing_type_id:
                    winner.listing_type_id ||
                    null,

                  official_store_id:
                    winner.official_store_id ||
                    null,

                  shipping:
                    winner.shipping ||
                    null,

                  seller:
                    winner.seller ||
                    null,

                  warranty:
                    winner.warranty ||
                    null

                }
              : null,

          price_range:
            product.buy_box_winner_price_range ||
            null

        },

        raw_product:
          product

      });

    } catch (error) {

      console.error(
        "Product competition error:",
        error
      );

      res.status(
        error.status || 500
      ).json({

        success: false,

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
// FINDR OPPORTUNITY ENGINE V1
// =====================================================

function clampScore(value) {
  return Math.max(
    0,
    Math.min(
      100,
      Number(value) || 0
    )
  );
}


// -----------------------------------------------------
// DEMANDA
// -----------------------------------------------------

function calculateDemandScore({
  trendRank = null,
  soldQuantity = 0,
  searchTotal = 0
}) {

  let score = 0;

  // Tendencia
  if (trendRank !== null) {

    if (trendRank <= 10) score += 50;
    else if (trendRank <= 25) score += 40;
    else if (trendRank <= 50) score += 30;
    else if (trendRank <= 100) score += 20;
    else score += 10;

  }

  // Ventas
  if (soldQuantity >= 1000) score += 50;
  else if (soldQuantity >= 500) score += 45;
  else if (soldQuantity >= 250) score += 40;
  else if (soldQuantity >= 100) score += 30;
  else if (soldQuantity >= 50) score += 20;
  else if (soldQuantity > 0) score += 10;

  return clampScore(score);
}


// -----------------------------------------------------
// COMPETENCIA
// -----------------------------------------------------

function calculateCompetitionScore({
  sellers = 0,
  buyBoxWinner = false
}) {

  let score = 100;

  if (sellers >= 100) score -= 60;
  else if (sellers >= 50) score -= 45;
  else if (sellers >= 25) score -= 30;
  else if (sellers >= 10) score -= 15;
  else if (sellers >= 5) score -= 5;

  // Si ya existe Buy Box muy consolidada
  if (buyBoxWinner) {
    score -= 10;
  }

  return clampScore(score);
}


// -----------------------------------------------------
// MARGEN
// -----------------------------------------------------

function calculateMarginScore({
  sellingPrice = 0,
  acquisitionCost = 0
}) {

  if (
    !sellingPrice ||
    !acquisitionCost ||
    acquisitionCost >= sellingPrice
  ) {
    return 0;
  }

  const margin =
    (
      (sellingPrice - acquisitionCost)
      / sellingPrice
    ) * 100;

  if (margin >= 40) return 100;
  if (margin >= 30) return 90;
  if (margin >= 25) return 80;
  if (margin >= 20) return 70;
  if (margin >= 15) return 55;
  if (margin >= 10) return 40;
  if (margin >= 5) return 20;

  return 0;
}


// -----------------------------------------------------
// PRECIO
// -----------------------------------------------------

function calculatePriceScore({
  marketPrice = 0,
  sellingPrice = 0
}) {

  if (
    !marketPrice ||
    !sellingPrice
  ) {
    return 50;
  }

  const difference =
    (
      (marketPrice - sellingPrice)
      / marketPrice
    ) * 100;

  if (difference >= 20) return 100;
  if (difference >= 15) return 90;
  if (difference >= 10) return 80;
  if (difference >= 5) return 70;
  if (difference >= 0) return 60;
  if (difference >= -5) return 45;
  if (difference >= -10) return 30;

  return 15;
}


// -----------------------------------------------------
// VENTAS
// -----------------------------------------------------

function calculateSalesScore({
  soldQuantity = 0,
  availableQuantity = 0
}) {

  const total =
    soldQuantity +
    availableQuantity;

  if (!total) return 0;

  const sellThrough =
    soldQuantity / total;

  if (sellThrough >= 0.80) return 100;
  if (sellThrough >= 0.65) return 85;
  if (sellThrough >= 0.50) return 70;
  if (sellThrough >= 0.35) return 55;
  if (sellThrough >= 0.20) return 40;

  return 20;
}


// -----------------------------------------------------
// RIESGO
// -----------------------------------------------------

function calculateRiskScore({
  condition = null,
  sellers = 0,
  catalogListing = false
}) {

  let score = 100;

  if (condition === "used") {
    score -= 10;
  }

  if (sellers >= 100) {
    score -= 25;
  }

  if (catalogListing) {
    score += 5;
  }

  return clampScore(score);
}


// -----------------------------------------------------
// FINDR SCORE
// -----------------------------------------------------

function calculateFindrScore(data) {

  const demand =
    calculateDemandScore(data);

  const competition =
    calculateCompetitionScore(data);

  const margin =
    calculateMarginScore(data);

  const price =
    calculatePriceScore(data);

  const sales =
    calculateSalesScore(data);

  const risk =
    calculateRiskScore(data);

  const score =
    (
      demand * 0.25 +
      competition * 0.20 +
      margin * 0.20 +
      price * 0.15 +
      sales * 0.10 +
      risk * 0.10
    );

  const finalScore =
    Math.round(score);

  let verdict;

  if (finalScore >= 80) {
    verdict = "STRONG_OPPORTUNITY";
  }
  else if (finalScore >= 65) {
    verdict = "OPPORTUNITY";
  }
  else if (finalScore >= 50) {
    verdict = "WATCH";
  }
  else {
    verdict = "DISCARD";
  }

  return {

    score:
      finalScore,

    verdict,

    components: {

      demand:
        Math.round(demand),

      competition:
        Math.round(competition),

      margin:
        Math.round(margin),

      price:
        Math.round(price),

      sales:
        Math.round(sales),

      risk:
        Math.round(risk)

    }

  };
}
// =====================================================
// FINDR SCORE TEST
// =====================================================

app.get(
  "/findr-score-test",
  async (req, res) => {

    try {

      const data = {

        trendRank:
          Number(req.query.trend_rank) || 20,

        soldQuantity:
          Number(req.query.sold) || 500,

        searchTotal:
          Number(req.query.search_total) || 1000,

        sellers:
          Number(req.query.sellers) || 10,

        buyBoxWinner:
          req.query.buy_box === "true",

        sellingPrice:
          Number(req.query.price) || 10000,

        acquisitionCost:
          Number(req.query.cost) || 7000,

        marketPrice:
          Number(req.query.market_price) || 10000,

        availableQuantity:
          Number(req.query.available) || 100,

        condition:
          req.query.condition || "new",

        catalogListing:
          req.query.catalog === "true"

      };


      const result =
        calculateFindrScore(data);


      res.json({

        success:
          true,

        input:
          data,

        findr:
          result

      });

    } catch (error) {

      console.error(
        "FINDR Score Test error:",
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
// FINDR - PRODUCT OPPORTUNITY V2
// =====================================================
//
// Flujo:
//
// PRODUCT_ID
//     ↓
// PRODUCT DETAIL
//     ↓
// PRODUCT LISTINGS
//     ↓
// ITEM IDS
//     ↓
// MULTIGET /items
//     ↓
// PUBLICACIONES REALES
//     ↓
// MARKET ANALYSIS
//
// =====================================================

app.get(
  "/product-opportunity",
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

      console.log(
        "======================================"
      );

      console.log(
        "FINDR - PRODUCT OPPORTUNITY V2"
      );

      console.log(
        "Product ID:",
        productId
      );

      console.log(
        "======================================"
      );


      // =================================================
      // 1. PRODUCT DETAIL
      // =================================================

      const product =
        await mercadoLibreRequest(
          `/products/${encodeURIComponent(
            productId
          )}`
        );


      // =================================================
      // 2. OBTENER REFERENCIAS DE PUBLICACIONES
      // =================================================

      const listingsData =
        await mercadoLibreRequest(
          `/products/${encodeURIComponent(
            productId
          )}/items?limit=100`
        );


      const references =
        Array.isArray(
          listingsData.results
        )
          ? listingsData.results
          : [];


      console.log(
        "Listing references:",
        references.length
      );


      // =================================================
      // 3. EXTRAER ITEM IDS
      // =================================================

      const itemIds =
        references
          .map(
            listing =>
              listing.item_id ||
              listing.id
          )
          .filter(Boolean);


      console.log(
        "Item IDs:",
        itemIds.length
      );


      // =================================================
      // SI NO HAY PUBLICACIONES
      // =================================================

      if (itemIds.length === 0) {

        return res.json({

          success: true,

          product: {

            product_id:
              product.id ||
              productId,

            name:
              product.name ||
              null,

            family_name:
              product.family_name ||
              null,

            domain_id:
              product.domain_id ||
              null,

            status:
              product.status ||
              null,

            sold_quantity:
              product.sold_quantity ||
              0,

            permalink:
              product.permalink ||
              null

          },

          market: {

            total_listings: 0,

            sellers: 0,

            new_listings: 0,

            used_listings: 0,

            official_store_listings: 0,

            average_price: null,

            minimum_price: null,

            maximum_price: null,

            total_sold_quantity: 0

          },

          listings: []

        });

      }


      // =================================================
      // 4. MULTIGET DE ITEMS
      // =================================================
      //
      // Mercado Libre permite:
      //
      // /items?ids=ITEM1,ITEM2,...
      //
      // Usamos grupos de máximo 20.
      //

      const chunks = [];

      for (
        let i = 0;
        i < itemIds.length;
        i += 20
      ) {

        chunks.push(
          itemIds.slice(
            i,
            i + 20
          )
        );

      }


      const allItems = [];


      for (
        const chunk
        of chunks
      ) {

        const params =
          new URLSearchParams({

            ids:
              chunk.join(",")

          });


        console.log(
          "Fetching items:",
          chunk.length
        );


        const itemsData =
          await mercadoLibreRequest(
            `/items?${params.toString()}`
          );


        if (
          Array.isArray(
            itemsData
          )
        ) {

          for (
            const result
            of itemsData
          ) {

            if (
              result &&
              result.code === 200 &&
              result.body
            ) {

              allItems.push(
                result.body
              );

            }

          }

        }

      }


      console.log(
        "Complete items:",
        allItems.length
      );


      // =================================================
      // 5. NORMALIZAR PUBLICACIONES
      // =================================================

      const listings =
        allItems.map(
          item => {

            return {

              item_id:
                item.id ||
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
                Number(
                  item.price
                ) || 0,

              original_price:
                Number(
                  item.original_price
                ) || null,

              currency_id:
                item.currency_id ||
                null,

              condition:
                item.condition ||
                null,

              status:
                item.status ||
                null,

              listing_type_id:
                item.listing_type_id ||
                null,

              catalog_listing:
                item.catalog_listing ||
                false,

              catalog_product_id:
                item.catalog_product_id ||
                null,

              official_store_id:
                item.official_store_id ||
                null,

              available_quantity:
                Number(
                  item.available_quantity
                ) || 0,

              sold_quantity:
                Number(
                  item.sold_quantity
                ) || 0,

              warranty:
                item.warranty ||
                null,

              shipping:
                item.shipping ||
                null,

              permalink:
                item.permalink ||
                null,

              date_created:
                item.date_created ||
                null,

              last_updated:
                item.last_updated ||
                null

            };

          }
        );


      // =================================================
      // 6. MÉTRICAS
      // =================================================

      const prices =
        listings
          .map(
            listing =>
              listing.price
          )
          .filter(
            price =>
              Number.isFinite(price) &&
              price > 0
          );


      const sellers =
        new Set(
          listings
            .map(
              listing =>
                listing.seller_id
            )
            .filter(Boolean)
        );


      const newListings =
        listings.filter(
          listing =>
            listing.condition === "new"
        );


      const usedListings =
        listings.filter(
          listing =>
            listing.condition === "used"
        );


      const officialStoreListings =
        listings.filter(
          listing =>
            !!listing.official_store_id
        );


      const totalSoldQuantity =
        listings.reduce(
          (
            total,
            listing
          ) =>
            total +
            (
              Number(
                listing.sold_quantity
              ) || 0
            ),
          0
        );


      const averagePrice =
        prices.length
          ? prices.reduce(
              (
                total,
                price
              ) =>
                total + price,
              0
            ) / prices.length
          : null;


      const minimumPrice =
        prices.length
          ? Math.min(
              ...prices
            )
          : null;


      const maximumPrice =
        prices.length
          ? Math.max(
              ...prices
            )
          : null;


      // =================================================
      // 7. PRODUCT INFORMATION
      // =================================================

      const productInfo = {

        product_id:
          product.id ||
          productId,

        name:
          product.name ||
          null,

        family_name:
          product.family_name ||
          null,

        domain_id:
          product.domain_id ||
          null,

        status:
          product.status ||
          null,

        sold_quantity:
          Number(
            product.sold_quantity
          ) || 0,

        permalink:
          product.permalink ||
          null

      };


      // =================================================
      // 8. RESPONSE
      // =================================================

      res.json({

        success: true,

        product:
          productInfo,

        market: {

          total_listings:
            listings.length,

          sellers:
            sellers.size,

          new_listings:
            newListings.length,

          used_listings:
            usedListings.length,

          official_store_listings:
            officialStoreListings.length,

          average_price:
            averagePrice,

          minimum_price:
            minimumPrice,

          maximum_price:
            maximumPrice,

          total_sold_quantity:
            totalSoldQuantity

        },

        listings

      });


    } catch (error) {

      console.error(
        "Product opportunity error:",
        error
      );


      res.status(
        error.status || 500
      ).json({

        success: false,

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
