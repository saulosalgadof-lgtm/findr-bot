// =====================================================
// FINDR — PRODUCT ROUTES
// =====================================================
//
// FLUJO:
//
// PRODUCT
//   ↓
// ┌──────────────────────────────┐
// │ 1. PRODUCT SEARCH            │
// │    /products-search          │
// └──────────────┬───────────────┘
//                ↓
// ┌──────────────────────────────┐
// │ 2. PRODUCT DETAIL            │
// │    /product-detail           │
// └──────────────┬───────────────┘
//                ↓
// ┌──────────────────────────────┐
// │ 3. PRODUCT ITEMS             │
// │    /product-items            │
// └──────────────┬───────────────┘
//                ↓
// ┌──────────────────────────────┐
// │ 4. ITEM DETAIL               │
// │    /item-detail              │
// └──────────────┬───────────────┘
//                ↓
// ┌──────────────────────────────┐
// │ 5. PRODUCT LISTINGS          │
// │    /product-listings         │
// └──────────────┬───────────────┘
//                ↓
// ┌──────────────────────────────┐
// │ 6. PRODUCT COMPETITION       │
// │    /product-competition      │
// └──────────────┬───────────────┘
//                ↓
// ┌──────────────────────────────┐
// │ 7. DEBUG PRODUCT ITEMS       │
// │    /debug-product-items      │
// └──────────────────────────────┘
//
// RESPONSABILIDAD:
//
// Este archivo contiene todo lo relacionado con:
//
// - Productos de catálogo
// - Búsqueda de productos
// - Detalle de productos
// - Items / publicaciones
// - Competencia
// - Buy Box
// - Diagnóstico de Product Items
//
// NO contiene:
//
// - OAuth
// - Supabase
// - Manejo de tokens
// - Trend Intelligence
// - FINDR Score
//
// =====================================================


// =====================================================
// IMPORTS
// =====================================================

import {
  mercadoLibreRequest
} from "../utils/mercadolibre.js";


// =====================================================
// CONFIGURACIÓN
// =====================================================

const SITE_ID = "MLM";


// =====================================================
// HELPER — ERROR RESPONSE
// =====================================================

function sendRouteError(
  res,
  error,
  context,
  extra = {}
) {

  console.error(
    `${context}:`,
    error
  );

  return res.status(
    error.status || 500
  ).json({

    success:
      false,

    status:
      error.status ||
      null,

    error:
      error.data ||
      error.message,

    ...extra

  });

}


// =====================================================
// 1. PRODUCT SEARCH
// =====================================================
//
// Endpoint:
//
// GET /products-search?q=iphone%2011
//
// Flujo:
//
// QUERY
//   ↓
// /products/search
//   ↓
// PRODUCTOS
//
// =====================================================

function productSearchRoute(app) {

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
            Number(
              req.query.limit
            ) || 10,
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

        return sendRouteError(
          res,
          error,
          "Product search error"
        );

      }

    }
  );

}


// =====================================================
// 2. PRODUCT DETAIL
// =====================================================
//
// Endpoint:
//
// GET /product-detail?product_id=MLM...
//
// Flujo:
//
// PRODUCT ID
//     ↓
// /products/{product_id}
//     ↓
// PRODUCT DETAIL
//
// =====================================================

function productDetailRoute(app) {

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

        return sendRouteError(
          res,
          error,
          "Product detail error",
          {

            product_id:
              req.query.product_id ||
              null

          }
        );

      }

    }
  );

}


// =====================================================
// 3. PRODUCT ITEMS
// =====================================================
//
// Endpoint:
//
// GET /product-items?product_id=MLM...
//
// Flujo:
//
// PRODUCT
//   ↓
// /products/{id}/items
//   ↓
// CATALOG LISTINGS
//
// =====================================================

function productItemsRoute(app) {

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
            Number(
              req.query.limit
            ) || 50,
            100
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

        return sendRouteError(
          res,
          error,
          "Product items error",
          {

            product_id:
              req.query.product_id ||
              null

          }
        );

      }

    }
  );

}


