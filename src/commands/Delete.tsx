import { SlashCommandBuilder, SlashCommandModule, type SlashCommand } from 'reciple';
import KirinClient from '../kirin/KirinClient.js';
import { ButtonStyle, Colors, ComponentType, MessageFlags, TextInputStyle, type InteractionEditReplyOptions, type ModalBuilder } from 'discord.js';
import { InteractionListenerBuilder, InteractionListenerType } from '@reciple/modules';
import { ActionRow, Button, Container, Heading, InlineCode, Label, LineBreak, Modal, SubText, TextDisplay, TextInput } from '@reciple/jsx';
import type { Server } from '@kirinmc/core';

export class DeleteCommand extends SlashCommandModule {
    public data = new SlashCommandBuilder()
        .setName('delete')
        .setDescription('Deletes a server from the list.')
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
            .setFilter(interaction => interaction.commandName === 'delete')
            .setExecute(async interaction => {
                const query = interaction.options.getFocused().toLowerCase();
                const servers = await KirinClient.filterByPermission({
                    servers: KirinClient.filterServers({ query }),
                    level: 'global',
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
    ]

    public async execute(data: SlashCommand.ExecuteData): Promise<void> {
        const { interaction } = data;

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const server = KirinClient.kirin.get(interaction.options.getString('server', true));
        const config = KirinClient.configurations.get(server?.id ?? '');

        if (!server || !config) {
            await interaction.editReply('❌ Server not found.');
            return;
        }

        const hasPermission = await KirinClient.config.hasPermission({
            action: 'manage',
            userId: interaction.user.id,
            guildId: interaction.guildId ?? undefined,
            channelId: interaction.channelId
        });

        if (!hasPermission) {
            await interaction.editReply('❌ You do not have permission to use this command.');
            return;
        }

        const message = await interaction.editReply(this.createMessageData(server));
        const componentCollector = message.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 1000 * 60 * 5
        });

        componentCollector.on('collect', async i => {
            const id = i.customId as 'delete-cancel'|'delete-confirm';

            switch (id) {
                case 'delete-cancel':
                    await i.deferUpdate();
                    componentCollector.stop();
                    break;
                case 'delete-confirm':
                    await i.showModal(this.createConfirmModal(server));

                    const confirmInteraction = await i.awaitModalSubmit({
                        filter: interaction => interaction.customId === 'delete-confirm',
                        time: 1000 * 60 * 5
                    }).catch(() => null);

                    if (!confirmInteraction) break;

                    const serverId = confirmInteraction.fields.getTextInputValue('server-id');

                    if (serverId !== server.id) {
                        await confirmInteraction.reply({
                            flags: MessageFlags.Ephemeral,
                            content: '❌ Server ID does not match.'
                        });
                        break;
                    }

                    await confirmInteraction.deferUpdate();
                    componentCollector.stop();

                    await interaction.editReply({
                        components: <>
                            <TextDisplay>⏳ Deleting server...</TextDisplay>
                        </>
                    })

                    await KirinClient.kirin.delete(server.id);
                    await interaction.editReply({
                        components: <>
                            <TextDisplay>✅ Server deleted successfully.</TextDisplay>
                        </>
                    });
                    break;
            }
        });

        componentCollector.on('end', async () => {
            await interaction.editReply(this.createMessageData(server, true));
        });
    }

    public createMessageData(server: Server, disabled?: boolean): InteractionEditReplyOptions {
        return {
            flags: MessageFlags.IsComponentsV2,
            components: <>
                <Container accentColor={Colors.Red}>
                    <TextDisplay>
                        <Heading level={2}>Are you sure you want to delete this server?</Heading>
                        <LineBreak/>
                        You server will be removed from the servers entries. All server files inside <InlineCode>{server.directory}</InlineCode> will not be deleted.
                        {
                            server.isRunning
                                ? <>
                                    <LineBreak/>
                                    <SubText>Server process will not be stopped. It will continue to run in the background if you continue to delete the server without stopping it.</SubText>
                                </>
                                : undefined
                        }
                    </TextDisplay>
                    <ActionRow>
                        <Button style={ButtonStyle.Secondary} customId='delete-cancel' disabled={disabled}>Cancel</Button>
                        <Button style={ButtonStyle.Danger} customId='delete-confirm' disabled={disabled}>Delete</Button>
                    </ActionRow>
                </Container>
            </>
        }
    }

    public createConfirmModal(server: Server): ModalBuilder {
        return <Modal customId='delete-confirm' title='Confirm Server Deletion'>
            <Label
                label='Are you sure you want to delete this server?'
                description={`Type ${server.id} to confirm.`}
            >
                <TextInput customId='server-id' style={TextInputStyle.Short} placeholder={server.id} required={true}/>
            </Label>
        </Modal>
    }
}

export default new DeleteCommand();