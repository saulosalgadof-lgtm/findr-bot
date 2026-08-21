// =====================================================
// FINDR - SUPABASE SERVICE
// =====================================================
//
// MAPA DEL ARCHIVO
//
// CONFIGURACIÓN
//      ↓
// SUPABASE REQUEST
//      ↓
// CONSTRUIR REQUEST
//      ↓
// EJECUTAR REQUEST
//      ↓
// PARSEAR RESPONSE
//      ↓
// VALIDAR RESPONSE
//      ↓
// RETORNAR DATA
//
// =====================================================


// =====================================================
// CONFIGURACIÓN
// =====================================================

const SUPABASE_URL =
  process.env.SUPABASE_URL;

const SUPABASE_SECRET_KEY =
  process.env.SUPABASE_SECRET_KEY;


// =====================================================
// SUPABASE REQUEST
// =====================================================
//
// Función central para comunicarse con Supabase.
//
// Todos los GET / POST / PATCH / DELETE
// hacia Supabase pasarán por aquí.
//
// =====================================================

export async function supabaseRequest(
  endpoint,
  options = {}
) {

  // ---------------------------------------------------
  // REQUEST
  // ---------------------------------------------------

  const response =
    await fetch(
      `${SUPABASE_URL}/rest/v1/${endpoint}`,
      {

        ...options,

        headers: {

          apikey:
            SUPABASE_SECRET_KEY,

          Authorization:
            `Bearer ${SUPABASE_SECRET_KEY}`,

          "Content-Type":
            "application/json",

          ...(options.headers || {})

        }

      }
    );


  // ---------------------------------------------------
  // PARSE RESPONSE
  // ---------------------------------------------------

  const text =
    await response.text();

  let data;


  try {

    data =
      text
        ? JSON.parse(text)
        : null;

  } catch {

    data =
      text;

  }


  // ---------------------------------------------------
  // VALIDATE RESPONSE
  // ---------------------------------------------------

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


  // ---------------------------------------------------
  // RETURN DATA
  // ---------------------------------------------------

  return data;
}
