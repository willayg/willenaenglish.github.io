-- Read-only worksheet storage audit
-- Safe to run in Supabase SQL Editor. This file performs SELECT queries only.

-- 1. Overall logical payload sizes
select
  count(*) as total_rows,
  sum(octet_length(coalesce(images::text, ''))) as images_bytes,
  sum(octet_length(coalesce(settings::text, ''))) as settings_bytes,
  sum(octet_length(coalesce(image_data::text, ''))) as image_data_bytes,
  sum(octet_length(coalesce(words::text, ''))) as words_bytes,
  sum(octet_length(coalesce(questions::text, ''))) as questions_bytes,
  sum(octet_length(coalesce(answers::text, ''))) as answers_bytes
from public.worksheets;

-- 2. Embedded image inventory by worksheet type and field
with fields as (
  select user_id, worksheet_type, 'images' as field_name, coalesce(images::text, '') as payload
  from public.worksheets
  union all
  select user_id, worksheet_type, 'settings', coalesce(settings::text, '')
  from public.worksheets
  union all
  select user_id, worksheet_type, 'image_data', coalesce(image_data::text, '')
  from public.worksheets
), matches as (
  select
    user_id,
    worksheet_type,
    field_name,
    m[1] as data_url
  from fields
  cross join lateral regexp_matches(
    payload,
    '(data:image/[^;"''\\]+;base64,[A-Za-z0-9+/=\\r\\n]+)',
    'g'
  ) m
)
select
  worksheet_type,
  field_name,
  count(distinct user_id) as rows_with_data_urls,
  count(*) as data_url_occurrences,
  sum(octet_length(data_url)) as embedded_bytes,
  count(distinct md5(data_url)) as unique_data_urls
from matches
group by worksheet_type, field_name
order by embedded_bytes desc;

-- 3. Exact duplicate image inventory
with fields as (
  select user_id, worksheet_type, 'images' as field_name, coalesce(images::text, '') as payload
  from public.worksheets
  union all
  select user_id, worksheet_type, 'settings', coalesce(settings::text, '')
  from public.worksheets
), matches as (
  select
    user_id,
    worksheet_type,
    field_name,
    md5(m[1]) as image_hash,
    octet_length(m[1]) as bytes
  from fields
  cross join lateral regexp_matches(
    payload,
    '(data:image/[^;"''\\]+;base64,[A-Za-z0-9+/=\\r\\n]+)',
    'g'
  ) m
), per_hash as (
  select
    worksheet_type,
    image_hash,
    max(bytes) as bytes,
    count(*) as occurrences,
    count(distinct user_id) as worksheets,
    count(distinct field_name) as fields
  from matches
  group by worksheet_type, image_hash
)
select
  worksheet_type,
  count(*) as unique_images,
  sum(occurrences) as total_occurrences,
  sum(bytes) as unique_image_bytes,
  sum(bytes * occurrences) as occurrence_bytes,
  sum(bytes * (occurrences - 1)) as duplicate_bytes,
  count(*) filter (where occurrences > 1) as repeated_unique_images,
  count(*) filter (where fields > 1) as repeated_across_fields
from per_hash
group by worksheet_type
order by occurrence_bytes desc;

-- 4. Migration classification
with base as (
  select
    user_id,
    coalesce(worksheet_type, '(null)') as worksheet_type,
    coalesce(images::text, '') as images,
    coalesce(settings::text, '') as settings,
    coalesce(image_data::text, '') as image_data,
    octet_length(coalesce(images::text, ''))
      + octet_length(coalesce(settings::text, ''))
      + octet_length(coalesce(image_data::text, ''))
      + octet_length(coalesce(words::text, ''))
      + octet_length(coalesce(questions::text, ''))
      + octet_length(coalesce(answers::text, ''))
      + octet_length(coalesce(passage_text::text, ''))
      + octet_length(coalesce(layout::text, '')) as logical_bytes
  from public.worksheets
), stats as (
  select
    b.*,
    regexp_count(images, 'data:image/') as images_data_count,
    regexp_count(settings, 'data:image/') as settings_data_count,
    regexp_count(image_data, 'data:image/') as image_data_count,
    regexp_count(images, 'https?://') as images_url_count,
    regexp_count(settings, 'https?://') as settings_url_count,
    case when images = '' then true else pg_input_is_valid(images, 'jsonb') end as images_valid_json,
    case when settings = '' then true else pg_input_is_valid(settings, 'jsonb') end as settings_valid_json
  from base b
), classified as (
  select
    *,
    case
      when worksheet_type = 'wordtest' and images_data_count > 0 and images_valid_json then 'wordtest_auto'
      when worksheet_type = 'wordtest' and images_data_count = 0 then 'wordtest_no_embedded'
      when worksheet_type = 'flashcard' and (images_data_count + settings_data_count) > 0 then 'flashcard_specialist'
      when worksheet_type = 'flashcard' then 'flashcard_no_embedded'
      when (images_data_count + settings_data_count + image_data_count) > 0 then 'other_manual_review'
      else 'no_media_migration'
    end as migration_class
  from stats
)
select
  migration_class,
  count(*) as rows,
  sum(logical_bytes) as logical_bytes,
  sum(images_data_count + settings_data_count + image_data_count) as embedded_occurrences,
  sum(images_url_count + settings_url_count) as url_occurrences,
  count(*) filter (where not images_valid_json) as invalid_images_json,
  count(*) filter (where not settings_valid_json) as invalid_settings_json
from classified
group by migration_class
order by logical_bytes desc;

-- 5. Per-row migration report. Does not expose base64 contents.
with base as (
  select
    user_id,
    title,
    coalesce(worksheet_type, '(null)') as worksheet_type,
    coalesce(images::text, '') as images,
    coalesce(settings::text, '') as settings,
    coalesce(image_data::text, '') as image_data,
    octet_length(coalesce(images::text, ''))
      + octet_length(coalesce(settings::text, ''))
      + octet_length(coalesce(image_data::text, ''))
      + octet_length(coalesce(words::text, ''))
      + octet_length(coalesce(questions::text, ''))
      + octet_length(coalesce(answers::text, ''))
      + octet_length(coalesce(passage_text::text, ''))
      + octet_length(coalesce(layout::text, '')) as logical_bytes
  from public.worksheets
), stats as (
  select
    *,
    regexp_count(images, 'data:image/') as images_data_count,
    regexp_count(settings, 'data:image/') as settings_data_count,
    regexp_count(image_data, 'data:image/') as image_data_count,
    regexp_count(images, 'https?://') as images_url_count,
    regexp_count(settings, 'https?://') as settings_url_count,
    case when images = '' then true else pg_input_is_valid(images, 'jsonb') end as images_valid_json,
    case when settings = '' then true else pg_input_is_valid(settings, 'jsonb') end as settings_valid_json
  from base
)
select
  user_id as worksheet_id,
  title,
  worksheet_type,
  logical_bytes,
  images_data_count,
  settings_data_count,
  image_data_count,
  images_url_count,
  settings_url_count,
  images_valid_json,
  settings_valid_json,
  case
    when worksheet_type = 'wordtest' and images_data_count > 0 and images_valid_json then 'wordtest_auto'
    when worksheet_type = 'wordtest' and images_data_count = 0 then 'wordtest_no_embedded'
    when worksheet_type = 'flashcard' and (images_data_count + settings_data_count) > 0 then 'flashcard_specialist'
    when worksheet_type = 'flashcard' then 'flashcard_no_embedded'
    when (images_data_count + settings_data_count + image_data_count) > 0 then 'other_manual_review'
    else 'no_media_migration'
  end as migration_class
from stats
order by logical_bytes desc;