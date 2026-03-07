import type { OmitPartialGroupDMChannel, Message } from 'discord.js';
import { ClientEventModule } from 'reciple';
import KirinClient from '../kirin/KirinClient.js';

export class OnMessegeCreate extends ClientEventModule<'messageCreate'> {
    public event: 'messageCreate' = 'messageCreate';

    public async onEvent(message: OmitPartialGroupDMChannel<Message<boolean>>): Promise<void> {
        if (message.author.bot || message.author.system) return;

        const serverIds = KirinClient.configurations.filter(c => c.logChannels.some(l => l.channelId === message.channelId));
        const servers = KirinClient.kirin.servers.filter(s => serverIds.has(s.id));

        await Promise.all(
            servers.map(async server => {
                if (!server.isRunning) return;

                const config = KirinClient.configurations.get(server.id);
                const hasPermission = await config?.hasPermission({
                    action: 'manage',
                    userId: message.author.id,
                    channelId: message.channelId,
                    guildId: message.guildId ?? undefined
                });

                if (!hasPermission) return;

                server.send(message.content);
            })
        );
    }
}

export default new OnMessegeCreate();