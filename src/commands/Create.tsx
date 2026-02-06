import { SlashCommandBuilder, SlashCommandModule, type SlashCommand } from 'reciple';
import KirinClient from '../kirin/KirinClient.js';
import { Colors, inlineCode, InteractionContextType, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { Server } from '@kirinmc/core';
import { slug } from 'github-slugger';
import { FolderSelector } from '../utils/_FolderSelector.js';
import path from 'node:path';
import { ServerSetup } from '../utils/_ServerSetup.js';
import { Container, Heading, LineBreak, SubText, TextDisplay } from '@reciple/jsx';

export class CreateCommand extends SlashCommandModule {
    public data = new SlashCommandBuilder()
        .setName('create')
        .setDescription('Create a new server.')
        .setContexts(InteractionContextType.Guild)
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
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

        if (!interaction.inCachedGuild()) {
            await interaction.reply('❌ This command can only be used in a server with the bot in it.');
            return;
        }

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
                        <Heading level={2}>{serverData.name}</Heading>
                        <LineBreak/>
                        <SubText>Id: {inlineCode(serverData.id)}</SubText>
                        <LineBreak/>
                        <SubText>Type: {inlineCode(serverData.type)}</SubText>
                        <LineBreak/>
                        <SubText>Address: {inlineCode(serverData.address!)}</SubText>
                    </TextDisplay>
                </Container>
            </>
        });

        const server = await setup.apply();

        await interaction.editReply({
            components: <>
                <TextDisplay>✅ Your server has been created!</TextDisplay>
                <Container accentColor={Colors.Green}>
                    <TextDisplay>
                        <Heading level={2}>{server.name}</Heading>
                        <LineBreak/>
                        <SubText>Id: {inlineCode(server.id)}</SubText>
                        <LineBreak/>
                        <SubText>Type: {inlineCode(server.type)}</SubText>
                        <LineBreak/>
                        <SubText>Address: {inlineCode(server.address)}</SubText>
                    </TextDisplay>
                </Container>
            </>
        });
    }
}

export default new CreateCommand();