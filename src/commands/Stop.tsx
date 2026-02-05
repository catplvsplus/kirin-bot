import { InteractionListenerBuilder, InteractionListenerType, type InteractionListenerData } from '@reciple/modules';
import { SlashCommandBuilder, SlashCommandModule, type SlashCommand } from 'reciple';
import { inlineCode, InteractionContextType, MessageFlags, PermissionFlagsBits } from 'discord.js';
import KirinClient from '../kirin/KirinClient.js';

export class StopCommand extends SlashCommandModule {
    public data = new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stops a running server.')
        .setContexts(InteractionContextType.Guild)
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(server => server
            .setName('server')
            .setDescription('The target server to stop.')
            .setAutocomplete(true)
            .setRequired(true)
        )
        .toJSON();

    public interactions: InteractionListenerData[] = [
        new InteractionListenerBuilder()
            .setType(InteractionListenerType.Autocomplete)
            .setFilter(interaction => interaction.commandName === 'stop')
            .setExecute(async interaction => {
                const query = interaction.options.getFocused().toLowerCase();
                const servers = await KirinClient.filterByPermission({
                    servers: KirinClient.filterServers({
                        query,
                        isRunning: true
                    }),
                    action: 'stop',
                    userId: interaction.user.id,
                    guildId: interaction.guildId ?? undefined,
                    channelId: interaction.channelId
                });

                await interaction.respond(
                    servers
                        .map(s => ({ name: s.name || s.id, value: s.id }))
                        .splice(0, 25)
                );
            })
            .toJSON()
    ];

    public async execute(data: SlashCommand.ExecuteData): Promise<void> {
        const { interaction } = data;

        const server = KirinClient.kirin.get(interaction.options.getString('server', true));
        const config = KirinClient.configurations.get(server?.id ?? '');

        if (!server) {
            await interaction.reply('❌ Server not found.');
            return;
        }

        if (!server.isRunning) {
            await interaction.reply('❌ Server is already stopped.');
            return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const hasPermission = await config?.hasPermission({
            action: 'stop',
            userId: interaction.user.id,
            channelId: interaction.channelId,
            guildId: interaction.guildId ?? undefined
        });

        if (!hasPermission) {
            await interaction.editReply('❌ You do not have permission to stop this server.');
            return;
        }

        await interaction.editReply('⌛ Server is stopping...');

        const exitCode = await server.stop();

        await interaction.editReply({
            content: !exitCode
                ? `✅ Server stopped successfully.`
                : `❌ Server closed with exit code ${inlineCode(String(exitCode))}.`
        }).catch(() => null);
    }
}

export default new StopCommand();