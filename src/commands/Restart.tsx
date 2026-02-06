import { InteractionListenerBuilder, InteractionListenerType, type InteractionListenerData } from '@reciple/modules';
import { SlashCommandBuilder, SlashCommandModule, type SlashCommand } from 'reciple';
import { InteractionContextType, MessageFlags, PermissionFlagsBits } from 'discord.js';
import KirinClient from '../kirin/KirinClient.js';

export class RestartCommand extends SlashCommandModule {
    public data = new SlashCommandBuilder()
        .setName('restart')
        .setDescription('Restarts a running server.')
        .setContexts(InteractionContextType.Guild)
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(server => server
            .setName('server')
            .setDescription('The target server to restart.')
            .setAutocomplete(true)
            .setRequired(true)
        )
        .toJSON();

    public interactions: InteractionListenerData[] = [
        new InteractionListenerBuilder()
            .setType(InteractionListenerType.Autocomplete)
            .setFilter(interaction => interaction.commandName === 'restart')
            .setExecute(async interaction => {
                const query = interaction.options.getFocused().toLowerCase();
                const servers = await KirinClient.filterByPermission({
                    servers: KirinClient.filterServers({
                        query,
                        isRunning: true
                    }),
                    action: 'restart',
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

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (!interaction.inCachedGuild()) {
            await interaction.editReply('❌ This command can only be used in a server with the bot in it.');
            return;
        }

        const server = KirinClient.kirin.get(interaction.options.getString('server', true));
        const config = KirinClient.configurations.get(server?.id ?? '');

        if (!server || !config) {
            await interaction.editReply('❌ Server not found.');
            return;
        }

        if (!server.isRunning) {
            await interaction.editReply('❌ Server is not running.');
            return;
        }

        const hasPermission = await config?.hasPermission({
            action: 'restart',
            userId: interaction.user.id,
            channelId: interaction.channelId,
            guildId: interaction.guildId ?? undefined
        });

        if (!hasPermission) {
            await interaction.editReply('❌ You do not have permission to restart this server.');
            return;
        }

        await interaction.editReply('⌛ Server is restarting...');
        await KirinClient.restart(server).catch(() => null);

        await interaction.editReply({
            content: server.isRunning
                ? `✅ Server restarted successfully.`
                : `❌ Server failed to restart.`
        }).catch(() => null);
    }
}

export default new RestartCommand();