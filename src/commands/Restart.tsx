import { InteractionListenerBuilder, InteractionListenerType, type InteractionListenerData } from '@reciple/modules';
import { SlashCommandBuilder, SlashCommandModule, type SlashCommand } from 'reciple';
import { MessageFlags } from 'discord.js';
import KirinClient from '../kirin/KirinClient.js';

export class RestartCommand extends SlashCommandModule {
    public data = new SlashCommandBuilder()
        .setName('restart')
        .setDescription('Restarts a running server.')
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
                const servers = KirinClient.kirin.servers;
                const query = interaction.options.getFocused().toLowerCase();

                await interaction.respond(
                    servers
                        .filter(s => s.isRunning && (!query || s.id === query || s.name?.toLowerCase().includes(query)))
                        .map(s => ({
                            name: s.name || s.id,
                            value: s.id
                        }))
                        .splice(0, 25)
                )
            })
            .toJSON()
    ];

    public async execute(data: SlashCommand.ExecuteData): Promise<void> {
        const { interaction } = data;

        const server = KirinClient.kirin.get(interaction.options.getString('server', true));

        if (!server) {
            await interaction.reply('❌ Server not found.');
            return;
        }

        if (!server.isRunning) {
            await interaction.reply('❌ Server is not running.');
            return;
        }

        await interaction.reply({
            flags: MessageFlags.Ephemeral,
            content: '⌛ Server is restarting...'
        });

        await KirinClient.restart(server).catch(() => null);

        await interaction.editReply({
            content: server.isRunning
                ? `✅ Server restarted successfully.`
                : `❌ Server failed to restart.`
        }).catch(() => null);
    }
}

export default new RestartCommand();