import { ActionRow, Button, Container, Section, TextDisplay } from '@reciple/jsx';
import { ButtonStyle, type RepliableInteraction } from 'discord.js';

export class FolderSelector {
    public cwd: string;
    public interaction: RepliableInteraction;

    public constructor(options: FolderSelector.Options) {
        this.cwd = options.cwd;
        this.interaction = options.interaction;
    }

    public async select(): Promise<string> {
        await this.interaction.editReply({
            flags: 'IsComponentsV2',
            components: <>
                <TextDisplay># Select a folder</TextDisplay>
                <Container>
                    <Section>
                        <Button style={ButtonStyle.Secondary} customId={`folder--1`}>Open</Button>
                        <TextDisplay>📁 ../</TextDisplay>
                    </Section>
                    {
                        Array.from({ length: 8 })
                            .map((_, i) => <Section>
                                <Button style={ButtonStyle.Secondary} customId={`folder-${i}`}>Open</Button>
                                <TextDisplay>📁 Folder {i}</TextDisplay>
                            </Section>
                        )
                    }
                    <ActionRow>
                        <Button style={ButtonStyle.Danger} customId="prev" emoji="⬅️"/>
                        <Button style={ButtonStyle.Success} customId="next" emoji="➡️"/>
                    </ActionRow>
                </Container>
                <Container>
                    <TextDisplay>-# {this.cwd}</TextDisplay>
                    <ActionRow>
                        <Button style={ButtonStyle.Danger} customId="cancel">Cancel</Button>
                        <Button style={ButtonStyle.Success} customId="confirm">Select</Button>
                    </ActionRow>
                </Container>
            </>
        });

        return '';
    }
}

export namespace FolderSelector {
    export interface Options {
        cwd: string;
        interaction: RepliableInteraction;
    }
}