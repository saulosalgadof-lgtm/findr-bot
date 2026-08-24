// =====================================================
// FINDR - TREND ROUTES
// =====================================================
//
// DIAGRAMA DE FLUJO
//
// Este archivo SOLO registra endpoints HTTP. Toda la
// lógica de negocio (parser de tendencias, domain
// discovery, el pipeline trend → product) vive en
// services/trend.js.
//
// MERCADO LIBRE TRENDS
//          │
//          ▼
//     MARKET TRENDS
//          │
//          ▼
//   TREND INTELLIGENCE  → services/trend.js: parseTrendQuery()
//          │
//          ▼
//     TREND → PRODUCT   → services/trend.js: findProductsForTrend()
//
// =====================================================


import {
  mercadoLibreRequest
} from "../utils/mercadolibre.js";

import {
  parseTrendQuery,
  findProductsForTrend
} from "../services/trend.js";


// =====================================================
// 1. CONFIGURACIÓN
// =====================================================
//
// Mercado Libre México
//
// =====================================================

const SITE_ID = "MLM";


// =====================================================
// 2. MARKET TRENDS
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
// 3. TREND INTELLIGENCE
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
// 4. TREND → DOMAIN → PRODUCT
// =====================================================
//
// Endpoint:
//
// GET /trend-to-product?q=iphone%2011%20usado
//
// =====================================================

function registerTrendToProductRoute(app) {

  app.get(

    "/trend-to-product",

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


        console.log(
          "======================================"
        );

        console.log(
          "FINDR - TREND → DOMAIN → PRODUCT"
        );

        console.log(
          "Raw query:",
          query
        );

        console.log(
          "======================================"
        );


        // ---------------------------------------------
        // ENGINE
        // ---------------------------------------------

        const result =

          await findProductsForTrend(
            query,
            {
              limit:
                req.query.limit
            }
          );


        // ---------------------------------------------
        // RESPONSE
        // ---------------------------------------------

        res.json({

          success:
            true,

          ...result

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
// 5. REGISTRO DE RUTAS
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
