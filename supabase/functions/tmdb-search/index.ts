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

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);

    // Detail endpoint: /tmdb-search/detail/{id}?type=movie|tv
    if (pathParts.includes("detail")) {
      const id = pathParts[pathParts.indexOf("detail") + 1];
      const type = url.searchParams.get("type");

      if (!id || !type || (type !== "movie" && type !== "tv")) {
        return new Response(JSON.stringify({ error: "Missing or invalid id/type" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tmdbUrl = `${TMDB_BASE}/${type}/${id}?api_key=${TMDB_KEY}&language=en-US`;
      const res = await fetch(tmdbUrl);
      const data = await res.json();

      if (!res.ok) {
        return new Response(JSON.stringify({ error: data.status_message || "Not found" }), {
          status: res.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        overview: data.overview,
        vote_average: data.vote_average,
        genres: (data.genres || []).map((g: Record<string, string>) => g.name),
        runtime: data.runtime || data.episode_run_time?.[0] || null,
        poster_path: data.poster_path,
        backdrop_path: data.backdrop_path,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Search endpoint: /tmdb-search?q=...&type=movie|tv
    const query = url.searchParams.get("q");
    const type = url.searchParams.get("type");

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

    const results = (data.results || []).slice(0, 10).map((item: Record<string, unknown>) => ({
      source_id: String(item.id),
      title: type === "movie" ? item.title : item.name,
      year: (type === "movie" ? item.release_date : item.first_air_date as string || "").slice(0, 4) || null,
      poster_path: item.poster_path,
      overview: item.overview,
      vote_average: item.vote_average,
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