// =====================================================
// 4. ITEM DETAIL
// =====================================================
//
// Endpoint:
//
// GET /item-detail?item_id=MLM...
//
// Flujo:
//
// ITEM ID
//   ↓
// /items/{item_id}
//   ↓
// ITEM DETAIL
//
// =====================================================

function itemDetailRoute(app) {

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

        return sendRouteError(
          res,
          error,
          "Item detail error",
          {

            item_id:
              req.query.item_id ||
              null

          }
        );

      }

    }
  );

}


// =====================================================
// 5. PRODUCT LISTINGS
// =====================================================
//
// Endpoint:
//
// GET /product-listings?product_id=MLM...
//
// Flujo:
//
// PRODUCT
//   ↓
// /products/{id}/items
//   ↓
// TODAS LAS PUBLICACIONES
//   ↓
// DATOS DE COMPETENCIA
//
// =====================================================

function productListingsRoute(app) {

  app.get(
    "/product-listings",
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
            Number(
              req.query.limit
            ) || 20,
            100
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

          success:
            true,

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

        return sendRouteError(
          res,
          error,
          "Product listings error",
          {

            product_id:
              req.query.product_id ||
              null

          }
        );

      }

    }
  );

}


// =====================================================
// 6. PRODUCT COMPETITION / BUY BOX
// =====================================================
//
// Endpoint:
//
// GET /product-competition?product_id=MLM...
//
// Flujo:
//
// PRODUCT
//   ↓
// PRODUCT DETAIL
//   ↓
// BUY BOX WINNER
//   ↓
// COMPETENCIA
//
// =====================================================

function productCompetitionRoute(app) {

  app.get(
    "/product-competition",
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
        // RESPONSE
        // -----------------------------------------------

        res.json({

          success:
            true,

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

        return sendRouteError(
          res,
          error,
          "Product competition error",
          {

            product_id:
              req.query.product_id ||
              null

          }
        );

      }

    }
  );

}


// =====================================================
// 7. DEBUG PRODUCT ITEMS
// =====================================================
//
// Endpoint:
//
// GET /debug-product-items?product_id=MLM...
//
// PROPÓSITO:
//
// Diagnóstico de la respuesta RAW de Mercado Libre.
//
// IMPORTANTE:
//
// Este endpoint NO forma parte del flujo principal
// de FINDR.
//
// Se conserva para debugging.
//
// =====================================================

function debugProductItemsRoute(app) {

  app.get(
    "/debug-product-items",
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


        const endpoint =
          `/products/${encodeURIComponent(
            productId
          )}/items?limit=100`;


        console.log(
          "======================================"
        );

        console.log(
          "DEBUG PRODUCT ITEMS"
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


        console.log(
          "RAW PRODUCT ITEMS RESPONSE:"
        );

        console.log(
          JSON.stringify(
            data,
            null,
            2
          )
        );


        res.json({

          success:
            true,

          endpoint,

          raw_response:
            data,

          results_is_array:
            Array.isArray(
              data?.results
            ),

          results_count:
            Array.isArray(
              data?.results
            )
              ? data.results.length
              : 0

        });


      } catch (error) {

        return sendRouteError(
          res,
          error,
          "Debug product items error",
          {

            product_id:
              req.query.product_id ||
              null

          }
        );

      }

    }
  );

}


// =====================================================
// ROUTE REGISTRATION
// =====================================================
//
// server.js solamente necesita:
//
// import productRoute from "./routes/product.js";
//
// productRoute(app);
//
// Y este archivo registra internamente:
//
// 1. /products-search
// 2. /product-detail
// 3. /product-items
// 4. /item-detail
// 5. /product-listings
// 6. /product-competition
// 7. /debug-product-items
//
// =====================================================

export default function productRoute(app) {

  productSearchRoute(app);

  productDetailRoute(app);

  productItemsRoute(app);

  itemDetailRoute(app);

  productListingsRoute(app);

  productCompetitionRoute(app);

  debugProductItemsRoute(app);

}
