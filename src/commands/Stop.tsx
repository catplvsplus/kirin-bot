import { InteractionListenerBuilder, InteractionListenerType, type InteractionListenerData } from '@reciple/modules';
import { SlashCommandBuilder, SlashCommandModule, type SlashCommand } from 'reciple';
import { inlineCode } from 'discord.js';
import KirinClient from '../kirin/KirinClient.js';

export class StopCommand extends SlashCommandModule {
    public data = new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stops a running server.')
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
                const servers = KirinClient.kirin.servers;
                const query = interaction.options.getFocused().toLowerCase();

                await interaction.respond(
                    servers
                        .filter(s => s.isRunning && (!query || s.id === query || s.name?.toLowerCase().includes(query)))
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

        const server = KirinClient.kirin.get(interaction.options.getString('server', true));

        if (!server) {
            await interaction.reply('❌ Server not found.');
            return;
        }

        if (!server.isRunning) {
            await interaction.reply('❌ Server is already stopped.');
            return;
        }

        await interaction.reply('⌛ Server is stopping...');

        const exitCode = await server.stop();

        await interaction.editReply({
            content: !exitCode
                ? `✅ Server stopped successfully.`
                : `❌ Server closed with exit code ${inlineCode(String(exitCode))}.`
        }).catch(() => null);
    }
}

export default new StopCommand();