// =====================================================
// FINDR - OPPORTUNITY ROUTE
// =====================================================
//
// DIAGRAMA DE FLUJO
//
// Opportunity Engine
//
//   REQUEST
//      │
//      ▼
// 1. VALIDACIÓN
//      │
//      ▼
// 2. PRODUCT DETAIL
//      │
//      ▼
// 3. MARKET LISTINGS
//      │
//      ▼
// 4. MARKET ANALYSIS
//      │
//      ├── Sellers
//      ├── Prices
//      ├── Conditions
//      ├── Official Stores
//      └── Competition
//      │
//      ▼
// 5. FINDR SCORE
//      │
//      ├── Demand
//      ├── Competition
//      ├── Margin
//      ├── Price
//      ├── Sales
//      └── Risk
//      │
//      ▼
// 6. VERDICT
//      │
//      ├── STRONG_OPPORTUNITY
//      ├── OPPORTUNITY
//      ├── WATCH
//      └── DISCARD
//      │
//      ▼
// 7. RESPONSE
//
// =====================================================


// =====================================================
// 1. IMPORTS
// =====================================================

import {
  createMercadoLibreRequest
} from "../utils/mercadolibre.js";


// =====================================================
// 2. HELPERS
// =====================================================


// -----------------------------------------------------
// CLAMP SCORE
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
// 3. DEMAND SCORE
// =====================================================

function calculateDemandScore({

  trendRank = null,

  soldQuantity = 0,

  searchTotal = 0

}) {

  let score = 0;


  // ---------------------------------------------------
  // TREND RANK
  // ---------------------------------------------------

  if (
    trendRank !== null
  ) {

    if (
      trendRank <= 10
    ) {
      score += 50;
    }

    else if (
      trendRank <= 25
    ) {
      score += 40;
    }

    else if (
      trendRank <= 50
    ) {
      score += 30;
    }

    else if (
      trendRank <= 100
    ) {
      score += 20;
    }

    else {
      score += 10;
    }

  }


  // ---------------------------------------------------
  // SOLD QUANTITY
  // ---------------------------------------------------

  if (
    soldQuantity >= 1000
  ) {
    score += 50;
  }

  else if (
    soldQuantity >= 500
  ) {
    score += 45;
  }

  else if (
    soldQuantity >= 250
  ) {
    score += 40;
  }

  else if (
    soldQuantity >= 100
  ) {
    score += 30;
  }

  else if (
    soldQuantity >= 50
  ) {
    score += 20;
  }

  else if (
    soldQuantity > 0
  ) {
    score += 10;
  }


  return clampScore(
    score
  );

}


// =====================================================
// 4. COMPETITION SCORE
// =====================================================

function calculateCompetitionScore({

  sellers = 0,

  buyBoxWinner = false

}) {

  let score = 100;


  if (
    sellers >= 100
  ) {
    score -= 60;
  }

  else if (
    sellers >= 50
  ) {
    score -= 45;
  }

  else if (
    sellers >= 25
  ) {
    score -= 30;
  }

  else if (
    sellers >= 10
  ) {
    score -= 15;
  }

  else if (
    sellers >= 5
  ) {
    score -= 5;
  }


  // ---------------------------------------------------
  // BUY BOX
  // ---------------------------------------------------

  if (
    buyBoxWinner
  ) {

    score -= 10;

  }


  return clampScore(
    score
  );

}


// =====================================================
// 5. MARGIN SCORE
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
      (
        sellingPrice -
        acquisitionCost
      )
      /
      sellingPrice
    )
    *
    100;


  if (
    margin >= 40
  ) {
    return 100;
  }

  if (
    margin >= 30
  ) {
    return 90;
  }

  if (
    margin >= 25
  ) {
    return 80;
  }

  if (
    margin >= 20
  ) {
    return 70;
  }

  if (
    margin >= 15
  ) {
    return 55;
  }

  if (
    margin >= 10
  ) {
    return 40;
  }

  if (
    margin >= 5
  ) {
    return 20;
  }


  return 0;

}


