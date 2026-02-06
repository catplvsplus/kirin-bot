import type { Guild } from 'discord.js';
import { ClientEventModule } from 'reciple';
import KirinClient from '../kirin/KirinClient.js';

export class OnGuildDelete extends ClientEventModule<'guildDelete'> {
    public event: 'guildDelete' = 'guildDelete';

    public async onEvent(guild: Guild): Promise<void> {
        await this.cleanServerConfigurations(guild.id);
    }

    public async cleanServerConfigurations(id: string): Promise<void> {
        for (const [_, config] of KirinClient.configurations) {
            const oldStatusMessages = config.data.statusMessages.length;
            const oldLogChannels = config.data.logChannels.length;

            config.data.statusMessages = config.data.statusMessages.filter(m => m.guildId !== id);
            config.data.logChannels = config.data.logChannels.filter(c => c.guildId !== id);

            const newStatusMessages = config.data.statusMessages.length;
            const newLogChannels = config.data.logChannels.length;

            if (oldStatusMessages !== newStatusMessages || oldLogChannels !== newLogChannels) {
                await config.save();
            }
        }
    }
}

export default new OnGuildDelete();