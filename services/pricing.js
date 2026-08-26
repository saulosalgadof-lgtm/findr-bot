// =====================================================
// FINDR - PRICING SERVICE
// =====================================================
//
// MAPA DE ESTE ARCHIVO
//
// Etapa 8 del roadmap: precio objetivo de compra.
//
// PRECIO DE MERCADO + CATEGORÍA
//    ↓
// getMercadoLibreFee()        → comisión REAL de Mercado
//                                Libre (/sites/MLM/listing_prices),
//                                nunca un porcentaje asumido
//    ↓
// calculateTargetAcquisitionPrice() → precio máximo de compra
//                                       para el margen que el
//                                       usuario pidió
//
// Nunca inventa margen ni comisión: si falta la categoría o
// el margen deseado, ambas funciones devuelven null en vez de
// asumir un valor.
//
// Exporta:
//   - getMercadoLibreFee(price, categoryId, listingTypeId)
//   - calculateTargetAcquisitionPrice({ marketPrice, feeAmount, desiredMarginPercent })
//
// Usado por:
//   - services/opportunity.js (getProductOpportunity)
//
// =====================================================


// =====================================================
// 1. IMPORTS
// =====================================================

import {
  mercadoLibreRequest
} from "../utils/mercadolibre.js";


// =====================================================
// 2. CONFIGURACIÓN
// =====================================================

const SITE_ID =
  "MLM";


// =====================================================
// 3. COMISIÓN REAL DE MERCADO LIBRE
// =====================================================
//
// Confirmado en producción vía /listing-prices-test: la
// comisión depende del tipo de publicación (listing_type_id),
// no es un número único por categoría. Por default usamos
// "gold_special" (Clásica, ~10%) porque es el tipo de
// publicación más común y coincide con el proceso manual que
// ya usa el usuario. Se puede pedir otro tipo si hace falta.
//
// Devuelve null (no un valor por default inventado) si
// Mercado Libre no trae ese listing_type_id para el precio/
// categoría pedidos.
//
// =====================================================

export async function getMercadoLibreFee(
  price,
  categoryId,
  listingTypeId = "gold_special"
) {

  if (
    !price ||
    price <= 0
  ) {

    return null;

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


  const data =
    await mercadoLibreRequest(
      `/sites/${SITE_ID}/listing_prices?${params.toString()}`
    );

  const options =
    Array.isArray(data)
      ? data
      : [];

  const match =
    options.find(
      option =>
        option.listing_type_id ===
        listingTypeId
    );

  if (!match) {

    return null;

  }


  return {

    listing_type_id:
      match.listing_type_id,

    listing_type_name:
      match.listing_type_name ||
      null,

    percentage_fee:
      match.sale_fee_details?.percentage_fee ??
      null,

    fee_amount:
      match.sale_fee_amount ??
      null

  };

}


// =====================================================
// 4. PRECIO OBJETIVO DE COMPRA
// =====================================================
//
// target = precio_de_mercado - comisión_real - margen_deseado
//
// Donde margen_deseado se expresa como % del precio de
// mercado (el mismo criterio que ya usa el usuario a mano).
//
// Devuelve null si falta cualquiera de los tres datos reales
// que necesita — nunca completa el hueco con un supuesto.
//
// =====================================================

export function calculateTargetAcquisitionPrice({

  marketPrice,

  feeAmount,

  desiredMarginPercent

}) {

  if (
    !marketPrice ||
    marketPrice <= 0
  ) {

    return null;

  }

  if (
    feeAmount === null ||
    feeAmount === undefined
  ) {

    return null;

  }

  if (
    desiredMarginPercent === null ||
    desiredMarginPercent === undefined ||
    Number.isNaN(
      Number(
        desiredMarginPercent
      )
    )
  ) {

    return null;

  }


  const marginAmount =
    marketPrice *
    (
      Number(
        desiredMarginPercent
      )
      /
      100
    );

  const target =
    marketPrice -
    feeAmount -
    marginAmount;


  return (
    Math.round(
      target *
      100
    )
    /
    100
  );

}
