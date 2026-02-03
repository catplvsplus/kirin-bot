import { InteractionListenerBuilder, InteractionListenerType, type InteractionListenerData } from '@reciple/modules';
import { SlashCommandBuilder, SlashCommandModule, type SlashCommand } from 'reciple';
import KirinClient from '../kirin/KirinClient.js';
import { MessageFlags } from 'discord.js';

export class StartCommand extends SlashCommandModule {
    public data = new SlashCommandBuilder()
        .setName('start')
        .setDescription('Start a server.')
        .addStringOption(id => id
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
                const servers = KirinClient.kirin.servers;
                const query = interaction.options.getFocused().toLowerCase();

                await interaction.respond(
                    servers
                        .filter(s => s.status === 'offline' && (!query || s.id === query || s.name?.toLowerCase().includes(query)))
                        .map(s => ({
                            name: s.name || s.id,
                            value: s.id
                        }))
                )
            })
            .toJSON()
    ];

    public async execute(data: SlashCommand.ExecuteData): Promise<void> {
        const { interaction } = data;

        const serverId = interaction.options.getString('server', true);
        const server = KirinClient.kirin.get(serverId);

        if (!server) {
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: '❌ Server not found.'
            });
            return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        await server.start();
        await interaction.editReply('✅ Server is starting...');
    }
}

export default new StartCommand();