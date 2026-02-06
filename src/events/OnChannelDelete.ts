import type { DMChannel, NonThreadGuildBasedChannel } from 'discord.js';
import { ClientEventModule } from 'reciple';
import KirinClient from '../kirin/KirinClient.js';

export class OnChannelDelete extends ClientEventModule<'channelDelete'> {
    public event: 'channelDelete' = 'channelDelete';

    public async onEvent(channel: DMChannel | NonThreadGuildBasedChannel): Promise<void> {
        await this.cleanServerConfigurations(channel.id);
    }

    public async cleanServerConfigurations(id: string): Promise<void> {
        for (const [_, config] of KirinClient.configurations) {
            const oldStatusMessages = config.data.statusMessages.length;
            const oldLogChannels = config.data.logChannels.length;

            config.data.statusMessages = config.data.statusMessages.filter(m => m.channelId !== id);
            config.data.logChannels = config.data.logChannels.filter(c => c.channelId !== id);

            const newStatusMessages = config.data.statusMessages.length;
            const newLogChannels = config.data.logChannels.length;

            if (oldStatusMessages !== newStatusMessages || oldLogChannels !== newLogChannels) {
                await config.save();
            }
        }
    }
}

export default new OnChannelDelete();