// =====================================================
// 6. PRICE SCORE
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
      (
        marketPrice -
        sellingPrice
      )
      /
      marketPrice
    )
    *
    100;


  if (
    difference >= 20
  ) {
    return 100;
  }

  if (
    difference >= 15
  ) {
    return 90;
  }

  if (
    difference >= 10
  ) {
    return 80;
  }

  if (
    difference >= 5
  ) {
    return 70;
  }

  if (
    difference >= 0
  ) {
    return 60;
  }

  if (
    difference >= -5
  ) {
    return 45;
  }

  if (
    difference >= -10
  ) {
    return 30;
  }


  return 15;

}


// =====================================================
// 7. SALES SCORE
// =====================================================

function calculateSalesScore({

  soldQuantity = 0,

  availableQuantity = 0

}) {

  const total =
    soldQuantity +
    availableQuantity;


  if (
    !total
  ) {

    return 0;

  }


  const sellThrough =
    soldQuantity /
    total;


  if (
    sellThrough >= 0.80
  ) {
    return 100;
  }

  if (
    sellThrough >= 0.65
  ) {
    return 85;
  }

  if (
    sellThrough >= 0.50
  ) {
    return 70;
  }

  if (
    sellThrough >= 0.35
  ) {
    return 55;
  }

  if (
    sellThrough >= 0.20
  ) {
    return 40;
  }


  return 20;

}


// =====================================================
// 8. RISK SCORE
// =====================================================

function calculateRiskScore({

  condition = null,

  sellers = 0,

  catalogListing = false

}) {

  let score = 100;


  if (
    condition === "used"
  ) {

    score -= 10;

  }


  if (
    sellers >= 100
  ) {

    score -= 25;

  }


  if (
    catalogListing
  ) {

    score += 5;

  }


  return clampScore(
    score
  );

}


// =====================================================
// 9. FINDR SCORE ENGINE
// =====================================================

function calculateFindrScore(
  data
) {

  const demand =
    calculateDemandScore(
      data
    );


  const competition =
    calculateCompetitionScore(
      data
    );


  const margin =
    calculateMarginScore(
      data
    );


  const price =
    calculatePriceScore(
      data
    );


  const sales =
    calculateSalesScore(
      data
    );


  const risk =
    calculateRiskScore(
      data
    );


  // ---------------------------------------------------
  // WEIGHTED SCORE
  // ---------------------------------------------------

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
    Math.round(
      score
    );


  // ---------------------------------------------------
  // VERDICT
  // ---------------------------------------------------

  let verdict;


  if (
    finalScore >= 80
  ) {

    verdict =
      "STRONG_OPPORTUNITY";

  }

  else if (
    finalScore >= 65
  ) {

    verdict =
      "OPPORTUNITY";

  }

  else if (
    finalScore >= 50
  ) {

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
        Math.round(
          demand
        ),

      competition:
        Math.round(
          competition
        ),

      margin:
        Math.round(
          margin
        ),

      price:
        Math.round(
          price
        ),

      sales:
        Math.round(
          sales
        ),

      risk:
        Math.round(
          risk
        )

    }

  };

}


// =====================================================
// 10. MARKET ANALYSIS
// =====================================================
//
// Convierte las publicaciones de Mercado Libre
// en métricas utilizables por FINDR.
//
// =====================================================

