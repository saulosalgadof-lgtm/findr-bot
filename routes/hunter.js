// =====================================================
// FINDR - HUNTER ROUTE
// =====================================================
//
// DIAGRAMA DE FLUJO
//
// Este archivo SOLO registra el endpoint HTTP. Toda la
// lógica vive en services/hunter.js (que a su vez reusa
// services/trend.js y services/opportunity.js sin
// duplicar nada).
//
//   REQUEST (q)
//      │
//      ▼
// services/hunter.js: huntOpportunities()
//      │
//      ▼
//   RESPONSE (scanned, opportunities_found, results)
//
// =====================================================


import {
  huntOpportunities
} from "../services/hunter.js";


// =====================================================
// 1. HUNTER
// =====================================================
//
// Endpoint:
//
// GET /hunter?q=iphone%2011&limit=10
//
// =====================================================

export default function hunterRoute(
  app
) {

  app.get(

    "/hunter",

    async (
      req,
      res
    ) => {

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
          "FINDR HUNTER"
        );

        console.log(
          "Query:",
          query
        );

        console.log(
          "======================================"
        );


        // ---------------------------------------------
        // ENGINE
        // ---------------------------------------------

        const hunt =
          await huntOpportunities(
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

          ...hunt

        });

      }

      catch (error) {

        console.error(
          "Hunter error:",
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
