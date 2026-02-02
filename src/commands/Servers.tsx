import { SlashCommandBuilder, SlashCommandModule, type SlashCommand } from 'reciple';
import KirinClient from '../kirin/KirinClient.js';
import { bold, Colors, MessageFlags } from 'discord.js';
import { Container, Separator, TextDisplay } from '@reciple/jsx';
import type { Server } from '@kirinmc/core';

export class ServersCommand extends SlashCommandModule {
    public data = new SlashCommandBuilder()
        .setName('servers')
        .setDescription('List all servers.')
        .toJSON();

    public async execute(data: SlashCommand.ExecuteData): Promise<void> {
        const { interaction } = data;

        const servers = KirinClient.kirin.servers;

        await interaction.reply({
            flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
            components: servers.map(server => (
                <Container
                    accentColor={server.ping.latest?.status === 'online' ? Colors.Green : Colors.DarkButNotBlack}
                >
                    <TextDisplay>
                        {`### ${server.name || server.id}\n`}
                        {`-# ${this.getStatusEmoji(server.status)} ${bold(server.status)}`}
                    </TextDisplay>
                    {
                        server.ping.latest?.motd
                        ? <>
                            <Separator/>
                            <TextDisplay>{server.ping.latest.motd.replace(/§[0-9A-FK-OR]/gi, '')}</TextDisplay>
                            <Separator/>
                        </>
                        : undefined
                    }
                    <TextDisplay>
                        -# ID: {server.id} | {server.type.slice(0, 1).toUpperCase() + server.type.slice(1)} server
                    </TextDisplay>
                </Container>
            ))
        });
    }

    public getStatusEmoji(status: Server.Status): string {
        switch (status) {
            case 'online':
                return '🟢';
            case 'offline':
                return '🔴';
            case 'stopping':
                return '🟠';
            case 'starting':
                return '🟡';
            default:
                return '⚫';
        }
    }
}

export default new ServersCommand();