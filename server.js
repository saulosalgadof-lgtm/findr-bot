import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

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
// INICIO
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
// SUPABASE
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

  const text = await response.text();

  let data;

  try {
    data = text ? JSON.parse(text) : null;
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

  const userId = tokenData.user_id;

  if (!userId) {
    throw new Error(
      "Mercado Libre no devolvió user_id."
    );
  }

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
      "Cuenta Mercado Libre actualizada:",
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
// REFRESH TOKEN
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
    "Refrescando Access Token..."
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
      "Error refrescando token:",
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

  if (
    !expiresAt ||
    expiresAt - now < 60 * 1000
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

async function mercadoLibreRequest(
  endpoint
) {

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

  // -----------------------------------------------
  // TOKEN INVÁLIDO
  // -----------------------------------------------

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
          <a href="/diagnostic-search">
            Diagnóstico de búsqueda
          </a>
        </p>

        <p>
          <a href="/products-search?q=iphone&limit=10">
            Buscar productos
          </a>
        </p>

        <p>
          <a href="/product-detail?product_id=MLM6055020">
            Probar detalle de producto
          </a>
        </p>

        <p>
          <a href="/product-items?product_id=MLM6055020">
            Probar publicaciones de producto
          </a>
        </p>

        <p>
          <a href="/notifications-test">
            Probar endpoint de notificaciones
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
  }
);

// =====================================================
// OAUTH - INICIAR
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

      const tokenResponse =
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

                code:
                  code,

                redirect_uri:
                  MERCADOLIBRE_REDIRECT_URI
              })
          }
        );

      const tokenData =
        await tokenResponse.json();

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

      await saveMercadoLibreAccount(
        tokenData
      );

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
// NOTIFICACIONES MERCADO LIBRE
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

    res.sendStatus(200);

    processMercadoLibreNotification(
      req.body
    ).catch(
      (error) => {

        console.error(
          "❌ Error procesando notificación:",
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

  if (topic !== "items") {

    console.log(
      `Topic "${topic}" todavía no está implementado.`
    );

    return;
  }

  if (!resource) {

    console.log(
      "La notificación no contiene resource."
    );

    return;
  }

  const item =
    await mercadoLibreRequest(
      resource
    );

  console.log(
    "✅ Item obtenido:",
    item.id
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
        JSON.stringify(itemData)
    }
  );

  console.log(
    "💾 Item guardado:",
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

      `);

    } catch (error) {

      console.error(
        "Test ML error:",
        error
      );

      res.status(
        error.status || 500
      ).send(`

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
// DIAGNÓSTICO DE BÚSQUEDA
// =====================================================

app.get(
  "/diagnostic-search",
  async (req, res) => {

    const results = {};

    // -----------------------------------------
    // SEARCH BÁSICO
    // -----------------------------------------

    try {

      const data =
        await mercadoLibreRequest(
          "/sites/MLM/search?limit=1"
        );

      results.search_basic = {

        success: true,

        status: 200,

        total:
          data.paging?.total ||
          null,

        first_item:
          data.results?.[0]?.id ||
          null

      };

    } catch (error) {

      results.search_basic = {

        success: false,

        status:
          error.status ||
          null,

        error:
          error.data ||
          error.message

      };
    }

    // -----------------------------------------
    // SEARCH POR TEXTO
    // -----------------------------------------

    try {

      const data =
        await mercadoLibreRequest(
          "/sites/MLM/search?q=iphone&limit=1"
        );

      results.search_query = {

        success: true,

        status: 200,

        total:
          data.paging?.total ||
          null,

        first_item:
          data.results?.[0]?.id ||
          null,

        first_title:
          data.results?.[0]?.title ||
          null

      };

    } catch (error) {

      results.search_query = {

        success: false,

        status:
          error.status ||
          null,

        error:
          error.data ||
          error.message

      };
    }

    // -----------------------------------------
    // PRODUCTS SEARCH
    // -----------------------------------------

    try {

      const params =
        new URLSearchParams({

          status:
            "active",

          site_id:
            "MLM",

          q:
            "iphone",

          limit:
            "1"

        });

      const data =
        await mercadoLibreRequest(
          `/products/search?${params.toString()}`
        );

      results.products_search = {

        success: true,

        status: 200,

        total:
          data.paging?.total ||
          null,

        first_product:
          data.results?.[0]?.id ||
          null,

        first_name:
          data.results?.[0]?.name ||
          null

      };

    } catch (error) {

      results.products_search = {

        success: false,

        status:
          error.status ||
          null,

        error:
          error.data ||
          error.message

      };
    }

    res.json({

      success:
        true,

      message:
        "Diagnóstico completado.",

      results

    });
  }
);

// =====================================================
// BÚSQUEDA DE PRODUCTOS DE CATÁLOGO
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
            "Debes proporcionar una búsqueda. Ejemplo: /products-search?q=iphone"

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
        "Error buscando productos:",
        error
      );

      res.status(
        error.status || 500
      ).json({

        success: false,

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
// DETALLE DE PUBLICACIÓN
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
            "Debes proporcionar item_id. Ejemplo: /item-detail?item_id=MLM123456789"

        });
      }

      console.log(
        "======================================"
      );

      console.log(
        "FINDR - DETALLE DE PUBLICACIÓN"
      );

      console.log(
        "Item ID:",
        itemId
      );

      console.log(
        "======================================"
      );

      const item =
        await mercadoLibreRequest(
          `/items/${encodeURIComponent(itemId)}`
        );

      const result = {

        item_id:
          item.id,

        site_id:
          item.site_id || null,

        title:
          item.title || null,

        seller_id:
          item.seller_id || null,

        category_id:
          item.category_id || null,

        price:
          item.price || null,

        base_price:
          item.base_price || null,

        original_price:
          item.original_price || null,

        currency_id:
          item.currency_id || null,

        initial_quantity:
          item.initial_quantity || 0,

        available_quantity:
          item.available_quantity || 0,

        sold_quantity:
          item.sold_quantity || 0,

        condition:
          item.condition || null,

        status:
          item.status || null,

        catalog_product_id:
          item.catalog_product_id || null,

        domain_id:
          item.domain_id || null,

        listing_type_id:
          item.listing_type_id || null,

        catalog_listing:
          item.catalog_listing || false,

        permalink:
          item.permalink || null,

        shipping:
          item.shipping || null,

        tags:
          item.tags || [],

        date_created:
          item.date_created || null,

        last_updated:
          item.last_updated || null

      };

      console.log(
        "Publicación encontrada:"
      );

      console.log(
        JSON.stringify(
          result,
          null,
          2
        )
      );

      res.json({

        success:
          true,

        item:
          result

      });

    } catch (error) {

      console.error(
        "Error obteniendo publicación:",
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
// DETALLE DE PRODUCTO DE CATÁLOGO
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
            "Debes proporcionar product_id. Ejemplo: /product-detail?product_id=MLM6055020"

        });
      }

      console.log(
        "======================================"
      );

      console.log(
        "DETALLE DE PRODUCTO DE CATÁLOGO"
      );

      console.log(
        "Product ID:",
        productId
      );

      console.log(
        "======================================"
      );

      const data =
        await mercadoLibreRequest(
          `/products/${encodeURIComponent(
            productId
          )}`
        );

      console.log(
        "Producto obtenido correctamente."
      );

      console.log(
        "Nombre:",
        data.name
      );

      console.log(
        "Status:",
        data.status
      );

      console.log(
        "Buy Box Winner:",
        data.buy_box_winner
          ? data.buy_box_winner.item_id
          : "NINGUNO"
      );

      res.json({

        success:
          true,

        product: {

          id:
            data.id,

          status:
            data.status,

          name:
            data.name,

          family_name:
            data.family_name ||
            null,

          domain_id:
            data.domain_id ||
            null,

          sold_quantity:
            data.sold_quantity ||
            0,

          buy_box_winner:
            data.buy_box_winner ||
            null,

          buy_box_winner_price_range:
            data.buy_box_winner_price_range ||
            null,

          parent_id:
            data.parent_id ||
            null,

          children_ids:
            data.children_ids ||
            [],

          settings:
            data.settings ||
            {},

          permalink:
            data.permalink ||
            null

        }

      });

    } catch (error) {

      console.error(
        "Error obteniendo detalle del producto:",
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
// FINDR - CATALOG HUNTER DISCOVERY
// =====================================================

app.get(
  "/catalog-hunter-discovery",
  async (req, res) => {

    try {

      const query =
        req.query.q;

      if (!query) {

        return res.status(400).json({

          success: false,

          error:
            "Debes proporcionar q. Ejemplo: /catalog-hunter-discovery?q=Apple+iPhone"

        });
      }

      // Número de productos que vamos a revisar
      const limit =
        Math.min(
          Number(req.query.limit) || 50,
          50
        );

      // Número de productos con competencia
      // que queremos encontrar antes de detenernos.
      const target =
        Math.min(
          Number(req.query.target) || 5,
          10
        );

      console.log(
        "======================================"
      );

      console.log(
        "FINDR - CATALOG HUNTER DISCOVERY"
      );

      console.log(
        "Query:",
        query
      );

      console.log(
        "Productos máximos:",
        limit
      );

      console.log(
        "Candidatos objetivo:",
        target
      );

      console.log(
        "======================================"
      );

      // =================================================
      // 1. BUSCAR PRODUCTOS
      // =================================================

      const searchParams =
        new URLSearchParams({

          status:
            "active",

          site_id:
            "MLM",

          q:
            query,

          limit:
            String(limit)

        });

      const searchData =
        await mercadoLibreRequest(
          `/products/search?${searchParams.toString()}`
        );

      const products =
        searchData.results || [];

      console.log(
        "Productos encontrados:",
        products.length
      );

      // =================================================
      // 2. ANALIZAR CADA PRODUCTO
      // =================================================

      const candidates = [];

      const analyzed = [];

      for (
        const product
        of products
      ) {

        // -----------------------------------------------
        // Detenernos cuando encontremos suficientes
        // candidatos.
        // -----------------------------------------------

        if (
          candidates.length >=
          target
        ) {

          break;
        }

        try {

          console.log(
            "--------------------------------------"
          );

          console.log(
            "Analizando producto:",
            product.id
          );

          console.log(
            "Nombre:",
            product.name
          );

          // ---------------------------------------------
          // Obtener detalle del producto
          // ---------------------------------------------

          const detail =
            await mercadoLibreRequest(
              `/products/${encodeURIComponent(
                product.id
              )}`
            );

          // ---------------------------------------------
          // Solo analizamos productos activos
          // ---------------------------------------------

          if (
            detail.status !==
            "active"
          ) {

            console.log(
              "Producto inactivo. Se descarta."
            );

            analyzed.push({

              product_id:
                detail.id,

              name:
                detail.name,

              status:
                detail.status,

              has_competition:
                false,

              reason:
                "inactive_product"

            });

            continue;
          }

          // ---------------------------------------------
          // Buscar publicaciones competidoras
          // ---------------------------------------------

          let competition = null;

          try {

            competition =
              await mercadoLibreRequest(
                `/products/${encodeURIComponent(
                  detail.id
                )}/items`
              );

          } catch (competitionError) {

            // -------------------------------------------
            // Mercado Libre devuelve 404 cuando no hay
            // publicaciones ganadoras/competidoras.
            // -------------------------------------------

            if (
              competitionError.status ===
              404
            ) {

              console.log(
                "Sin publicaciones competidoras:",
                detail.id
              );

              analyzed.push({

                product_id:
                  detail.id,

                name:
                  detail.name,

                family_name:
                  detail.family_name ||
                  null,

                domain_id:
                  detail.domain_id ||
                  null,

                status:
                  detail.status,

                sold_quantity:
                  detail.sold_quantity ||
                  0,

                has_competition:
                  false,

                reason:
                  "no_competition"

              });

              continue;
            }

            throw competitionError;
          }

          // ---------------------------------------------
          // Extraer publicaciones
          // ---------------------------------------------

          const items =
            competition?.results ||
            [];

          console.log(
            "Publicaciones encontradas:",
            items.length
          );

          // ---------------------------------------------
          // Si no hay resultados, descartar
          // ---------------------------------------------

          if (
            items.length ===
            0
          ) {

            analyzed.push({

              product_id:
                detail.id,

              name:
                detail.name,

              family_name:
                detail.family_name ||
                null,

              domain_id:
                detail.domain_id ||
                null,

              status:
                detail.status,

              sold_quantity:
                detail.sold_quantity ||
                0,

              has_competition:
                false,

              reason:
                "empty_competition"

            });

            continue;
          }

          // ---------------------------------------------
          // Normalizar publicaciones
          // ---------------------------------------------

          const competitors =
            items.map(
              (item) => ({

                item_id:
                  item.item_id ||
                  null,

                site_id:
                  item.site_id ||
                  null,

                seller_id:
                  item.seller_id ||
                  null,

                price:
                  item.price ||
                  null,

                currency_id:
                  item.currency_id ||
                  null,

                original_price:
                  item.original_price ||
                  null,

                condition:
                  item.condition ||
                  null,

                category_id:
                  item.category_id ||
                  null,

                listing_type_id:
                  item.listing_type_id ||
                  null,

                available_quantity:
                  item.available_quantity ||
                  null,

                shipping:
                  item.shipping ||
                  null,

                official_store_id:
                  item.official_store_id ||
                  null

              })
            );

          // ---------------------------------------------
          // Crear candidato
          // ---------------------------------------------

          const candidate = {

            product_id:
              detail.id,

            name:
              detail.name,

            family_name:
              detail.family_name ||
              null,

            domain_id:
              detail.domain_id ||
              null,

            status:
              detail.status,

            product_sold_quantity:
              detail.sold_quantity ||
              0,

            buy_box_winner:
              detail.buy_box_winner ||
              null,

            competitors_count:
              competitors.length,

            competitors

          };

          candidates.push(
            candidate
          );

          analyzed.push({

            product_id:
              detail.id,

            name:
              detail.name,

            domain_id:
              detail.domain_id ||
              null,

            status:
              detail.status,

            competitors_count:
              competitors.length,

            has_competition:
              true

          });

          console.log(
            "🔥 CANDIDATO ENCONTRADO:",
            detail.id
          );

        } catch (error) {

          console.error(
            "Error analizando producto:",
            product.id,
            error.message
          );

          analyzed.push({

            product_id:
              product.id,

            name:
              product.name,

            has_competition:
              false,

            reason:
              "analysis_error",

            error:
              error.message

          });
        }
      }

      // =================================================
      // 3. RESULTADO
      // =================================================

      console.log(
        "======================================"
      );

      console.log(
        "CATALOG HUNTER TERMINADO"
      );

      console.log(
        "Productos revisados:",
        analyzed.length
      );

      console.log(
        "Candidatos encontrados:",
        candidates.length
      );

      console.log(
        "======================================"
      );

      res.json({

        success:
          true,

        query,

        search_total:
          searchData.paging?.total ||
          products.length,

        products_returned:
          products.length,

        products_analyzed:
          analyzed.length,

        candidates_found:
          candidates.length,

        candidates,

        analyzed

      });

    } catch (error) {

      console.error(
        "❌ Error en Catalog Hunter:",
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
      // ------------------------------------------------
      // 1. BUSCAR PRODUCTOS
      // ------------------------------------------------

      const params =
        new URLSearchParams({

          status:
            "active",

          site_id:
            "MLM",

          q:
            query,

          limit:
            String(limit)

        });

      const searchData =
        await mercadoLibreRequest(
          `/products/search?${params.toString()}`
        );

      const products =
        searchData.results || [];

      console.log(
        "Productos encontrados:",
        products.length
      );

      // ------------------------------------------------
      // 2. ANALIZAR PRODUCTOS
      // ------------------------------------------------

      const candidates = [];

      const analyzed = [];

      for (
        const product
        of products
      ) {

        if (
          candidates.length >=
          targetCandidates
        ) {
          break;
        }

        try {

          console.log(
            "Analizando:",
            product.id,
            product.name
          );

          const detail =
            await mercadoLibreRequest(
              `/products/${encodeURIComponent(
                product.id
              )}`
            );

          const winner =
            detail.buy_box_winner ||
            null;

          const result = {

            product_id:
              detail.id,

            name:
              detail.name,

            family_name:
              detail.family_name ||
              null,

            domain_id:
              detail.domain_id ||
              null,

            status:
              detail.status,

            sold_quantity:
              detail.sold_quantity ||
              0,

            buy_box_winner:
              winner
                ? {

                    item_id:
                      winner.item_id,

                    seller_id:
                      winner.seller_id,

                    price:
                      winner.price,

                    currency_id:
                      winner.currency_id,

                    sold_quantity:
                      winner.sold_quantity,

                    available_quantity:
                      winner.available_quantity

                  }
                : null,

            has_competition:
              Boolean(winner)

          };

          analyzed.push(
            result
          );

          // ------------------------------------------
          // 3. SOLO CANDIDATOS CON COMPETENCIA
          // ------------------------------------------

          if (winner) {

            console.log(
              "🔥 COMPETENCIA ENCONTRADA:",
              detail.id
            );

            candidates.push(
              result
            );

          } else {

            console.log(
              "Sin Buy Box:",
              detail.id
            );
          }

        } catch (error) {

          console.error(
            "Error analizando producto:",
            product.id,
            error.message
          );

          analyzed.push({

            product_id:
              product.id,

            name:
              product.name,

            analysis_error:
              error.message

          });
        }
      }

      // ------------------------------------------------
      // 4. RESULTADO
      // ------------------------------------------------

      console.log(
        "======================================"
      );

      console.log(
        "ANÁLISIS TERMINADO"
      );

      console.log(
        "Productos revisados:",
        analyzed.length
      );

      console.log(
        "Candidatos con competencia:",
        candidates.length
      );

      console.log(
        "======================================"
      );

      res.json({

        success:
          true,

        query,

        search_total:
          searchData.paging?.total ||
          products.length,

        products_analyzed:
          analyzed.length,

        candidates_found:
          candidates.length,

        candidates,

        analyzed

      });

    } catch (error) {

      console.error(
        "❌ Error en Catalog Hunter:",
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
// FINDR - DISCOVERY ENGINE V2
// =====================================================

app.get(
  "/catalog-discovery-v2",
  async (req, res) => {

    try {

      const query =
        req.query.q;

      const domainId =
        req.query.domain_id ||
        "MLM-CELLPHONES";

      const limit =
        Math.min(
          Number(req.query.limit) || 20,
          50
        );

      if (!query) {

        return res.status(400).json({

          success: false,

          error:
            "Debes proporcionar q. Ejemplo: /catalog-discovery-v2?q=iPhone+13"

        });
      }

      console.log(
        "======================================"
      );

      console.log(
        "FINDR - DISCOVERY ENGINE V2"
      );

      console.log(
        "Query:",
        query
      );

      console.log(
        "Domain:",
        domainId
      );

      console.log(
        "Limit:",
        limit
      );

      console.log(
        "======================================"
      );

      // =================================================
      // 1. BÚSQUEDA DE CATÁLOGO
      // =================================================

      const params =
        new URLSearchParams({

          status:
            "active",

          site_id:
            "MLM",

          q:
            query,

          domain_id:
            domainId,

          limit:
            String(limit)

        });

      const data =
        await mercadoLibreRequest(
          `/products/search?${params.toString()}`
        );

      const products =
        data.results || [];

      // =================================================
      // 2. NORMALIZAR RESULTADOS
      // =================================================

      const results =
        products.map(
          (product) => {

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

              catalog_product_id:
                product.catalog_product_id ||
                product.id,

              name:
                product.name ||
                null,

              domain_id:
                product.domain_id ||
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

      // =================================================
      // 3. FILTRO DE RELEVANCIA
      // =================================================

      const queryWords =
        query
          .toLowerCase()
          .split(/\s+/)
          .filter(
            word =>
              word.length > 2
          );

      const ranked =
        results
          .map(
            product => {

              const text =
                `${product.name || ""} ${product.brand || ""} ${product.model || ""}`
                  .toLowerCase();

              let score = 0;

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

              // Coincidencia de marca
              if (
                query
                  .toLowerCase()
                  .includes("apple") &&
                product.brand === "Apple"
              ) {

                score += 2;
              }

              // Coincidencia de modelo
              if (
                product.model &&
                query
                  .toLowerCase()
                  .includes(
                    product.model.toLowerCase()
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

      console.log(
        "Productos devueltos:",
        results.length
      );

      console.log(
        "======================================"
      );

      console.log(
        "TOP PRODUCTOS"
      );

      console.log(
        "======================================"
      );

      ranked
        .slice(0, 10)
        .forEach(
          (product, index) => {

            console.log(
              `${index + 1}.`,
              product.product_id,
              "|",
              product.name,
              "| Score:",
              product.relevance_score
            );

          }
        );

      res.json({

        success:
          true,

        query,

        domain_id:
          domainId,

        search_total:
          data.paging?.total ||
          products.length,

        products_found:
          results.length,

        results:
          ranked

      });

    } catch (error) {

      console.error(
        "❌ Discovery V2 error:",
        error
      );

      res.status(
        error.status || 500
      ).json({

        success: false,

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
// PUBLICACIONES DE UN PRODUCTO DE CATÁLOGO
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
            "Debes proporcionar product_id. Ejemplo: /product-items?product_id=MLM63095707"

        });
      }

      console.log(
        "======================================"
      );

      console.log(
        "HUNTER - BUSCANDO PUBLICACIONES"
      );

      console.log(
        "Product ID:",
        productId
      );

      console.log(
        "======================================"
      );

      const limit =
        Math.min(
          Number(req.query.limit) || 50,
          100
        );

      const offset =
        Number(req.query.offset) || 0;

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

      const items =
        (data.results || []).map(
          (item) => ({

            item_id:
              item.item_id,

            site_id:
              item.site_id,

            seller_id:
              item.seller_id,

            price:
              item.price,

            currency_id:
              item.currency_id,

            condition:
              item.condition,

            category_id:
              item.category_id,

            listing_type_id:
              item.listing_type_id,

            official_store_id:
              item.official_store_id,

            original_price:
              item.original_price,

            warranty:
              item.warranty,

            shipping:
              item.shipping,

            tags:
              item.tags,

            deal_ids:
              item.deal_ids,

            tier:
              item.tier,

            inventory_id:
              item.inventory_id

          })
        );

      console.log(
        "Publicaciones encontradas:",
        items.length
      );

      res.json({

        success:
          true,

        product_id:
          productId,

        paging:
          data.paging ||
          null,

        total_results:
          data.paging?.total ||
          items.length,

        results:
          items

      });

    } catch (error) {

      console.error(
        "Error obteniendo publicaciones del producto:",
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
// BÚSQUEDA GENERAL - PRUEBA SIN TOKEN
// =====================================================

app.get(
  "/search-general-test",
  async (req, res) => {

    try {

      const query =
        req.query.q ||
        "iphone";

      const limit =
        Math.min(
          Number(req.query.limit) || 3,
          10
        );

      const params =
        new URLSearchParams({

          q:
            query,

          limit:
            String(limit)

        });

      console.log(
        "======================================"
      );

      console.log(
        "PRUEBA BÚSQUEDA GENERAL SIN TOKEN"
      );

      console.log(
        "Query:",
        query
      );

      console.log(
        "======================================"
      );

      const response =
        await fetch(
          `https://api.mercadolibre.com/sites/MLM/search?${params.toString()}`
        );

      const data =
        await response.json();

      console.log(
        "Status Mercado Libre:",
        response.status
      );

      console.log(
        "Respuesta:",
        JSON.stringify(
          data,
          null,
          2
        )
      );

      res.status(
        response.status
      ).json({

        success:
          response.ok,

        status:
          response.status,

        query,

        total:
          data.paging?.total ||
          null,

        results:
          data.results ||
          [],

        error:
          response.ok
            ? null
            : data

      });

    } catch (error) {

      console.error(
        "Error búsqueda general:",
        error
      );

      res.status(500).json({

        success: false,

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
// PUBLICACIONES DE UN VENDEDOR
// =====================================================

app.get(
  "/seller-items",
  async (req, res) => {

    try {

      const sellerId =
        req.query.seller_id;

      if (!sellerId) {

        return res.status(400).json({

          success: false,

          error:
            "Debes proporcionar seller_id. Ejemplo: /seller-items?seller_id=356593713"

        });
      }

      const limit =
        Math.min(
          Number(req.query.limit) || 10,
          50
        );

      const offset =
        Number(req.query.offset) || 0;

      console.log(
        "======================================"
      );

      console.log(
        "FINDR - PUBLICACIONES DE VENDEDOR"
      );

      console.log(
        "Seller ID:",
        sellerId
      );

      console.log(
        "======================================"
      );

      const params =
        new URLSearchParams({

          seller_id:
            sellerId,

          limit:
            String(limit),

          offset:
            String(offset)

        });

      const data =
        await mercadoLibreRequest(
          `/sites/MLM/search?${params.toString()}`
        );

      const items =
        data.results || [];

      console.log(
        "Publicaciones encontradas:",
        items.length
      );

      res.json({

        success:
          true,

        seller_id:
          sellerId,

        total_results:
          data.paging?.total ||
          items.length,

        results:
          items

      });

    } catch (error) {

      console.error(
        "Error obteniendo publicaciones del vendedor:",
        error
      );

      res.status(
        error.status || 500
      ).json({

        success: false,

        status:
          error.status ||
          null,

        seller_id:
          req.query.seller_id ||
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
      `Findr Bot escuchando en el puerto ${PORT}`
    );

  }
);
