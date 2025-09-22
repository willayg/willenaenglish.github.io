// Minimal mode registry for mini player.
// Extend this object as additional modes are activated.

export const modeRegistry = {
	// Key: loader returning an object with run() function or direct function
	'multi_choice_eng_to_kor': async () => {
		const mod = await import('../modes/multi_choice_eng_to_kor.js');
		return {
			run: (ctx) => mod.runMultiChoiceEngToKor(ctx)
		};
	},
	'picture_multi_choice': async () => {
		const mod = await import('../modes/picture_multi_choice.js');
		return { run: (ctx) => mod.runPictureMultiChoice(ctx) };
	},
	'listening_multi_choice': async () => {
		const mod = await import('../modes/listening_multi_choice.js');
		return { run: (ctx) => mod.runListeningMultiChoice(ctx) };
	},
	'listening': async () => {
		// Hybrid listening mode that alternates picture vs Korean meaning questions per word
		const mod = await import('../modes/listening.js');
		return { run: (ctx) => mod.runListeningMode(ctx) };
	},
	'multi_choice': async () => {
		const mod = await import('../modes/multi_choice.js');
		return { run: (ctx) => mod.runMultiChoiceMode(ctx) };
	},
	// Newly enabled modes
	'multi_choice_kor_to_eng': async () => {
		const mod = await import('../modes/multi_choice_kor_to_eng.js');
		return { run: (ctx) => mod.runMultiChoiceKorToEng(ctx) };
	},
	'easy_picture': async () => {
		const mod = await import('../modes/easy_picture.js');
		return { run: (ctx) => mod.runEasyPictureMode(ctx) };
	},
	'listen_and_spell': async () => {
		const mod = await import('../modes/listen_and_spell.js');
		return { run: (ctx) => mod.run(ctx) };
	},
	'spelling': async () => {
		const mod = await import('../modes/spelling.js');
		return { run: (ctx) => mod.run(ctx) };
	},
	'level_up': async () => {
		const mod = await import('../modes/level_up.js');
		return { run: (ctx) => mod.runLevelUpMode(ctx) };
	},
	'meaning': async () => {
		// Legacy loader now points to legacy wrapper which delegates to matching core
		const mod = await import('../modes/meaning.js');
		return { run: (ctx) => mod.runMeaningMode(ctx) };
	},
	'matching': async () => {
		const mod = await import('../modes/matching.js');
		return { run: (ctx) => mod.run(ctx) };
	},
	'full_arcade': async () => {
		const mod = await import('../modes/full_arcade.js');
		return { run: (ctx) => mod.run(ctx) };
	},
};

export async function loadMode(key) {
	const loader = modeRegistry[key];
	if (!loader) throw new Error('Unknown mode: ' + key);
	return loader();
}
