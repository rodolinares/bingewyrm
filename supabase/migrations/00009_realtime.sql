-- Enable Supabase Realtime on sessions and items tables
-- sessions: notify when session ends (status change)
-- items: notify when a new item is added to a watchlist

ALTER PUBLICATION supabase_realtime ADD TABLE sessions, items;
