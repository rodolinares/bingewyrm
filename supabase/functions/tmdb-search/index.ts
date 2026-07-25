import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_KEY = Deno.env.get("TMDB_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!TMDB_KEY) {
    return new Response(JSON.stringify({ error: "TMDB_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Require authenticated user
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    const query = url.searchParams.get("q");
    const type = url.searchParams.get("type"); // "movie" or "tv"

    if (!query || !type) {
      return new Response(JSON.stringify({ error: "Missing q or type param" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (type !== "movie" && type !== "tv") {
      return new Response(JSON.stringify({ error: "type must be movie or tv" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tmdbUrl = `${TMDB_BASE}/search/${type}?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`;

    const res = await fetch(tmdbUrl);
    const data = await res.json();

    // Map to a lean shape the client needs
    const results = (data.results || []).slice(0, 10).map((item: Record<string, unknown>) => ({
      source_id: String(item.id),
      title: type === "movie" ? item.title : item.name,
      year: (type === "movie" ? item.release_date : item.first_air_date as string || "").slice(0, 4) || null,
      poster_path: item.poster_path,
      overview: item.overview,
    }));

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
