import { MessageFlags } from 'discord.js';
import { SlashCommandBuilder, SlashCommandModule, type SlashCommand } from 'reciple';
import { GlobalConfig } from '../utils/_GlobalConfig.js';
import KirinClient from '../kirin/KirinClient.js';
import { InteractionListenerBuilder, InteractionListenerType, type InteractionListenerData } from '@reciple/modules';

export class StatusMessage extends SlashCommandModule {
    public data = new SlashCommandBuilder()
        .setName('add-status-message')
        .setDescription('Add a server status message.')
        .addStringOption(server => server
            .setName('server')
            .setDescription('The target server for the status message.')
            .setAutocomplete(true)
            .setRequired(true)
        )
        .addChannelOption(channel => channel
            .setName('channel')
            .setDescription('The channel to send the status message in.')
            .addChannelTypes(...GlobalConfig.sendableChannelTypes)
            .setRequired(true)
        )
        .toJSON();

    public interactions: InteractionListenerData[] = [
        new InteractionListenerBuilder()
            .setType(InteractionListenerType.Autocomplete)
            .setFilter(interaction => interaction.commandName === 'add-status-message')
            .setExecute(async interaction => {
                const query = interaction.options.getFocused().toLowerCase();
                const servers = await KirinClient.filterByPermission({
                    servers: KirinClient.filterServers({ query }),
                    action: 'manage',
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
        const config = KirinClient.configurations.get(interaction.options.getString('server', true));
        const channel = interaction.options.getChannel('channel', true, GlobalConfig.sendableChannelTypes);

        if (!server || !config) {
            await interaction.editReply('❌ Server not found.');
            return;
        }

        const hasPermission = await config.hasPermission({
            action: 'manage',
            userId: interaction.user.id,
            channelId: interaction.channelId,
            guildId: interaction.guildId ?? undefined
        });

        if (!hasPermission) {
            await interaction.editReply('❌ You do not have permission to manage this server.');
            return;
        }

        const message = await channel.send({
            flags: MessageFlags.IsComponentsV2,
            components: <>{config.messages.createStatusInfoContainer()}</>
        });

        config.data.statusMessages.push({
            messageId: message.id,
            channelId: channel.id,
            guildId: interaction.guildId,
            allowedActions: ['start', 'stop', 'restart']
        });

        await interaction.editReply('✅ Status message added successfully.');
        await config.save();
    }
}

export default new StatusMessage();