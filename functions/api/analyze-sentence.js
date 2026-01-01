// Wrapper for Cloudflare Pages Functions default directory
// Delegates to the implementation in cloudflare-workers/api/analyze-sentence.js

import {
	onRequestPost as implOnRequestPost,
	onRequestOptions as implOnRequestOptions,
} from '../../cloudflare-workers/api/analyze-sentence.js';

export async function onRequestPost(context) {
	return implOnRequestPost(context);
}

export async function onRequestOptions(context) {
	return implOnRequestOptions(context);
}

