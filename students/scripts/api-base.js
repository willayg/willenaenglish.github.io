// students/scripts/api-base.js
// Use Netlify dev (8888) when UI runs on 9000 in localhost; otherwise same-origin
const FUNCTIONS_BASE = (typeof window !== 'undefined'
	&& window.location
	&& window.location.hostname === 'localhost'
	&& window.location.port === '9000')
	? 'http://localhost:8888'
	: '';
export const FN = (name) => `${FUNCTIONS_BASE}/.netlify/functions/${name}`;
