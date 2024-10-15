import { bindThis } from '@/decorators.js';
import Module from '@/module.js';
import Message from '@/message.js';

export default class extends Module {
	public readonly name = 'follow';

	@bindThis
	public install() {
		return {
			mentionHook: this.mentionHook
		};
	}

	@bindThis
	private async mentionHook(msg: Message) {
		if (msg.text && msg.includes(['フォロー', 'フォロバ', 'follow me'])) {
			const user = await this.ai.api('users/show', {
				userId: msg.userId
			});
			if (!user.isFollowing) {
				if (msg.friend.love >= 0.1) {
					this.ai.api('following/create', {
						userId: msg.userId,
					});
				}
				return {
					reaction: msg.friend.love >= 1 ? 'like' : null
				};
			} else {
				return {
					reaction: msg.friend.love >= 0 ? 'hmm' : null
				};
			}
		} else {
			return false;
		}
	}
}
