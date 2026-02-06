import { InteractionListenerBuilder, InteractionListenerType, type InteractionListenerData } from '@reciple/modules';
import { SlashCommandBuilder, SlashCommandModule, type SlashCommand } from 'reciple';
import KirinClient from '../kirin/KirinClient.js';
import { InteractionContextType, MessageFlags, PermissionFlagsBits } from 'discord.js';

export class StartCommand extends SlashCommandModule {
    public data = new SlashCommandBuilder()
        .setName('start')
        .setDescription('Start a server.')
        .setContexts(InteractionContextType.Guild)
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(server => server
            .setName('server')
            .setDescription('The target server to start.')
            .setAutocomplete(true)
            .setRequired(true)
        )
        .toJSON();

    public interactions: InteractionListenerData[] = [
        new InteractionListenerBuilder()
            .setType(InteractionListenerType.Autocomplete)
            .setFilter(interaction => interaction.commandName === 'start')
            .setExecute(async interaction => {
                const query = interaction.options.getFocused().toLowerCase();
                const servers = await KirinClient.filterByPermission({
                    servers: KirinClient.filterServers({
                        query,
                        status: ['offline'],
                        isRunning: false
                    }),
                    action: 'start',
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

        if (!interaction.inCachedGuild()) {
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: '❌ This command can only be used in a server with the bot in it.'
            });
            return;
        }

        const server = KirinClient.kirin.get(interaction.options.getString('server', true));
        const config = KirinClient.configurations.get(server?.id ?? '');

        if (!server) {
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: '❌ Server not found.'
            });
            return;
        }

        if (server.isRunning) {
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: '❌ Server is already running.'
            });
            return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const hasPermission = await config?.hasPermission({
            action: 'start',
            userId: interaction.user.id,
            channelId: interaction.channelId,
            guildId: interaction.guildId ?? undefined
        });

        if (!hasPermission) {
            await interaction.editReply('❌ You do not have permission to start this server.');
            return;
        }

        await interaction.editReply('⌛ Server is starting...');
        await server.start();

        await interaction.editReply({
            content: server.isRunning
                ? `✅ Server started successfully.`
                : `❌ Server failed to start.`
        }).catch(() => null);
    }
}

export default new StartCommand();