-- Phase 7A: read-only worksheet storage audit
-- Project: fiieuiktlsivwfgyivai
-- Date: 2026-07-29
--
-- Safety: every statement in this file is SELECT-only.
-- It does not alter rows, schemas, policies, functions, or storage objects.

-- 1. Confirm the worksheets schema.
select ordinal_position, column_name, data_type, udt_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'worksheets'
order by ordinal_position;

-- 2. Overall migration population, storage footprint, URL state, and affected columns.
with scanned as (
  select
    user_id,
    created_at,
    updated_at,
    title,
    worksheet_type,
    pg_column_size(w) as row_bytes,
    (to_jsonb(w)::text like '%data:image/%;base64,%') as has_embedded_image,
    (to_jsonb(w)::text like '%https://worksheet-assets.willenaenglish.com/assets/%') as has_r2_asset_url,
    (coalesce(images, '') like '%data:image/%;base64,%') as base64_in_images,
    (coalesce(image_data, '') like '%data:image/%;base64,%') as base64_in_image_data,
    (coalesce(settings::text, '') like '%data:image/%;base64,%') as base64_in_settings,
    (coalesce(words::text, '') like '%data:image/%;base64,%') as base64_in_words,
    (coalesce(sentences::text, '') like '%data:image/%;base64,%') as base64_in_sentences,
    (coalesce(questions, '') like '%data:image/%;base64,%') as base64_in_questions,
    (coalesce(answers, '') like '%data:image/%;base64,%') as base64_in_answers,
    (coalesce(notes, '') like '%data:image/%;base64,%') as base64_in_notes,
    (coalesce(passage_text, '') like '%data:image/%;base64,%') as base64_in_passage_text
  from public.worksheets w
)
select
  count(*) as total_rows,
  count(*) filter (where has_embedded_image) as rows_with_base64,
  count(*) filter (where has_r2_asset_url) as rows_with_r2_urls,
  count(*) filter (where has_embedded_image and has_r2_asset_url) as mixed_rows,
  count(*) filter (where not has_embedded_image and not has_r2_asset_url) as rows_without_detected_images,
  sum(row_bytes) as total_row_bytes,
  sum(row_bytes) filter (where has_embedded_image) as base64_row_bytes,
  max(row_bytes) as largest_row_bytes,
  round(avg(row_bytes)) as average_row_bytes,
  count(*) filter (where base64_in_images) as base64_rows_images,
  count(*) filter (where base64_in_image_data) as base64_rows_image_data,
  count(*) filter (where base64_in_settings) as base64_rows_settings,
  count(*) filter (where base64_in_words) as base64_rows_words,
  count(*) filter (where base64_in_sentences) as base64_rows_sentences,
  count(*) filter (where base64_in_questions) as base64_rows_questions,
  count(*) filter (where base64_in_answers) as base64_rows_answers,
  count(*) filter (where base64_in_notes) as base64_rows_notes,
  count(*) filter (where base64_in_passage_text) as base64_rows_passage_text
from scanned;

-- 3. Migration population by worksheet type.
with scanned as (
  select
    coalesce(nullif(worksheet_type, ''), '(blank)') as worksheet_type,
    pg_column_size(w) as row_bytes,
    (to_jsonb(w)::text like '%data:image/%;base64,%') as has_base64,
    (to_jsonb(w)::text like '%https://worksheet-assets.willenaenglish.com/assets/%') as has_r2
  from public.worksheets w
)
select
  worksheet_type,
  count(*) as total_rows,
  count(*) filter (where has_base64) as base64_rows,
  count(*) filter (where has_r2) as r2_rows,
  sum(row_bytes) filter (where has_base64) as base64_row_bytes,
  max(row_bytes) filter (where has_base64) as largest_base64_row_bytes
from scanned
group by worksheet_type
order by base64_rows desc, total_rows desc, worksheet_type;

-- 4. Image-reference inventory and content-level deduplication estimate.
-- md5 is used here only as a non-security audit fingerprint; Phase 7B should use SHA-256.
with source as (
  select user_id, created_at, title, worksheet_type, to_jsonb(w)::text as doc
  from public.worksheets w
  where to_jsonb(w)::text like '%data:image/%;base64,%'
), extracted as (
  select
    s.user_id,
    s.created_at,
    s.title,
    s.worksheet_type,
    lower(m[1]) as mime_subtype,
    m[2] as payload,
    md5(m[2]) as payload_fingerprint
  from source s
  cross join lateral regexp_matches(
    s.doc,
    'data:image/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/=]+)',
    'g'
  ) as m
)
select
  count(*) as embedded_image_references,
  count(distinct payload_fingerprint) as estimated_unique_images,
  count(*) - count(distinct payload_fingerprint) as duplicate_references,
  sum(length(payload)) as total_base64_characters,
  sum(
    (length(payload) * 3 / 4)
    - case
        when right(payload, 2) = '==' then 2
        when right(payload, 1) = '=' then 1
        else 0
      end
  ) as estimated_decoded_bytes,
  count(*) filter (where mime_subtype = 'png') as png_refs,
  count(*) filter (where mime_subtype in ('jpg', 'jpeg')) as jpeg_refs,
  count(*) filter (where mime_subtype = 'webp') as webp_refs,
  count(*) filter (where mime_subtype = 'gif') as gif_refs
from extracted;

-- 5. Row-size and malformed-marker checks.
with scanned as (
  select
    pg_column_size(w) as row_bytes,
    to_jsonb(w)::text as doc
  from public.worksheets w
), extracted_counts as (
  select
    s.row_bytes,
    s.doc,
    (
      select count(*)
      from regexp_matches(
        s.doc,
        'data:image/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/=]+)',
        'g'
      )
    ) as recognised_images
  from scanned s
)
select
  count(*) filter (
    where doc like '%data:image/%;base64,%'
      and recognised_images = 0
  ) as rows_with_unrecognised_image_data,
  count(*) filter (where row_bytes >= 1000000) as rows_at_least_1mb,
  count(*) filter (where row_bytes >= 3000000) as rows_at_least_3mb,
  count(*) filter (where row_bytes >= 5000000) as rows_at_least_5mb,
  percentile_cont(0.5) within group (order by row_bytes) as median_row_bytes,
  percentile_cont(0.95) within group (order by row_bytes) as p95_row_bytes,
  percentile_cont(0.99) within group (order by row_bytes) as p99_row_bytes
from extracted_counts;
