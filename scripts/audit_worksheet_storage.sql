-- Read-only worksheet storage audit
-- Safe to run in Supabase SQL Editor. This script performs SELECT queries only.
-- It identifies embedded worksheet images, duplicate assets and projected savings.

-- 1. Table/column shape
select column_name, data_type, udt_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'worksheets'
order by ordinal_position;

-- 2. Storage by worksheet type and field
with w as (
  select *,
    coalesce(octet_length(images::text), 0) as images_b,
    coalesce(octet_length(settings::text), 0) as settings_b,
    coalesce(octet_length(image_data::text), 0) as image_data_b,
    coalesce(octet_length(words::text), 0) as words_b,
    coalesce(octet_length(questions::text), 0) as questions_b,
    coalesce(octet_length(answers::text), 0) as answers_b,
    coalesce(octet_length(passage_text::text), 0) as passage_b
  from public.worksheets
)
select
  coalesce(worksheet_type, '(null)') as worksheet_type,
  count(*) as rows,
  count(*) filter (where images::text like '%data:image/%') as images_with_data_url,
  count(*) filter (where settings::text like '%data:image/%') as settings_with_data_url,
  count(*) filter (where image_data::text like '%data:image/%') as image_data_with_data_url,
  count(*) filter (where images::text like '%http%') as images_with_http,
  count(*) filter (where settings::text like '%http%') as settings_with_http,
  sum(images_b) as images_bytes,
  sum(settings_b) as settings_bytes,
  sum(image_data_b) as image_data_bytes,
  sum(words_b + questions_b + answers_b + passage_b) as core_text_bytes
from w
group by worksheet_type
order by sum(images_b + settings_b + image_data_b + words_b + questions_b + answers_b + passage_b) desc;

-- 3. Extract and hash every valid embedded base64 image
with source as (
  select user_id as worksheet_id, worksheet_type, 'images' as field_name, coalesce(images::text, '') as payload
  from public.worksheets
  union all
  select user_id, worksheet_type, 'settings', coalesce(settings::text, '')
  from public.worksheets
  union all
  select user_id, worksheet_type, 'image_data', coalesce(image_data::text, '')
  from public.worksheets
), matches as (
  select
    worksheet_id,
    worksheet_type,
    field_name,
    m[1] as mime,
    m[2] as b64
  from source,
  lateral regexp_matches(
    payload,
    'data:(image/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)',
    'g'
  ) as m
), hashed as (
  select
    *,
    md5(b64) as asset_hash,
    length(b64) as base64_chars,
    floor(length(regexp_replace(b64, '=+$', '')) * 3.0 / 4.0)::bigint as estimated_binary_bytes
  from matches
)
select
  count(*) as embedded_occurrences,
  count(distinct worksheet_id) as affected_worksheets,
  count(distinct asset_hash) as unique_assets,
  sum(base64_chars) as total_base64_chars,
  sum(estimated_binary_bytes) as estimated_binary_bytes,
  sum(base64_chars) - sum(estimated_binary_bytes) as base64_overhead_bytes,
  count(*) - count(distinct asset_hash) as duplicate_occurrences
from hashed;

-- 4. Embedded assets by worksheet type and field
with source as (
  select user_id as worksheet_id, worksheet_type, 'images' as field_name, coalesce(images::text, '') as payload
  from public.worksheets
  union all
  select user_id, worksheet_type, 'settings', coalesce(settings::text, '')
  from public.worksheets
  union all
  select user_id, worksheet_type, 'image_data', coalesce(image_data::text, '')
  from public.worksheets
), matches as (
  select worksheet_id, worksheet_type, field_name, m[1] as mime, m[2] as b64
  from source,
  lateral regexp_matches(
    payload,
    'data:(image/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)',
    'g'
  ) as m
), hashed as (
  select *, md5(b64) as asset_hash, length(b64) as base64_chars
  from matches
)
select
  coalesce(worksheet_type, '(null)') as worksheet_type,
  field_name,
  count(*) as occurrences,
  count(distinct worksheet_id) as affected_rows,
  count(distinct asset_hash) as unique_assets,
  count(*) - count(distinct asset_hash) as duplicate_occurrences,
  sum(base64_chars) as base64_chars
