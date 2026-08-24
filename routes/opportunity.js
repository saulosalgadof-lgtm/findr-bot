// =====================================================
// FINDR - OPPORTUNITY ROUTE
// =====================================================
//
// DIAGRAMA DE FLUJO
//
// Este archivo SOLO registra endpoints HTTP. Toda la
// lógica de negocio (scoring, market analysis, el
// pipeline product → opportunity) vive en
// services/opportunity.js.
//
//   REQUEST
//      │
//      ▼
// 1. VALIDACIÓN
//      │
//      ▼
// 2. services/opportunity.js
//      │
//      ├── getProductOpportunity()  → /product-opportunity-v3
//      └── calculateFindrScore()    → /findr-score-test
//      │
//      ▼
// 3. RESPONSE
//
// =====================================================


// =====================================================
// 1. IMPORTS
// =====================================================

import {
  calculateFindrScore,
  getProductOpportunity
} from "../services/opportunity.js";


// =====================================================
// 2. PRODUCT OPPORTUNITY V3
// =====================================================

export default function opportunityRoute(
  app
) {

  app.get(
    "/product-opportunity-v3",
    async (
      req,
      res
    ) => {

      try {

        // ---------------------------------------------
        // VALIDATION
        // ---------------------------------------------

        const productId =
          req.query.product_id;


        if (
          !productId
        ) {

          return res.status(
            400
          ).json({

            success:
              false,

            error:
              "Debes proporcionar product_id."

          });

        }


        console.log(
          "======================================"
        );

        console.log(
          "FINDR PRODUCT OPPORTUNITY V3"
        );

        console.log(
          "Product ID:",
          productId
        );

        console.log(
          "======================================"
        );


        // ---------------------------------------------
        // ENGINE
        // ---------------------------------------------

        const opportunity =
          await getProductOpportunity(
            productId
          );


        // ---------------------------------------------
        // RESPONSE
        // ---------------------------------------------

        res.json({

          success:
            true,

          ...opportunity

        });

      }

      catch (
        error
      ) {

        console.error(
          "Product opportunity error:",
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


  // ===================================================
  // 3. FINDR SCORE TEST
  // ===================================================

  app.get(
    "/findr-score-test",
    async (
      req,
      res
    ) => {

      try {

        const data = {

          trendRank:
            Number(
              req.query.trend_rank
            ) || 20,

          soldQuantity:
            Number(
              req.query.sold
            ) || 500,

          searchTotal:
            Number(
              req.query.search_total
            ) || 1000,

          sellers:
            Number(
              req.query.sellers
            ) || 10,

          buyBoxWinner:
            req.query.buy_box ===
            "true",

          sellingPrice:
            Number(
              req.query.price
            ) || 10000,

          acquisitionCost:
            Number(
              req.query.cost
            ) || 7000,

          marketPrice:
            Number(
              req.query.market_price
            ) || 10000,

          availableQuantity:
            Number(
              req.query.available
            ) || 100,

          condition:
            req.query.condition ||
            "new",

          catalogListing:
            req.query.catalog ===
            "true"

        };


        const result =
          calculateFindrScore(
            data
          );


        res.json({

          success:
            true,

          input:
            data,

          findr:
            result

        });

      }

      catch (
        error
      ) {

        console.error(
          "FINDR Score Test error:",
          error
        );


        res.status(
          500
        ).json({

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
// END OF OPPORTUNITY ROUTE
// =====================================================
