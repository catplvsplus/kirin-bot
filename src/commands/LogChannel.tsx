import { SlashCommandBuilder, SlashCommandModule, type SlashCommand } from 'reciple';
import KirinClient from '../kirin/KirinClient.js';
import { ChannelType, MessageFlags, type Channel, type InteractionEditReplyOptions } from 'discord.js';
import { ActionRow, ChannelSelectMenu, Container, Heading, LineBreak, SubText, TextDisplay } from '@reciple/jsx';
import { SelectMenuDefaultValueType } from 'discord.js';
import { InteractionListenerBuilder, InteractionListenerType, type InteractionListenerData } from '@reciple/modules';
import type { Server } from '@kirinmc/core';
import { ComponentType } from 'discord.js';

export class LogChannelCommand extends SlashCommandModule {
    public data = new SlashCommandBuilder()
        .setName('log-channel')
        .setDescription(`Manage a server's log channel.`)
        .addStringOption(server => server
            .setName('server')
            .setDescription(`The target server.`)
            .setAutocomplete(true)
            .setRequired(true)
        )
        .toJSON();

    public interactions: InteractionListenerData[] = [
        new InteractionListenerBuilder()
            .setType(InteractionListenerType.Autocomplete)
            .setFilter(interaction => interaction.commandName === 'log-channel')
            .setExecute(async interaction => {
                const query = interaction.options.getFocused().toLowerCase();

                await interaction.respond(
                    KirinClient.kirin.servers
                        .filter(s => !query || s.id === query || s.name?.toLowerCase().includes(query))
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

        const serverId = interaction.options.getString('server', true);
        const server = KirinClient.kirin.get(serverId);
        const config = KirinClient.configurations.get(serverId);

        if (!server) {
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: '❌ Server not found.'
            });
            return;
        }

        if (!config) {
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: '❌ Configuration not found.'
            });
            return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        let channels = await config.fetchLogChannels();

        const message = await interaction.editReply(this.createMessageData(server, channels));
        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.ChannelSelect,
            time: 1000 * 60 * 5
        });

        collector.on('collect', async interaction => {
            const id = interaction.customId as `log-channel:${string}`;
            const values = interaction.channels;

            if (!id.startsWith('log-channel:')) return;

            await interaction.deferUpdate();

            config.data.logChannels = [];
            channels = [];

            for (const [channelId, channelData] of values) {
                const channel = await useClient().channels.fetch(channelId);
                if (!channel || !channel.isSendable() || channel.isDMBased()) continue;

                channels.push(channel);
                config.data.logChannels.push({
                    channelId,
                    guildId: channel.guild.id,
                    type: 'both'
                });
            }

            await config.save();
            await interaction.editReply(this.createMessageData(server, channels));
        });

        collector.on('end', async () => {
            await interaction.editReply(this.createMessageData(server, channels, true));
        })
    }

    public createMessageData(server: Server, channels: Channel[], disabled: boolean = false): InteractionEditReplyOptions {
        return {
            flags: MessageFlags.IsComponentsV2,
            components: <>
                <Container>
                    <TextDisplay>
                        <Heading level={2}>Log Channels</Heading>
                        <LineBreak/>
                        <SubText>Select a channel to set as a server log channel. Deselect a channel to remove it as a server log channel.</SubText>
                    </TextDisplay>
                    <ActionRow>
                        <ChannelSelectMenu
                            placeholder="Select a server log channels"
                            customId={`log-channel:${server.id}`}
                            channelTypes={[
                                ChannelType.GuildStageVoice,
                                ChannelType.GuildVoice,
                                ChannelType.GuildText
                            ]}
                            defaultValues={channels.map(c => ({
                                id: c.id,
                                type: SelectMenuDefaultValueType.Channel
                            }))}
                            minValues={0}
                            maxValues={5}
                            disabled={disabled}
                        />
                    </ActionRow>
                </Container>
            </>
        };
    }
}

export default new LogChannelCommand();