// =====================================================
// MAPA DE ESTE ARCHIVO — utils/supabase.js
// =====================================================
//
// Contiene el único helper que habla directamente con la
// API REST de Supabase (PostgREST). Ningún otro archivo
// debe hacer fetch() contra Supabase: todos pasan por acá.
//
// Exporta:
//   - supabaseRequest(endpoint, options)
//
// Variables de entorno usadas:
//   - SUPABASE_URL
//   - SUPABASE_SECRET_KEY
//
// Usado por:
//   - services/mercadolibreAuth.js
//     (guardar / leer la cuenta de Mercado Libre)
//
// =====================================================

const SUPABASE_URL =
  process.env.SUPABASE_URL;

const SUPABASE_SECRET_KEY =
  process.env.SUPABASE_SECRET_KEY;

export async function supabaseRequest(
  endpoint,
  options = {}
) {

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${endpoint}`,
    {
      ...options,

      headers: {
        apikey: SUPABASE_SECRET_KEY,

        Authorization:
          `Bearer ${SUPABASE_SECRET_KEY}`,

        "Content-Type":
          "application/json",

        ...(options.headers || {})
      }
    }
  );

  const text =
    await response.text();

  let data;

  try {

    data =
      text
        ? JSON.parse(text)
        : null;

  } catch {

    data = text;

  }

  if (!response.ok) {

    const error =
      new Error(
        `Supabase ${response.status}: ${JSON.stringify(data)}`
      );

    error.status =
      response.status;

    error.data =
      data;

    throw error;
  }

  return data;
}
