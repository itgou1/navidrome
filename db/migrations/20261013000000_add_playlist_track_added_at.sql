-- +goose Up
-- Existing entries have an unknown addition time; do not backfill with migration time.
alter table playlist_tracks add column added_at datetime;
create index playlist_tracks_added_at on playlist_tracks (playlist_id, added_at, id);

-- +goose Down
drop index playlist_tracks_added_at;
alter table playlist_tracks drop column added_at;
