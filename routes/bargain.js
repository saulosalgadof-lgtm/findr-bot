// =====================================================
// FINDR - BARGAIN SCAN ROUTE
// =====================================================
//
// DIAGRAMA DE FLUJO
//
// Este archivo SOLO registra el endpoint HTTP. Toda la
// lógica vive en services/bargain.js.
//
//   REQUEST (product_id, sell_price, margin)
//      │
//      ▼
// services/bargain.js: scanForBargains()
//      │
//      ▼
//   RESPONSE (target_acquisition_price, bargains_found, listings)
//
// =====================================================


import {
  scanForBargains
} from "../services/bargain.js";


// =====================================================
// 1. BARGAIN SCAN
// =====================================================
//
// Endpoint:
//
// GET /bargain-scan?product_id=MLM...&sell_price=8300&margin=15
//
// product_id: el producto de catálogo a escanear (sacalo de
//   /products-search o /trend-to-product).
// sell_price: a cuánto vendés vos ese producto — lo sabés vos,
//   FINDR no lo adivina.
// margin: margen de utilidad que querés (%).
//
// Los tres son obligatorios: sin sell_price o margin no hay
// nada real que calcular.
//
// =====================================================

export default function bargainRoute(
  app
) {

  app.get(

    "/bargain-scan",

    async (
      req,
      res
    ) => {

      try {

        const productId =
          req.query.product_id;

        const sellPrice =
          Number(
            req.query.sell_price
          );

        const desiredMarginPercent =
          Number(
            req.query.margin
          );


        // ---------------------------------------------
        // VALIDACIÓN
        // ---------------------------------------------

        if (!productId) {

          return res.status(400).json({

            success:
              false,

            error:
              "Debes proporcionar product_id."

          });

        }

        if (
          !req.query.sell_price ||
          Number.isNaN(
            sellPrice
          ) ||
          sellPrice <= 0
        ) {

          return res.status(400).json({

            success:
              false,

            error:
              "Debes proporcionar sell_price (a cuánto vendés el producto), mayor a 0."

          });

        }

        if (
          !req.query.margin ||
          Number.isNaN(
            desiredMarginPercent
          )
        ) {

          return res.status(400).json({

            success:
              false,

            error:
              "Debes proporcionar margin (el margen de utilidad que querés, en %)."

          });

        }


        console.log(
          "======================================"
        );

        console.log(
          "FINDR BARGAIN SCAN"
        );

        console.log(
          "Product ID:",
          productId
        );

        console.log(
          "Sell price:",
          sellPrice
        );

        console.log(
          "Margin:",
          desiredMarginPercent
        );

        console.log(
          "======================================"
        );


        // ---------------------------------------------
        // ENGINE
        // ---------------------------------------------

        const scan =
          await scanForBargains(
            productId,
            {

              sellPrice,

              desiredMarginPercent

            }
          );


        // ---------------------------------------------
        // RESPONSE
        // ---------------------------------------------

        res.json({

          success:
            true,

          ...scan

        });

      }

      catch (error) {

        console.error(
          "Bargain scan error:",
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

}
