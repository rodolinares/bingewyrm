create or replace function public.backfill_item_details(
  p_item_id uuid,
  p_vote_average numeric,
  p_genres text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.items
  set vote_average = coalesce(p_vote_average, vote_average),
      genres = case when array_length(p_genres, 1) > 0 then p_genres else genres end
  where id = p_item_id;
end;
$$;
