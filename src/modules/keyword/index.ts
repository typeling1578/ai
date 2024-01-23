import * as fs from 'fs';
import { bindThis } from '@/decorators.js';
import * as chalk from 'chalk';
import loki from 'lokijs';
import * as which from "which";
import Module from '@/module.js';
import config from '@/config.js';
import serifs from '@/serifs.js';
import { mecab } from './mecab.js';

function kanaToHira(str: string) {
	return str.replace(/[\u30a1-\u30f6]/g, match => {
		const chr = match.charCodeAt(0) - 0x60;
		return String.fromCharCode(chr);
	});
}

export default class extends Module {
	public readonly name = 'keyword';

	private learnedKeywords: loki.Collection<{
		keyword: string;
		learnedAt: number;
	}>;

	@bindThis
	public install() {
		if (!config.keywordEnabled) return {};
		try {
			if (config.mecab) {
				fs.realpathSync(config.mecab);
			} else {
				which.sync("mecab");
			}
		} catch (e) {
			if (e.code === "ENOENT") {
				this.log(chalk.yellow("MeCab not found! keyword feature will be disabled."));
				return {};
			} else {
				throw e;
			}
		}

		this.learnedKeywords = this.ai.getCollection('_keyword_learnedKeywords', {
			indices: ['userId']
		});

		setInterval(this.learn, 1000 * 60 * 60);

		return {};
	}

	@bindThis
	private async learn() {
		const tl = await this.ai.api('notes/local-timeline', {
			limit: 30
		});

		const interestedNotes = tl.filter(note =>
			note.userId !== this.ai.account.id &&
			note.text != null &&
			note.cw == null);

		let keywords: string[][] = [];

		for (const note of interestedNotes) {
			const tokens = await mecab(note.text, config.mecab, config.mecabDic);
			const keywordsInThisNote = tokens.filter(token => token[2] == '固有名詞' && token[8] != null);
			keywords = keywords.concat(keywordsInThisNote);
		}

		if (keywords.length === 0) return;

		const rnd = Math.floor((1 - Math.sqrt(Math.random())) * keywords.length);
		const keyword = keywords.sort((a, b) => a[0].length < b[0].length ? 1 : -1)[rnd];

		const exist = this.learnedKeywords.findOne({
			keyword: keyword[0]
		});

		let text: string;

		if (exist) {
			return;
		} else {
			this.learnedKeywords.insertOne({
				keyword: keyword[0],
				learnedAt: Date.now()
			});

			text = serifs.keyword.learned(keyword[0], kanaToHira(keyword[8]));
		}

		this.ai.post({
			text: text
		});
	}
}
