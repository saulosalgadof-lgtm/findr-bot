// =====================================================
// FINDR - OPPORTUNITY ROUTES
// =====================================================
//
// DIAGRAMA DE FLUJO
//
// Mercado Libre
//      │
//      ▼
// Product Data
//      │
//      ├── Demanda
//      ├── Competencia
//      ├── Margen
//      ├── Precio
//      ├── Ventas
//      └── Riesgo
//             │
//             ▼
//        FINDR SCORE
//             │
//      ┌──────┼────────┐
//      ▼      ▼        ▼
//   STRONG  OPPORTUNITY WATCH
//      │      │        │
//      └──────┴────────┘
//             │
//             ▼
//          DISCARD
//
// =====================================================


import {
  mercadoLibreRequest
} from "../utils/mercadolibre.js";


// =====================================================
// 1. CONFIGURACIÓN
// =====================================================

const SITE_ID = "MLM";


// =====================================================
// 2. FUNCIONES GENERALES DE SCORE
// =====================================================

// -----------------------------------------------------
// LIMITAR SCORE ENTRE 0 Y 100
// -----------------------------------------------------

function clampScore(value) {

  return Math.max(
    0,
    Math.min(
      100,
      Number(value) || 0
    )
  );

}


// =====================================================
// 3. SCORE DE DEMANDA
// =====================================================
//
// Evalúa:
//
// - posición en tendencias
// - cantidad vendida
//
// =====================================================

function calculateDemandScore({

  trendRank = null,

  soldQuantity = 0,

  searchTotal = 0

}) {

  let score = 0;


  // ---------------------------------------------------
  // TENDENCIA
  // ---------------------------------------------------

  if (trendRank !== null) {

    if (trendRank <= 10) {

      score += 50;

    }
    else if (trendRank <= 25) {

      score += 40;

    }
    else if (trendRank <= 50) {

      score += 30;

    }
    else if (trendRank <= 100) {

      score += 20;

    }
    else {

      score += 10;

    }

  }


  // ---------------------------------------------------
  // VENTAS
  // ---------------------------------------------------

  if (soldQuantity >= 1000) {

    score += 50;

  }
  else if (soldQuantity >= 500) {

    score += 45;

  }
  else if (soldQuantity >= 250) {

    score += 40;

  }
  else if (soldQuantity >= 100) {

    score += 30;

  }
  else if (soldQuantity >= 50) {

    score += 20;

  }
  else if (soldQuantity > 0) {

    score += 10;

  }


  return clampScore(score);

}


// =====================================================
// 4. SCORE DE COMPETENCIA
// =====================================================
//
// Menos vendedores = mejor oportunidad.
//
// Buy Box consolidada = mayor competencia.
//
// =====================================================

function calculateCompetitionScore({

  sellers = 0,

  buyBoxWinner = false

}) {

  let score = 100;


  if (sellers >= 100) {

    score -= 60;

  }
  else if (sellers >= 50) {

    score -= 45;

  }
  else if (sellers >= 25) {

    score -= 30;

  }
  else if (sellers >= 10) {

    score -= 15;

  }
  else if (sellers >= 5) {

    score -= 5;

  }


  // ---------------------------------------------------
  // BUY BOX
  // ---------------------------------------------------

  if (buyBoxWinner) {

    score -= 10;

  }


  return clampScore(score);

}


// =====================================================
// 5. SCORE DE MARGEN
// =====================================================
//
// Calcula:
//
// (precio venta - costo adquisición)
// / precio venta
//
// =====================================================

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


// =====================================================
// 6. SCORE DE PRECIO
// =====================================================
//
// Compara:
//
// precio de mercado
// vs
// precio de venta esperado
//
// =====================================================

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


// =====================================================
// 7. SCORE DE VENTAS
// =====================================================
//
// Sell-through:
//
// ventas
// -----------
// ventas + inventario
//
// =====================================================

function calculateSalesScore({

  soldQuantity = 0,

  availableQuantity = 0

}) {

  const total =

    soldQuantity +

    availableQuantity;


  if (!total) {

    return 0;

  }


  const sellThrough =

    soldQuantity / total;


  if (sellThrough >= 0.80) return 100;

  if (sellThrough >= 0.65) return 85;

  if (sellThrough >= 0.50) return 70;

  if (sellThrough >= 0.35) return 55;

  if (sellThrough >= 0.20) return 40;


  return 20;

}


