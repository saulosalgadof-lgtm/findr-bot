// =====================================================
// FINDR - PRICING ROUTES
// =====================================================
//
// MAPA DE ESTE ARCHIVO
//
// Todo lo relacionado con comisiones/costos de venta de
// Mercado Libre y, más adelante, el cálculo de precio
// objetivo de compra (Etapa 8: costo de adquisición).
//
// Por ahora contiene SOLO un endpoint de diagnóstico para
// comprobar si /sites/MLM/listing_prices nos da la comisión
// REAL de Mercado Libre por categoría — antes de construir
// nada de lógica de margen sobre un supuesto sin confirmar.
//
// =====================================================


import {
  mercadoLibreRequest
} from "../utils/mercadolibre.js";


const SITE_ID = "MLM";


// =====================================================
// 1. LISTING PRICES (DIAGNÓSTICO)
// =====================================================
//
// Endpoint:
//
// GET /listing-prices-test?price=8300&category_id=MLM1055
//
// Prueba /sites/MLM/listing_prices — la API oficial de ML
// para saber cuánto se queda Mercado Libre de comisión por
// vender a un precio dado, en una categoría dada.
//
// =====================================================

export default function pricingRoute(
  app
) {

  app.get(

    "/listing-prices-test",

    async (
      req,
      res
    ) => {

      try {

        const price =
          req.query.price;

        const categoryId =
          req.query.category_id;


        if (!price) {

          return res.status(400).json({

            success:
              false,

            error:
              "Debes proporcionar price."

          });

        }


        const params =
          new URLSearchParams({

            price:
              String(price)

          });

        if (categoryId) {

          params.set(
            "category_id",
            categoryId
          );

        }


        const endpoint =
          `/sites/${SITE_ID}/listing_prices?${params.toString()}`;


        console.log(
          "======================================"
        );

        console.log(
          "FINDR - LISTING PRICES TEST"
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

          price:
            Number(
              price
            ),

          category_id:
            categoryId ||
            null,

          raw:
            data

        });

      }

      catch (error) {

        console.error(
          "Listing prices test error:",
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
