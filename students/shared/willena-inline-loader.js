// Shared compact Willena inline loader.
// Import the CSS separately:
// /students/shared/willena-inline-loader.css

export function willenaInlineLoaderMarkup({label='Loading'}={}){
  const safe=String(label??'Loading').replace(/[&<>"']/g,char=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[char]));
  return '<span class="willena-inline-loader" role="status" aria-label="'+safe+'">'+
    '<span class="willena-inline-loader-ring" aria-hidden="true"></span>'+
    '<span class="willena-inline-loader-dot" aria-hidden="true"></span>'+
  '</span>';
}
