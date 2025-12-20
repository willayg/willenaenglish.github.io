// Guest mode has been removed (accounts-only).
const { getCorsHeaders, handleCorsPreflightIfNeeded } = require('./lib/cors');

exports.handler = async (event) => {
	const preflightResponse = handleCorsPreflightIfNeeded(event);
	if (preflightResponse) return preflightResponse;

	return {
		statusCode: 410,
		headers: {
			...getCorsHeaders(event || {}),
			'content-type': 'application/json; charset=utf-8',
			'cache-control': 'no-store',
		},
		body: JSON.stringify({ success: false, error: 'Guest mode disabled' }),
	};
};
