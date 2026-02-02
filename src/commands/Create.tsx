import { SlashCommandBuilder, SlashCommandModule, type SlashCommand } from 'reciple';
import KirinClient from '../kirin/KirinClient.js';
import { Colors, inlineCode, InteractionContextType, MessageFlags } from 'discord.js';
import { Server } from '@kirinmc/core';
import { slug } from 'github-slugger';
import { FolderSelector } from '../utils/_FolderSelector.js';
import path from 'node:path';
import { ServerSetup } from '../utils/_ServerSetup.js';
import { Container, TextDisplay } from '@reciple/jsx';

export class CreateCommand extends SlashCommandModule {
    public data = new SlashCommandBuilder()
        .setName('create')
        .setDescription('Create a new server.')
        .setContexts(
            InteractionContextType.BotDM,
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel
        )
        .addStringOption(id => id
            .setName('id')
            .setDescription('The id of the server (must be unique)')
            .setRequired(true)
        )
        .addStringOption(name => name
            .setName('name')
            .setDescription('The name of the server')
            .setRequired(true)
        )
        .addStringOption(description => description
            .setName('type')
            .setDescription('The type of the server')
            .addChoices(
                { name: 'Java Edition', value: 'java' },
                { name: 'Bedrock Edition', value: 'bedrock' }
            )
            .setRequired(true)
        )
        .toJSON();

    public async execute(data: SlashCommand.ExecuteData): Promise<void> {
        const { interaction } = data;

        const serverData: Partial<Server.Data> & { id: string; name: string; type: Server.Type; persist: boolean; } = {
            id: slug(interaction.options.getString('id', true), false),
            name: interaction.options.getString('name', true),
            type: interaction.options.getString('type', true) as Server.Type,
            persist: true
        };

        if (KirinClient.kirin.get(serverData.id)) {
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: `A server with an id ${inlineCode(serverData.id)} already exists.`,
            });
            return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const selectFolder = new FolderSelector({
            cwd: path.resolve(KirinClient.kirin.root),
            interaction
        });

        const dir = await selectFolder.start({ allowCreate: true });
        if (!dir) return;

        serverData.directory = path.relative(path.resolve(KirinClient.kirin.root), dir) || './';

        const setup = new ServerSetup({
            data: serverData as ServerSetup.Data,
            interaction
        });

        if (!await setup.start()) return;

        await interaction.editReply({
            components: <>
                <TextDisplay>⏳ Creating server your server.</TextDisplay>
                <Container accentColor={Colors.Green}>
                    <TextDisplay>
                        {`## ${serverData.name}\n`}
                        {`-# Id: ${inlineCode(serverData.id)}\n`}
                        {`-# Type: ${inlineCode(serverData.type)}\n`}
                        {`-# Address: ${inlineCode(serverData.address!)}\n`}
                    </TextDisplay>
                </Container>
            </>
        });

        const server = await setup.createServer();
        await interaction.editReply({
            components: <>
                <TextDisplay>✅ Your server has been created!</TextDisplay>
                <Container accentColor={Colors.Green}>
                    <TextDisplay>
                        {`## ${server.name}\n`}
                        {`-# Id: ${inlineCode(server.id)}\n`}
                        {`-# Type: ${inlineCode(server.type)}\n`}
                        {`-# Address: ${inlineCode(server.address)}\n`}
                    </TextDisplay>
                </Container>
            </>
        });
    }
}

export default new CreateCommand();