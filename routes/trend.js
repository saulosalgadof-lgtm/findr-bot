// =====================================================
// FINDR - TREND ROUTES
// =====================================================
//
// DIAGRAMA DE FLUJO
//
// MERCADO LIBRE TRENDS
//          │
//          ▼
//     MARKET TRENDS
//          │
//          ▼
//   TREND INTELLIGENCE
//          │
//          ├── Producto
//          └── Condición
//                  │
//                  ▼
//           DOMAIN DISCOVERY
//                  │
//                  ▼
//           PRODUCT SEARCH
//                  │
//                  ▼
//          NORMALIZACIÓN
//                  │
//                  ▼
//         TREND → PRODUCT
//
// =====================================================


import {
  mercadoLibreRequest
} from "../utils/mercadolibre.js";


// =====================================================
// 1. CONFIGURACIÓN
// =====================================================
//
// Mercado Libre México
//
// =====================================================

const SITE_ID = "MLM";


// =====================================================
// 2. PARSER DE TENDENCIAS
// =====================================================
//
// Convierte una búsqueda del usuario en:
//
// raw_query
// product_query
// condition
//
// Ejemplos:
//
// "iphone 11 usado"
//        ↓
// product_query: "iphone 11"
// condition: "used"
//
// "iphone 11 reacondicionado"
//        ↓
// product_query: "iphone 11"
// condition: "refurbished"
//
// =====================================================

function parseTrendQuery(rawQuery) {

  const original =
    String(rawQuery || "")
      .trim();


  // ---------------------------------------------------
  // NORMALIZACIÓN
  // ---------------------------------------------------

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


  let condition = null;

  let productQuery =
    normalized;


  // ===================================================
  // 2.1 PRODUCTO USADO
  // ===================================================

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


  // ===================================================
  // 2.2 PRODUCTO REACONDICIONADO
  // ===================================================

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


  // ===================================================
  // 2.3 LIMPIEZA FINAL
  // ===================================================

  productQuery =

    productQuery

      .replace(
        /\s+/g,
        " "
      )

      .trim();


  // ===================================================
  // 2.4 RESULTADO
  // ===================================================

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
// 3. MARKET TRENDS
// =====================================================
//
// Endpoint:
//
// GET /market-trends
//
// Obtiene las tendencias actuales de Mercado Libre
// para México.
//
// =====================================================

function registerMarketTrendsRoute(app) {

  app.get(

    "/market-trends",

    async (req, res) => {

      try {

        // ---------------------------------------------
        // CONSULTAR MERCADO LIBRE
        // ---------------------------------------------

        const data =

          await mercadoLibreRequest(

            `/trends/${SITE_ID}`

          );


        // ---------------------------------------------
        // NORMALIZAR RESPUESTA
        // ---------------------------------------------

        const trends =

          Array.isArray(data)

            ? data

            : [];


        // ---------------------------------------------
        // RESPONSE
        // ---------------------------------------------

        res.json({

          success:
            true,

          site_id:
            SITE_ID,

          total:
            trends.length,

          trends

        });

      }

      catch (error) {

        console.error(
          "Market trends error:",
          error
        );


        res.status(

          error.status ||

          500

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

}


// =====================================================
// 4. TREND INTELLIGENCE
// =====================================================
//
// Endpoint:
//
// GET /trend-intelligence?q=iphone%2011%20usado
//
// NO consulta Mercado Libre.
//
// Su función es interpretar la búsqueda.
//
// =====================================================

function registerTrendIntelligenceRoute(app) {

  app.get(

    "/trend-intelligence",

    async (req, res) => {

      try {

        const query =
          req.query.q;


        // ---------------------------------------------
        // VALIDACIÓN
        // ---------------------------------------------

        if (!query) {

          return res.status(400).json({

            success:
              false,

            error:
              "Debes proporcionar q."

          });

        }


        // ---------------------------------------------
        // PARSEAR QUERY
        // ---------------------------------------------

        const parsed =

          parseTrendQuery(
            query
          );


        // ---------------------------------------------
        // RESPONSE
        // ---------------------------------------------

        res.json({

          success:
            true,

          ...parsed

        });

      }

      catch (error) {

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

}


// =====================================================
// 5. DOMAIN DISCOVERY
// =====================================================
//
// DIAGRAMA:
//
// PRODUCT QUERY
//      │
//      ▼
// Mercado Libre
//      │
//      ▼
// DOMAIN
//      │
//      ├── domain_id
//      ├── domain_name
//      ├── category_id
//      ├── category_name
//      └── attributes
//
// =====================================================

async function discoverDomain(query) {

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


  // ---------------------------------------------------
  // SIN RESULTADOS
  // ---------------------------------------------------

  if (
    results.length === 0
  ) {

    return null;

  }


  // ---------------------------------------------------
  // PRIMER RESULTADO
  // ---------------------------------------------------

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
// 6. TREND → DOMAIN → PRODUCT
// =====================================================
//
// Endpoint:
//
// GET /trend-to-product?q=iphone%2011%20usado
//
// DIAGRAMA:
//
// QUERY
//  │
//  ▼
// PARSER
//  │
//  ├── product_query
//  └── condition
//  │
//  ▼
// DOMAIN DISCOVERY
//  │
//  ▼
// PRODUCT SEARCH
//  │
//  ▼
// NORMALIZACIÓN
//  │
//  ▼
// RESPONSE
//
// =====================================================

function registerTrendToProductRoute(app) {

  app.get(

    "/trend-to-product",

    async (req, res) => {

      try {

        const query =
          req.query.q;


        // =================================================
        // 6.1 VALIDACIÓN
        // =================================================

        if (!query) {

          return res.status(400).json({

            success:
              false,

            error:
              "Debes proporcionar q."

          });

        }


        // =================================================
        // 6.2 INTERPRETAR TENDENCIA
        // =================================================

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


        // =================================================
        // 6.3 DESCUBRIR DOMAIN
        // =================================================

        const domain =

          await discoverDomain(

            parsed.product_query

          );


        // -------------------------------------------------
        // SIN DOMAIN
        // -------------------------------------------------

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


        // =================================================
        // 6.4 PRODUCT SEARCH
        // =================================================

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


        // =================================================
        // 6.5 NORMALIZAR PRODUCTOS
        // =================================================

        const normalized =

          products.map(

            product => {

              const attributes = {};


              // -------------------------------------------
              // ATRIBUTOS
              // -------------------------------------------

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


              // -------------------------------------------
              // PRODUCTO NORMALIZADO
              // -------------------------------------------

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


        // =================================================
        // 6.6 RESPONSE
        // =================================================

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


      }

      catch (error) {

        console.error(

          "Trend → Domain → Product error:",

          error

        );


        res.status(

          error.status ||

          500

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

}


// =====================================================
// 7. REGISTRO DE RUTAS
// =====================================================
//
// DIAGRAMA:
//
// trendRoute(app)
//       │
//       ├── /market-trends
//       │
//       ├── /trend-intelligence
//       │
//       └── /trend-to-product
//
// =====================================================

export default function trendRoute(app) {

  registerMarketTrendsRoute(app);

  registerTrendIntelligenceRoute(app);

  registerTrendToProductRoute(app);

}
