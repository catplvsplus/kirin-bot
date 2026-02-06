import type { Message, PartialMessage } from 'discord.js';
import { ClientEventModule } from 'reciple';
import KirinClient from '../kirin/KirinClient.js';

export class OnMessageDelete extends ClientEventModule<'messageDelete'> {
    public event: 'messageDelete' = 'messageDelete';

    public async onEvent(message: Message|PartialMessage): Promise<void> {
        if (message.author?.id !== useClient().user?.id) return;

        await this.cleanServerConfigurations(message.id);
    }

    public async cleanServerConfigurations(id: string): Promise<void> {
        for (const [_, config] of KirinClient.configurations) {
            const oldStatusMessages = config.data.statusMessages.length;

            config.data.statusMessages = config.data.statusMessages.filter(m => m.messageId !== id);

            const newStatusMessages = config.data.statusMessages.length;

            if (oldStatusMessages !== newStatusMessages) {
                await config.save();
            }
        }
    }
}

export default new OnMessageDelete();