// students/scripts/api-base.js
const H = location.hostname;
const IS_NETLIFY = /netlify\.(app|dev)$/i.test(H);
const IS_LOCAL   = /^(localhost|127\.0\.0\.1)$/i.test(H);
export const FUNCTIONS_BASE = (IS_NETLIFY || IS_LOCAL) ? '' : '';
export const FN = (name) => `${FUNCTIONS_BASE}/.netlify/functions/${name}`;