from hashed
group by worksheet_type, field_name
order by sum(base64_chars) desc;

-- 5. Asset formats
with source as (
  select coalesce(images::text, '') as payload from public.worksheets
  union all select coalesce(settings::text, '') from public.worksheets
  union all select coalesce(image_data::text, '') from public.worksheets
), matches as (
  select m[1] as mime, m[2] as b64
  from source,
  lateral regexp_matches(
    payload,
    'data:(image/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)',
    'g'
  ) as m
)
select
  mime,
  count(*) as occurrences,
  count(distinct md5(b64)) as unique_assets,
  sum(length(b64)) as base64_chars
from matches
group by mime
order by sum(length(b64)) desc;

-- 6. Validate that every data:image marker is parseable
with w as (
  select
    user_id as worksheet_id,
    coalesce(images, '') as images_t,
    coalesce(settings::text, '') as settings_t,
    coalesce(image_data, '') as image_data_t
  from public.worksheets
), counts as (
  select *,
    (length(images_t) - length(replace(images_t, 'data:image/', ''))) / length('data:image/') as images_markers,
    (length(settings_t) - length(replace(settings_t, 'data:image/', ''))) / length('data:image/') as settings_markers,
    (length(image_data_t) - length(replace(image_data_t, 'data:image/', ''))) / length('data:image/') as image_data_markers,
    (select count(*) from regexp_matches(images_t, 'data:image/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+', 'g')) as images_valid,
    (select count(*) from regexp_matches(settings_t, 'data:image/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+', 'g')) as settings_valid,
    (select count(*) from regexp_matches(image_data_t, 'data:image/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+', 'g')) as image_data_valid
  from w
)
select
  count(*) as total_rows,
  count(*) filter (where images_markers + settings_markers + image_data_markers > 0) as rows_with_embedded_images,
  sum(images_markers + settings_markers + image_data_markers) as data_image_markers,
  sum(images_valid + settings_valid + image_data_valid) as valid_base64_images,
  sum(
    (images_markers - images_valid)
    + (settings_markers - settings_valid)
    + (image_data_markers - image_data_valid)
  ) as malformed_or_nonbase64_markers,
  count(*) filter (
    where (images_markers - images_valid)
      + (settings_markers - settings_valid)
      + (image_data_markers - image_data_valid) > 0
  ) as rows_needing_manual_parser
from counts;

-- 7. Flashcard cross-field duplication
with source as (
  select user_id as worksheet_id, 'images' as field_name, coalesce(images::text, '') as payload
  from public.worksheets where worksheet_type = 'flashcard'
  union all
  select user_id, 'settings', coalesce(settings::text, '')
  from public.worksheets where worksheet_type = 'flashcard'
), matches as (
  select worksheet_id, field_name, md5(m[2]) as asset_hash, length(m[2]) as base64_chars
  from source,
  lateral regexp_matches(
    payload,
    'data:(image/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)',
    'g'
  ) as m
), by_row as (
  select
    worksheet_id,
    count(*) filter (where field_name = 'images') as images_occurrences,
    count(*) filter (where field_name = 'settings') as settings_occurrences,
    count(distinct asset_hash) filter (where field_name = 'images') as images_unique,
    count(distinct asset_hash) filter (where field_name = 'settings') as settings_unique,
    count(distinct asset_hash) as union_unique,
    sum(base64_chars) filter (where field_name = 'images') as images_chars,
    sum(base64_chars) filter (where field_name = 'settings') as settings_chars
  from matches
  group by worksheet_id
)
select
  count(*) as affected_flashcards,
  sum(images_occurrences) as images_occurrences,
  sum(settings_occurrences) as settings_occurrences,
  sum((images_unique + settings_unique) - union_unique) as duplicated_across_fields,
  sum(images_chars) as images_chars,
  sum(settings_chars) as settings_chars
from by_row;
