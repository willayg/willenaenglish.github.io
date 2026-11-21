-- Published catalog availability checks for every Genius skill and whole-book puzzle vocabulary
-- Applied to project gxwfsqxyuufqtitspfqg on 2026-11-21.
CREATE OR REPLACE FUNCTION public.teacher_curriculum_content_availability_v1(p_book_ids uuid[])
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
with requested as (
 select b.id from public.content_books b
 where b.id=any(coalesce(p_book_ids,array[]::uuid[]))
 and b.status in ('review','published')
 and cardinality(coalesce(p_book_ids,array[]::uuid[])) between 1 and 100
),
units as (
 select u.id,u.book_id,u.unit_number from public.content_units u
 join requested b on b.id=u.book_id where u.status in ('review','published')
),
word_sources as (
 select u.book_id,u.id unit_id,t.lexical_entry_id lexical_id
 from units u join public.unit_vocab_targets t on t.unit_id=u.id and t.active=true
 union
 select u.book_id,u.id unit_id,o.lexical_entry_id lexical_id
 from units u join public.source_content_occurrences o on o.unit_id=u.id
 where o.lexical_entry_id is not null and o.status in ('review','published')
 and o.occurrence_type='lexical_entry'
 union
 select c.book_id,c.unit_id,i.content_id lexical_id
 from public.collections c join requested b on b.id=c.book_id
 join public.collection_items i on i.collection_id=c.id and i.content_type='lexical_entry'
 where c.collection_type='word_builder'
),
playable_words as (
 select w.book_id,w.unit_id,l.id lexical_id,
 upper(regexp_replace(coalesce(l.canonical_text,''),'[^A-Za-z]','','g')) clean
 from word_sources w join public.lexical_entries l on l.id=w.lexical_id
 where l.status in ('review','published')
),
vocab as (
 select unit_id,count(distinct lexical_id) n from playable_words
 where unit_id is not null and clean<>'' group by unit_id
),
book_puzzles as (
 select book_id,count(distinct lexical_id) n from playable_words
 where char_length(clean) between 3 and 14 group by book_id
),
sentence_source as (
 select u.id unit_id,o.sentence_id as source_sentence_id,
 trim(coalesce(nullif(s.canonical_text,''),s.text,'')) en,
 trim(coalesce(s.translation_ko,'')) ko
 from units u
 join public.source_content_occurrences o on o.unit_id=u.id
 and o.sentence_id is not null and o.status in ('review','published')
 join public.sentences s on s.id=o.sentence_id and s.status in ('review','published')
 where
 (o.source_key !~ '^eu3e[0-9]+:' or
 (o.status='published' and o.source_key ~ '^eu3e[0-9]+:(aligned-sentence:unit:|sentence-occurrence:)'))
),
sentences as (
 select unit_id,
 count(distinct source_sentence_id) filter(where en<>'' and ko<>'') n,
 count(distinct source_sentence_id) filter(where en<>'' and ko<>''
   and length(en)<=140 and length(ko)<=175
   and cardinality(regexp_split_to_array(en,'[[:space:]]+')) between 3 and 19
   and en ~ '[.!?]$' and en !~ '^[[:space:]]*["''“”‘’—–-]'
   and en !~* '^[[:space:]]*because[[:space:]]'
 ) writing_n
 from sentence_source group by unit_id
),
grammar as (
 select u.id unit_id,count(distinct g.question_id) n
 from units u join public.grammar_coursebook_live_questions g
 on g.book_id=u.book_id and g.unit_number=u.unit_number
 where g.status='published' group by u.id
),
talking as (
 select u.id unit_id,count(distinct q.id) n
 from units u join public.free_talking_questions q on q.unit_id=u.id
 where q.is_published=true and nullif(trim(coalesce(q.question_en,'')),'') is not null
 group by u.id
)
select coalesce(jsonb_agg(jsonb_build_object(
 'bookId',u.book_id,'unitId',u.id,'unitNumber',u.unit_number,
 'word',coalesce(v.n,0),'sentence',coalesce(s.n,0),
 'grammar',coalesce(g.n,0),'speaking',coalesce(t.n,0),
 'freeconversation',coalesce(t.n,0),'writing',coalesce(s.writing_n,0),
 'puzzles',coalesce(bp.n,0)
) order by u.book_id,u.unit_number),'[]'::jsonb)
from units u
left join vocab v on v.unit_id=u.id
left join sentences s on s.unit_id=u.id
left join grammar g on g.unit_id=u.id
left join talking t on t.unit_id=u.id
left join book_puzzles bp on bp.book_id=u.book_id;
$function$;
REVOKE ALL ON FUNCTION public.teacher_curriculum_content_availability_v1(uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_curriculum_content_availability_v1(uuid[]) TO anon,authenticated,service_role;
