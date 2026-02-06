import { SlashCommandBuilder, SlashCommandModule, type SlashCommand } from 'reciple';
import KirinClient from '../kirin/KirinClient.js';
import { bold, Colors, InteractionContextType, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { Container, Heading, LineBreak, Separator, SubText, TextDisplay } from '@reciple/jsx';
import type { Server } from '@kirinmc/core';

export class ServersCommand extends SlashCommandModule {
    public data = new SlashCommandBuilder()
        .setName('servers')
        .setDescription('List all servers.')
        .setContexts(InteractionContextType.Guild)
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .toJSON();

    public async execute(data: SlashCommand.ExecuteData): Promise<void> {
        const { interaction } = data;

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const servers = await KirinClient.filterByPermission({
            action: 'view',
            userId: interaction.user.id,
            guildId: interaction.guildId ?? undefined,
            channelId: interaction.channelId,
        });

        if (!servers.size) {
            await interaction.editReply('❌ You do not have permission to view any servers.');
            return;
        }

        await interaction.editReply({
            flags: MessageFlags.IsComponentsV2,
            components: servers.map(server => (
                <Container
                    accentColor={server.ping.latest?.status === 'online' ? Colors.Green : Colors.DarkButNotBlack}
                >
                    <TextDisplay>
                        <Heading level={3}>{server.name || server.id}</Heading>
                        <LineBreak/>
                        <SubText>{this.getStatusEmoji(server.status)} {bold(server.status)}</SubText>
                    </TextDisplay>
                    {
                        server.ping.latest?.motd
                        ? <>
                            <Separator/>
                            <TextDisplay>{server.ping.latest.motd.replace(/§[0-9A-FK-OR]/gi, '')}</TextDisplay>
                        </>
                        : undefined
                    }
                    <TextDisplay>
                        <SubText>ID: {server.id} | {server.type.slice(0, 1).toUpperCase() + server.type.slice(1)} server</SubText>
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