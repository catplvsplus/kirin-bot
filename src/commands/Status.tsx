import { InteractionListenerBuilder, InteractionListenerType } from '@reciple/modules';
import { SlashCommandBuilder, SlashCommandModule, type SlashCommand } from 'reciple';
import KirinClient from '../kirin/KirinClient.js';
import { MessageFlags } from 'discord.js';

export class StatusCommand extends SlashCommandModule {
    public data = new SlashCommandBuilder()
        .setName('status')
        .setDescription('Displays the status of the server.')
        .addStringOption(server => server
            .setName('server')
            .setDescription('The target server.')
            .setAutocomplete(true)
            .setRequired(true)
        )
        .toJSON();

    public interactions: InteractionListenerBuilder<InteractionListenerType>[] = [
        new InteractionListenerBuilder()
            .setType(InteractionListenerType.Autocomplete)
            .setFilter(interaction => interaction.commandName === 'status')
            .setExecute(async interaction => {
                const query = interaction.options.getFocused().toLowerCase();
                const servers = await KirinClient.filterByPermission({
                    servers: KirinClient.filterServers({ query }),
                    action: 'view',
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
    ];

    public async execute(data: SlashCommand.ExecuteData): Promise<void> {
        const { interaction } = data;

        const server = KirinClient.kirin.get(interaction.options.getString('server', true));
        const config = KirinClient.configurations.get(server?.id ?? '');

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (!server || !config) {
            await interaction.editReply('❌ Server not found.');
            return;
        }

        const hasPermission = await config.hasPermission({
            action: 'view',
            userId: interaction.user.id,
            channelId: interaction.channelId,
            guildId: interaction.guildId ?? undefined
        });

        if (!hasPermission) {
            await interaction.reply('❌ You do not have permission to view this server.');
            return;
        }

        await interaction.editReply({
            flags: [MessageFlags.IsComponentsV2],
            components: <>
                {config.messages.createStatusInfoContainer()}
            </>
        });
    }
}

export default new StatusCommand();