function analyzeMarket(
  listings
) {

  const safeListings =
    Array.isArray(
      listings
    )
      ? listings
      : [];


  // ---------------------------------------------------
  // PRICES
  // ---------------------------------------------------

  const prices =
    safeListings
      .map(
        listing =>
          Number(
            listing.price
          ) || 0
      )
      .filter(
        price =>
          price > 0
      );


  // ---------------------------------------------------
  // UNIQUE SELLERS
  // ---------------------------------------------------

  const sellers =
    [
      ...new Set(
        safeListings
          .map(
            listing =>
              listing.seller_id
          )
          .filter(Boolean)
      )
    ];


  // ---------------------------------------------------
  // CONDITIONS
  // ---------------------------------------------------

  const newListings =
    safeListings.filter(
      listing =>
        listing.condition === "new"
    );


  const usedListings =
    safeListings.filter(
      listing =>
        listing.condition === "used"
    );


  // ---------------------------------------------------
  // OFFICIAL STORES
  // ---------------------------------------------------

  const officialStoreListings =
    safeListings.filter(
      listing =>
        !!listing.official_store_id
    );


  // ---------------------------------------------------
  // PRICE METRICS
  // ---------------------------------------------------

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
        )
        /
        prices.length
      : null;


  return {

    totalListings:
      safeListings.length,

    sellers:
      sellers.length,

    newListings:
      newListings.length,

    usedListings:
      usedListings.length,

    officialStoreListings:
      officialStoreListings.length,

    averagePrice,

    minimumPrice,

    maximumPrice,

    sellerIds:
      sellers

  };

}


// =====================================================
// 11. PRODUCT OPPORTUNITY
// =====================================================
//
// Flujo:
//
// PRODUCT ID
//    ↓
// PRODUCT DETAIL
//    ↓
// PRODUCT LISTINGS
//    ↓
// MARKET ANALYSIS
//    ↓
// FINDR SCORE
//    ↓
// RESPONSE
//
// =====================================================

async function getProductOpportunity(
  productId
) {

  // ---------------------------------------------------
  // PRODUCT DETAIL
  // ---------------------------------------------------

  const request =
    createMercadoLibreRequest();


  const product =
    await request(
      `/products/${encodeURIComponent(
        productId
      )}`
    );


  // ---------------------------------------------------
  // PRODUCT LISTINGS
  // ---------------------------------------------------

  const listingsData =
    await request(
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


  // ---------------------------------------------------
  // NORMALIZE LISTINGS
  // ---------------------------------------------------

  const listings =
    rawListings.map(
      listing => ({

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

      })
    );


  // ---------------------------------------------------
  // MARKET ANALYSIS
  // ---------------------------------------------------

  const market =
    analyzeMarket(
      listings
    );


  // ---------------------------------------------------
  // PRODUCT INFORMATION
  // ---------------------------------------------------

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


  // ---------------------------------------------------
  // FINDR SCORE
  // ---------------------------------------------------
  //
  // En esta primera versión utilizamos:
  //
  // sold_quantity
  // sellers
  // market average price
  //
  // El acquisition cost se recibe después
  // como parámetro del endpoint.
  //

  const scoreData = {

    soldQuantity:
      product.sold_quantity ||
      0,

    sellers:
      market.sellers,

    marketPrice:
      market.averagePrice,

    sellingPrice:
      market.minimumPrice,

    acquisitionCost:
      0,

    availableQuantity:
      0,

    condition:
      listings[0]?.condition ||
      "new",

    catalogListing:
      true,

    buyBoxWinner:
      !!product.buy_box_winner

  };


  const findr =
    calculateFindrScore(
      scoreData
    );


  // ---------------------------------------------------
  // RESPONSE
  // ---------------------------------------------------

  return {

    product:
      productInfo,

    market: {

      total_listings:
        market.totalListings,

      sellers:
        market.sellers,

      new_listings:
        market.newListings,

      used_listings:
        market.usedListings,

      official_store_listings:
        market.officialStoreListings,

      average_price:
        market.averagePrice,

      minimum_price:
        market.minimumPrice,

      maximum_price:
        market.maximumPrice,

      total_sold_quantity:
        product.sold_quantity ||
        0

    },

    findr,

    listings

  };

}


// =====================================================
// 12. PRODUCT OPPORTUNITY V3
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
  // 13. FINDR SCORE TEST
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