// =====================================================
// 8. SCORE DE RIESGO
// =====================================================
//
// Mayor score = menor riesgo.
//
// =====================================================

function calculateRiskScore({

  condition = null,

  sellers = 0,

  catalogListing = false

}) {

  let score = 100;


  // ---------------------------------------------------
  // PRODUCTO USADO
  // ---------------------------------------------------

  if (condition === "used") {

    score -= 10;

  }


  // ---------------------------------------------------
  // MUCHOS VENDEDORES
  // ---------------------------------------------------

  if (sellers >= 100) {

    score -= 25;

  }


  // ---------------------------------------------------
  // CATÁLOGO
  // ---------------------------------------------------

  if (catalogListing) {

    score += 5;

  }


  return clampScore(score);

}


// =====================================================
// 9. FINDR SCORE
// =====================================================
//
// Pesos:
//
// Demanda       25%
// Competencia   20%
// Margen        20%
// Precio        15%
// Ventas        10%
// Riesgo        10%
//
// =====================================================

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


  // ---------------------------------------------------
  // VEREDICTO
  // ---------------------------------------------------

  let verdict;


  if (finalScore >= 80) {

    verdict =
      "STRONG_OPPORTUNITY";

  }

  else if (finalScore >= 65) {

    verdict =
      "OPPORTUNITY";

  }

  else if (finalScore >= 50) {

    verdict =
      "WATCH";

  }

  else {

    verdict =
      "DISCARD";

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
// 10. TEST FINDR SCORE
// =====================================================
//
// GET /findr-score-test
//
// Ejemplo:
//
// /findr-score-test
//
// /findr-score-test?trend_rank=10
// &sold=1000
// &sellers=5
// &price=10000
// &cost=6000
//
// =====================================================

appRouteFindrScoreTest();

function appRouteFindrScoreTest() {

  // Esta función existe únicamente para mantener
  // separada la sección del endpoint dentro del archivo.

}


// =====================================================
// 11. PRODUCT COMPETITION
// =====================================================
//
// Obtiene:
//
// /products/{PRODUCT_ID}
//
// y analiza:
//
// buy_box_winner
// precio
// vendedor
// ventas
// shipping
// warranty
//
// =====================================================

function registerProductCompetitionRoute(app) {

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


        // ---------------------------------------------
        // PRODUCT DETAIL
        // ---------------------------------------------

        const product =

          await mercadoLibreRequest(

            `/products/${encodeURIComponent(
              productId
            )}`

          );


        // ---------------------------------------------
        // BUY BOX
        // ---------------------------------------------

        const winner =

          product.buy_box_winner ||

          null;


        // ---------------------------------------------
        // RESPONSE
        // ---------------------------------------------

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


      }

      catch (error) {

        console.error(
          "Product competition error:",
          error
        );


        res.status(

          error.status ||

          500

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

}


// =====================================================
// 12. PRODUCT LISTINGS
// =====================================================
//
// Obtiene:
//
// /products/{PRODUCT_ID}/items
//
// Devuelve las publicaciones asociadas
// al producto de catálogo.
//
// =====================================================

function registerProductListingsRoute(app) {

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


      }

      catch (error) {

        console.error(
          "Product listings error:",
          error
        );


        res.status(

          error.status ||

          500

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

}


// =====================================================
// 13. PRODUCT OPPORTUNITY V3
// =====================================================
//
// FLUJO:
//
// PRODUCT ID
//     │
//     ▼
// PRODUCT DETAIL
//     │
//     ▼
// PRODUCT LISTINGS
//     │
//     ▼
// NORMALIZACIÓN
//     │
//     ▼
// MARKET METRICS
//     │
//     ▼
// OPPORTUNITY DATA
//
// =====================================================

function registerProductOpportunityRoute(app) {

  app.get(

    "/product-opportunity-v3",

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
          "FINDR PRODUCT OPPORTUNITY V3"
        );

        console.log(
          "Product ID:",
          productId
        );

        console.log(
          "======================================"
        );


        // ============================================
        // 1. PRODUCT DETAIL
        // ============================================

        const product =

          await mercadoLibreRequest(

            `/products/${encodeURIComponent(
              productId
            )}`

          );


        // ============================================
        // 2. PRODUCT LISTINGS
        // ============================================

        const listingsData =

          await mercadoLibreRequest(

            `/products/${encodeURIComponent(
              productId
            )}/items?limit=100`

          );


        const rawListings =

          Array.isArray(
            listingsData?.results
          )

            ? listingsData.results

            : [];


        console.log(
          "Listings encontrados:",
          rawListings.length
        );


        // ============================================
        // 3. NORMALIZAR LISTINGS
        // ============================================

        const listings =

          rawListings.map(

            listing => {

              return {

                item_id:
                  listing.item_id ||
                  null,

                seller_id:
                  listing.seller_id ||
                  null,

                price:
                  Number(
                    listing.price
                  ) || 0,

                currency_id:
                  listing.currency_id ||
                  null,

                condition:
                  listing.condition ||
                  null,

                listing_type_id:
                  listing.listing_type_id ||
                  null,

                official_store_id:
                  listing.official_store_id ||
                  null,

                warranty:
                  listing.warranty ||
                  null,

                shipping:
                  listing.shipping ||
                  null,

                original_price:
                  listing.original_price ||
                  null,

                accepts_mercadopago:
                  listing.accepts_mercadopago ||
                  false,

                user_product_id:
                  listing.user_product_id ||
                  null,

                tags:

                  Array.isArray(
                    listing.tags
                  )

                    ? listing.tags

                    : []

              };

            }

          );


        // ============================================
        // 4. MARKET METRICS
        // ============================================

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

          [

            ...new Set(

              listings

                .map(

                  listing =>
                    listing.seller_id

                )

                .filter(Boolean)

            )

          ];


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


        // ============================================
        // 5. PRODUCT INFORMATION
        // ============================================

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
            product.sold_quantity ||
            0,

          permalink:
            product.permalink ||
            null

        };


        // ============================================
        // 6. RESPONSE
        // ============================================

        res.json({

          success: true,

          product:
            productInfo,

          market: {

            total_listings:
              listings.length,

            sellers:
              sellers.length,

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
              product.sold_quantity ||
              0

          },

          listings

        });


      }

      catch (error) {

        console.error(
          "Product opportunity V3 error:",
          error
        );


        res.status(

          error.status ||

          500

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

}


// =====================================================
// 14. DEBUG PRODUCT ITEMS
// =====================================================
//
// Endpoint:
//
// /debug-product-items?product_id=...
//
// Sirve para inspeccionar exactamente qué devuelve
// Mercado Libre.
//
// =====================================================

function registerDebugProductItemsRoute(app) {

  app.get(

    "/debug-product-items",

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

          success: true,

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


      }

      catch (error) {

        console.error(
          "Debug product items error:",
          error
        );


        res.status(

          error.status ||

          500

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

}


// =====================================================
// 15. FINDR SCORE TEST ROUTE
// =====================================================
//
// Se registra aquí junto con las demás rutas.
//
// =====================================================

function registerFindrScoreTestRoute(app) {

  app.get(

    "/findr-score-test",

    async (req, res) => {

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
            req.query.buy_box === "true",

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
            req.query.catalog === "true"

        };


        const result =

          calculateFindrScore(
            data
          );


        res.json({

          success: true,

          input:
            data,

          findr:
            result

        });


      }

      catch (error) {

        console.error(
          "FINDR Score Test error:",
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

}


// =====================================================
// 16. REGISTRAR TODAS LAS RUTAS
// =====================================================
//
// DIAGRAMA:
//
// opportunityRoute(app)
//        │
//        ├── /findr-score-test
//        │
//        ├── /product-competition
//        │
//        ├── /product-listings
//        │
//        ├── /product-opportunity-v3
//        │
//        └── /debug-product-items
//
// =====================================================

export default function opportunityRoute(app) {

  registerFindrScoreTestRoute(app);

  registerProductCompetitionRoute(app);

  registerProductListingsRoute(app);

  registerProductOpportunityRoute(app);

  registerDebugProductItemsRoute(app);

}
