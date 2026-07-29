#!/usr/bin/env node
'use strict';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://fiieuiktlsivwfgyivai.supabase.co';
const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SECRET) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

async function main() {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/worksheets?select=user_id,title,worksheet_type,images,settings,image_data&worksheet_type=in.(wordtest,flashcard)`,
    { headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}` } }
  );
  const rows = await response.json().catch(() => []);
  if (!response.ok) throw new Error(rows?.message || `Supabase returned HTTP ${response.status}`);

  const offenders = rows.filter(row =>
    /data:image\//i.test(String(row.images || '')) ||
    /data:image\//i.test(JSON.stringify(row.settings || '')) ||
    /data:image\//i.test(String(row.image_data || ''))
  );
  const r2Backed = rows.filter(row =>
    /worksheet-assets\.willenaenglish\.com\/assets\//i.test(String(row.images || '')) ||
    /worksheet-assets\.willenaenglish\.com\/assets\//i.test(JSON.stringify(row.settings || '')) ||
    /worksheet-assets\.willenaenglish\.com\/assets\//i.test(String(row.image_data || ''))
  );

  const summary = {
    checked_at: new Date().toISOString(),
    supported_rows: rows.length,
    r2_backed_rows: r2Backed.length,
    embedded_image_rows: offenders.length,
    offenders: offenders.map(row => ({
      user_id: row.user_id,
      title: row.title,
      worksheet_type: row.worksheet_type
    }))
  };

  console.log(JSON.stringify(summary, null, 2));
  if (offenders.length) {
    console.error(`Storage regression detected: ${offenders.length} worksheet rows contain embedded images.`);
    process.exit(1);
  }
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
