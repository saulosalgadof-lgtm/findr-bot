import express from "express";

const app = express();

const PORT =
  process.env.PORT || 3000;

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
// VALIDACIÓN DE CONFIGURACIÓN
// =====================================================

console.log(
  "======================================"
);

console.log(
  "FINDR BOT - INICIANDO"
);

console.log(
  "======================================"
);

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

console.log(
  "======================================"
);


// =====================================================
// SUPABASE REQUEST
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
// GUARDAR CUENTA MERCADO LIBRE
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

    // MUY IMPORTANTE:
    // cada refresh puede generar
    // un nuevo refresh_token.
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
      "Cuenta Mercado Libre actualizada:",
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
    "Cuenta Mercado Libre guardada:",
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
    "Access Token actualizado."
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

  const remaining =
    expiresAt -
    Date.now();

  // Renovamos si quedan menos
  // de 2 minutos.

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
// REQUEST A MERCADO LIBRE
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

  // ---------------------------------------------------
  // ACCESS TOKEN INVÁLIDO
  // ---------------------------------------------------

  if (
    response.status === 401
  ) {

    console.log(
      "Token inválido. Ejecutando refresh..."
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

        <h3>Herramientas</h3>

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
          <a href="/products-search?q=Apple+iPhone+13&limit=10">
            Product Search
          </a>
        </p>

        <p>
          <a href="/catalog-discovery-v2?q=Apple+iPhone+13&limit=20">
            Discovery V2
          </a>
        </p>

        <p>
          <a href="/item-detail?item_id=MLM3222968557">
            Item Detail
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
// OAUTH - INICIAR
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

                code:
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
          user.nickname || null,

        country:
          user.country_id || null,

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
// NOTIFICACIONES MERCADO LIBRE
// =====================================================

app.post(
  "/notifications",
  (req, res) => {

    console.log(
      "======================================"
    );

    console.log(
      "📩 NOTIFICACIÓN MERCADO LIBRE"
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

    // Respondemos inmediatamente.
    res.sendStatus(200);

    processMercadoLibreNotification(
      req.body
    )
    .catch(
      (error) => {

        console.error(
          "Error procesando notificación:",
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

  // Por ahora procesamos items.
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
      "Notificación sin resource."
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

      const results =
        data.results ||
        [];

      res.json({

        success:
          true,

        product_id:
          productId,

        total_results:
          data.paging?.total ||
          results.length,

        results

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
// DISCOVERY ENGINE V2
// =====================================================

app.get(
  "/catalog-discovery-v2",
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
          Number(req.query.limit) || 20,
          50
        );

      const domainId =
        req.query.domain_id ||
        null;

      console.log(
        "======================================"
      );

      console.log(
        "FINDR DISCOVERY V2"
      );

      console.log(
        "Query:",
        query
      );

      console.log(
        "Domain:",
        domainId ||
        "sin filtro"
      );

      console.log(
        "Limit:",
        limit
      );

      console.log(
        "======================================"
      );

      // ------------------------------------------------
      // CONSTRUCCIÓN DE BÚSQUEDA
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

      // domain_id es OPCIONAL.
      // Solo lo agregamos si el usuario
      // realmente lo proporcionó.

      if (domainId) {

        params.set(
          "domain_id",
          domainId
        );

      }

      const data =
        await mercadoLibreRequest(
          `/products/search?${params.toString()}`
        );

      const products =
        data.results ||
        [];

      // ------------------------------------------------
      // NORMALIZACIÓN
      // ------------------------------------------------

      const normalized =
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

      // ------------------------------------------------
      // RELEVANCIA LOCAL
      // ------------------------------------------------

      const queryWords =
        query
          .toLowerCase()
          .split(/\s+/)
          .filter(
            word =>
              word.length >= 2
          );

      const ranked =
        normalized
          .map(
            (product) => {

              const text =
                [

                  product.name,

                  product.brand,

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

              // Coincidencia de marca

              if (
                product.brand &&
                query
                  .toLowerCase()
                  .includes(
                    product.brand.toLowerCase()
                  )
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

      // ------------------------------------------------
      // RESPUESTA
      // ------------------------------------------------

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
          products.length,

        results:
          ranked

      });

    } catch (error) {

      console.error(
        "Discovery V2 error:",
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
// FINDR - COMPETITION DISCOVERY V3
// =====================================================

app.get(
  "/catalog-find-competition",
  async (req, res) => {

    try {

      const query =
        req.query.q;

      if (!query) {

        return res.status(400).json({

          success: false,

          error:
            "Debes proporcionar q. Ejemplo: /catalog-find-competition?q=Samsung+Galaxy"

        });

      }

      const limit =
        Math.min(
          Number(req.query.limit) || 20,
          50
        );

      const target =
        Math.min(
          Number(req.query.target) || 3,
          10
        );

      console.log(
        "======================================"
      );

      console.log(
        "FINDR - COMPETITION DISCOVERY V3"
      );

      console.log(
        "Query:",
        query
      );

      console.log(
        "Products to inspect:",
        limit
      );

      console.log(
        "Target candidates:",
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
        searchData.results ||
        [];


      console.log(
        "Productos encontrados:",
        products.length
      );


      // =================================================
      // 2. ANALIZAR PRODUCTOS
      // =================================================

      const candidates = [];

      const analyzed = [];


      for (
        const product
        of products
      ) {

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
            "Analizando:",
            product.id
          );

          console.log(
            "Nombre:",
            product.name
          );


          // =============================================
          // 3. DETALLE DEL PRODUCTO
          // =============================================

          const detail =
            await mercadoLibreRequest(
              `/products/${encodeURIComponent(
                product.id
              )}`
            );


          // =============================================
          // 4. PRODUCTO INACTIVO
          // =============================================

          if (
            detail.status !==
            "active"
          ) {

            analyzed.push({

              product_id:
                detail.id,

              name:
                detail.name,

              status:
                detail.status,

              has_buy_box:
                false,

              reason:
                "inactive"

            });

            continue;

          }


          // =============================================
          // 5. ¿TIENE BUY BOX?
          // =============================================

          const winner =
            detail.buy_box_winner ||
            null;


          if (!winner) {

            console.log(
              "Sin Buy Box:",
              detail.id
            );

            analyzed.push({

              product_id:
                detail.id,

              name:
                detail.name,

              status:
                detail.status,

              has_buy_box:
                false,

              reason:
                "no_buy_box"

            });

            continue;

          }


          console.log(
            "🔥 BUY BOX ENCONTRADO"
          );

          console.log(
            "Item:",
            winner.item_id
          );

          console.log(
            "Seller:",
            winner.seller_id
          );

          console.log(
            "Precio:",
            winner.price
          );


          // =============================================
          // 6. INTENTAR OBTENER TODAS LAS PUBLICACIONES
          // =============================================

          let competition =
            null;


          try {

            competition =
              await mercadoLibreRequest(
                `/products/${encodeURIComponent(
                  detail.id
                )}/items?limit=100`
              );

          } catch (competitionError) {

            console.log(
              "No fue posible obtener listado completo:",
              competitionError.status,
              competitionError.message
            );

          }


          // =============================================
          // 7. NORMALIZAR COMPETIDORES
          // =============================================

          const rawItems =
            competition?.results ||
            [];


          const competitors =
            rawItems.map(
              (item) => ({

                item_id:
                  item.item_id ||
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

                condition:
                  item.condition ||
                  null,

                available_quantity:
                  item.available_quantity ||
                  null,

                original_price:
                  item.original_price ||
                  null,

                listing_type_id:
                  item.listing_type_id ||
                  null,

                official_store_id:
                  item.official_store_id ||
                  null,

                shipping:
                  item.shipping ||
                  null

              })
            );


          // =============================================
          // 8. GARANTIZAR QUE EL WINNER APAREZCA
          // =============================================

          const winnerAlreadyIncluded =
            competitors.some(
              item =>
                item.item_id ===
                winner.item_id
            );


          if (
            !winnerAlreadyIncluded
          ) {

            competitors.unshift({

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

              condition:
                winner.condition ||
                null,

              available_quantity:
                winner.available_quantity ||
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
                null

            });

          }


          // =============================================
          // 9. CREAR CANDIDATO
          // =============================================

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

            sold_quantity:
              detail.sold_quantity ||
              0,

            buy_box_winner:
              winner,

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

            status:
              detail.status,

            has_buy_box:
              true,

            competitors_count:
              competitors.length

          });


          console.log(
            "🔥 CANDIDATO:",
            detail.id
          );


        } catch (error) {

          console.error(
            "Error analizando:",
            product.id,
            error.message
          );


          analyzed.push({

            product_id:
              product.id,

            name:
              product.name,

            has_buy_box:
              false,

            reason:
              "analysis_error",

            error:
              error.message

          });

        }

      }


      // =================================================
      // 10. RESULTADO
      // =================================================

      res.json({

        success:
          true,

        query,

        search_total:
          searchData.paging?.total ||
          products.length,

        products_found:
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
        "❌ Competition Discovery V3 error:",
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
// FINDR - MARKETPLACE SEARCH DIAGNOSTIC
// =====================================================

app.get(
  "/marketplace-search-test",
  async (req, res) => {

    try {

      const query =
        req.query.q ||
        "iPhone 13";

      const condition =
        req.query.condition ||
        "used";

      const sort =
        req.query.sort ||
        "price_asc";

      const limit =
        Math.min(
          Number(req.query.limit) || 20,
          50
        );

      const params =
        new URLSearchParams({

          q:
            query,

          condition:
            condition,

          sort:
            sort,

          limit:
            String(limit)

        });

      const endpoint =
        `/sites/MLM/search?${params.toString()}`;

      console.log(
        "======================================"
      );

      console.log(
        "FINDR - MARKETPLACE SEARCH TEST"
      );

      console.log(
        "Endpoint:",
        endpoint
      );

      console.log(
        "======================================"
      );

      const account =
        await getValidMercadoLibreAccount();

      const response =
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

      const data =
        await response.json();

      console.log(
        "STATUS:",
        response.status
      );

      console.log(
        "RESPONSE:",
        JSON.stringify(
          data,
          null,
          2
        )
      );

      res.status(
        response.ok
          ? 200
          : response.status
      ).json({

        success:
          response.ok,

        status:
          response.status,

        endpoint,

        query,

        condition,

        sort,

        result_count:
          data.results?.length ||
          0,

        total:
          data.paging?.total ||
          0,

        available_filters:
          data.available_filters ||
          [],

        available_sorts:
          data.available_sorts ||
          [],

        results:
          response.ok
            ? data.results || []
            : [],

        error:
          response.ok
            ? null
            : data

      });

    } catch (error) {

      console.error(
        "Marketplace search diagnostic error:",
        error
      );

      res.status(500).json({

        success:
          false,

        status:
          error.status ||
          500,

        error:
          error.data ||
          error.message

      });

    }

  }
);
// =====================================================
// FINDR - SELLER ITEMS DISCOVERY
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
            "Debes proporcionar seller_id."

        });

      }

      const limit =
        Math.min(
          Number(req.query.limit) || 20,
          50
        );

      const offset =
        Math.max(
          Number(req.query.offset) || 0,
          0
        );

      const sort =
        req.query.sort ||
        "price_asc";

      const params =
        new URLSearchParams({

          seller_id:
            sellerId,

          limit:
            String(limit),

          offset:
            String(offset),

          sort:
            sort

        });

      const endpoint =
        `/sites/MLM/search?${params.toString()}`;

      console.log(
        "======================================"
      );

      console.log(
        "FINDR - SELLER ITEMS"
      );

      console.log(
        "Seller:",
        sellerId
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

        success:
          true,

        seller_id:
          sellerId,

        total:
          data.paging?.total ||
          0,

        limit:
          data.paging?.limit ||
          limit,

        offset:
          data.paging?.offset ||
          offset,

        available_filters:
          data.available_filters ||
          [],

        available_sorts:
          data.available_sorts ||
          [],

        results:
          data.results ||
          []

      });

    } catch (error) {

      console.error(
        "Seller items error:",
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
// FINDR - MARKET TRENDS
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
// FINDR - TREND → PRODUCT ENGINE V1
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
            "Debes proporcionar q. Ejemplo: /trend-to-product?q=iphone+11+usado"

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

      console.log(
        "======================================"
      );

      console.log(
        "FINDR - TREND → PRODUCT V1"
      );

      console.log(
        "Query:",
        query
      );

      console.log(
        "Limit:",
        limit
      );

      console.log(
        "======================================"
      );


      // =================================================
      // 1. BUSCAR PRODUCTOS DE CATÁLOGO
      // =================================================

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


      const products =
        data.results ||
        [];


      // =================================================
      // 2. NORMALIZAR PRODUCTOS
      // =================================================

      const normalized =
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

              condition:
                attributes.CONDITION ||
                null,

              gtin:
                attributes.GTIN ||
                null,

              attributes

            };

          }
        );


      // =================================================
      // 3. RELEVANCIA
      // =================================================

      const queryWords =
        query
          .toLowerCase()
          .split(/\s+/)
          .filter(
            word =>
              word.length >= 2
          );


      const ranked =
        normalized
          .map(
            (product) => {

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


              // -----------------------------------------
              // Coincidencia por palabra
              // -----------------------------------------

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


              // -----------------------------------------
              // Coincidencia exacta de modelo
              // -----------------------------------------

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


              // -----------------------------------------
              // Coincidencia de marca
              // -----------------------------------------

              if (
                product.brand &&
                query
                  .toLowerCase()
                  .includes(
                    product.brand.toLowerCase()
                  )
              ) {

                score += 2;

              }


              // -----------------------------------------
              // Condición buscada
              // -----------------------------------------

              const queryLower =
                query.toLowerCase();


              if (
                queryLower.includes("usado") ||
                queryLower.includes("usada")
              ) {

                if (
                  product.condition ===
                  "used"
                ) {

                  score += 2;

                }

              }


              if (
                queryLower.includes("reacondicionado") ||
                queryLower.includes("reacondicionada")
              ) {

                if (
                  product.condition ===
                  "refurbished"
                ) {

                  score += 2;

                }

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


      // =================================================
      // 4. RESPUESTA
      // =================================================

      res.json({

        success:
          true,

        query,

        search_total:
          data.paging?.total ||
          products.length,

        products_found:
          products.length,

        results:
          ranked

      });


    } catch (error) {

      console.error(
        "Trend → Product error:",
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
      `FINDR Bot escuchando en puerto ${PORT}`
    );

  }
);
