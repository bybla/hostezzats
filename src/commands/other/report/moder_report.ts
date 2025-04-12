// Project: Hostezza Discord Bot
// Created by: bybla
// Created on: 2025-04-12
// Descripton: Обработка жалоб от пользователей и управление ими модераторами


// commands/other/report/moder_report.ts
import { Command } from '../../../utils/commands/command';
import { 
    ActionRowBuilder, 
    Message, 
    StringSelectMenuBuilder, 
    StringSelectMenuInteraction,
    EmbedBuilder,
    MessageActionRowComponentBuilder,
    Colors,
    TextChannel,
    InteractionCollector,
    PermissionsBitField
} from 'discord.js';
import prisma from '../../../db';
import { logger } from '../../../utils/logger/logger';

export default new Command({
    name: 'manage_report',
    aliases: ['moder_report', 'mr'],
    description: 'Управление жалобами',
    execute: async (message: Message, args: string[]): Promise<void> => {
        try {
            logger.info(`Команда manage report вызвана пользователем ${message.author.tag}`);

            const reports = await prisma.report.findMany({
                where: { closedAt: null },
                include: { reporter: true, reported: true },
                orderBy: { createdAt: 'desc' },
                take: 25
            });

            if (reports.length === 0) {
                const noReportsEmbed = new EmbedBuilder()
                    .setColor(Colors.Green)
                    .setTitle('✅ Нет активных жалоб')
                    .setDescription('Все жалобы обработаны!')
                    .setFooter({ text: `Запросил: ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
                    .setTimestamp();

                await message.reply({ embeds: [noReportsEmbed] });
                return;
            }

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('manage_report')
                .setPlaceholder('Выберите жалобу для обработки')
                .addOptions(
                    reports.map(report => ({
                        label: `#${report.id.slice(0, 6)} | ${report.reported.username}`,
                        description: report.reason.slice(0, 50),
                        value: report.id
                    }))
                );

            const row = new ActionRowBuilder<MessageActionRowComponentBuilder>()
                .addComponents(selectMenu);

            const reportsListEmbed = new EmbedBuilder()
                .setColor(Colors.Orange)
                .setTitle('📋 Управление жалобами')
                .setDescription(`Доступно ${reports.length} необработанных жалоб`)
                .addFields({
                    name: '📌 Последние жалобы', 
                    value: reports.slice(0, 3).map(r => 
                        `**#${r.id.slice(0, 6)}** | ${r.reported.username}: ${r.reason.slice(0, 30)}...`
                    ).join('\n') || 'Нет жалоб'
                })
                .setFooter({ text: `Модератор: ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
                .setTimestamp();

            const sentMessage = await message.reply({
                embeds: [reportsListEmbed],
                components: [row]
            });

            logger.info(`Отправлено меню управления жалобами для ${message.author.tag} с ${reports.length} жалобами`);

            const collector = new InteractionCollector(message.client, {
                channel: message.channel as TextChannel,
                message: sentMessage,
                filter: i => i.isStringSelectMenu() && 
                           i.customId === 'manage_report' &&
                           i.user.id === message.author.id,
                time: 120_000
            });
            
            collector.on('collect', async (interaction) => {
                if (!interaction.isStringSelectMenu()) return;
                
                try {
                    const reportId = interaction.values[0];
                    logger.debug(`Пользователь ${interaction.user.tag} выбрал жалобу ${reportId}`);

                    const report = await prisma.report.findUnique({
                        where: { id: reportId },
                        include: { reporter: true, reported: true }
                    });

                    if (!report) {
                        logger.warn(`Жалоба ${reportId} не найдена в базе данных`);
                        await interaction.reply({ 
                            embeds: [
                                new EmbedBuilder()
                                    .setColor(Colors.Red)
                                    .setTitle('❌ Ошибка')
                                    .setDescription('Жалоба не найдена в базе данных!')
                            ],
                            ephemeral: true 
                        });
                        return;
                    }

                    await handleReportSelection(interaction, report, sentMessage);
                } catch (error) {
                    logger.error('Ошибка обработки выбора:', error);
                    await interaction.reply({ 
                        embeds: [
                            new EmbedBuilder()
                                .setColor(Colors.Red)
                                .setTitle('❌ Ошибка')
                                .setDescription('Произошла ошибка при обработке выбора')
                        ],
                        ephemeral: true 
                    }).catch(err => logger.error('Ошибка при отправке сообщения об ошибке:', err));
                }
            });

            collector.on('end', () => {
                logger.debug(`Коллектор для сообщения ${sentMessage.id} завершил работу`);
                sentMessage.edit({ components: [] }).catch(err => logger.error('Ошибка при удалении компонентов:', err));
            });
        } catch (error) {
            logger.error('Ошибка команды manage report:', error);
            const errorEmbed = new EmbedBuilder()
                .setColor(Colors.Red)
                .setTitle('❌ Ошибка выполнения команды')
                .setDescription('Произошла ошибка при обработке команды')
                .setFooter({ text: `Пользователь: ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
                .setTimestamp();

            await message.reply({ embeds: [errorEmbed] }).catch(err => logger.error('Ошибка при отправке сообщения об ошибке:', err));
        }
    }
});

async function handleReportSelection(
    interaction: StringSelectMenuInteraction, 
    report: ReportWithRelations,
    originalMessage: Message
) {
    try {
        logger.info(`Обработка жалобы #${report.id} для пользователя ${interaction.user.tag}`);
        
        const actionMenu = new StringSelectMenuBuilder()
            .setCustomId(`report_action_${report.id}`)
            .setPlaceholder('Выберите действие')
            .addOptions(
                { 
                    label: 'Принять жалобу', 
                    value: 'accept', 
                    description: 'Вынести наказание',
                    emoji: '✅'
                },
                { 
                    label: 'Отклонить жалобу', 
                    value: 'reject', 
                    description: 'Закрыть без действий',
                    emoji: '❌'
                },
                { 
                    label: 'Запросить информацию', 
                    value: 'request_info', 
                    description: 'Запросить у жалобщика',
                    emoji: '❓'
                }
            );

        const actionRow = new ActionRowBuilder<MessageActionRowComponentBuilder>()
            .addComponents(actionMenu);

        const reportEmbed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle(`📄 Жалоба #${report.id}`)
            .setDescription(`**Причина:**\n${report.reason}`)
            .addFields(
                { name: '👤 Жалобщик', value: `\`${report.reporter.username}\` (ID: ${report.reporter.discordId})`, inline: true },
                { name: '🔍 На кого', value: `\`${report.reported.username}\` (ID: ${report.reported.discordId})`, inline: true },
                { name: '📅 Дата создания', value: `<t:${Math.floor(report.createdAt.getTime() / 1000)}:R>`, inline: true }
            )
            .setFooter({ 
                text: `Обрабатывает: ${interaction.user.tag}`, 
                iconURL: interaction.user.displayAvatarURL() 
            })
            .setTimestamp();

        const sentMessage = await interaction.reply({
            embeds: [reportEmbed],
            components: [actionRow],
            ephemeral: true,
            fetchReply: true
        });

        logger.debug(`Отправлено меню действий для жалобы #${report.id}`);

        const actionCollector = new InteractionCollector(interaction.client, {
            channel: interaction.channel as TextChannel,
            message: sentMessage,
            filter: i => i.isStringSelectMenu() && 
                       i.customId === `report_action_${report.id}` &&
                       i.user.id === interaction.user.id,
            time: 120_000
        });

        actionCollector.on('collect', async (actionInteraction) => {
            if (!actionInteraction.isStringSelectMenu()) return;
            
            try {
                await actionInteraction.deferReply({ ephemeral: true });
                const action = actionInteraction.values[0];

                logger.info(`Пользователь ${actionInteraction.user.tag} выбрал действие ${action} для жалобы #${report.id}`);

                switch (action) {
                    case 'accept':
                        await handleAcceptReport(actionInteraction, report);
                        break;
                    case 'reject':
                        await handleRejectReport(actionInteraction, report);
                        break;
                    case 'request_info':
                        await handleRequestInfo(actionInteraction, report);
                        break;
                }

                await originalMessage.edit({ components: [] });
                actionCollector.stop();
            } catch (error) {
                logger.error(`Ошибка обработки действия для жалобы #${report.id}:`, error);
                await actionInteraction.followUp({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(Colors.Red)
                            .setTitle('❌ Ошибка')
                            .setDescription('Произошла ошибка при обработке действия')
                    ],
                    ephemeral: true
                });
            }
        });

        actionCollector.on('end', () => {
            logger.debug(`Коллектор действий для жалобы #${report.id} завершен`);
        });
    } catch (error) {
        logger.error(`Ошибка обработки жалобы #${report.id}:`, error);
        await interaction.followUp({
            embeds: [
                new EmbedBuilder()
                    .setColor(Colors.Red)
                    .setTitle('❌ Ошибка')
                    .setDescription('Произошла ошибка при обработке жалобы')
            ],
            ephemeral: true
        });
    }
}

type ReportWithRelations = Awaited<ReturnType<typeof prisma.report.findUnique>> & {
    reporter: { discordId: string; username: string };
    reported: { discordId: string; username: string };
};

async function handleAcceptReport(interaction: StringSelectMenuInteraction, report: ReportWithRelations) {
    try {
        const moderator = await prisma.user.upsert({
            where: { discordId: interaction.user.id },
            create: {
                discordId: interaction.user.id,
                username: interaction.user.username
            },
            update: {
                username: interaction.user.username
            }
        });

        await prisma.report.update({
            where: { id: report.id },
            data: {
                verdict: 'Принято',
                closedAt: new Date(),
                moderatorId: moderator.id
            }
        });

        logger.info(`Жалоба #${report.id} принята модератором ${interaction.user.tag}`);

        const successEmbed = new EmbedBuilder()
            .setColor(Colors.Green)
            .setTitle('✅ Жалоба принята')
            .setDescription(`Жалоба #${report.id} на пользователя ${report.reported.username} была принята.`)
            .addFields(
                { name: 'Модератор', value: interaction.user.tag, inline: true },
                { name: 'Время закрытия', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
            )
            .setFooter({ text: `ID жалобы: ${report.id}` })
            .setTimestamp();

        await interaction.followUp({ embeds: [successEmbed] });

        // Уведомление жалобщика
        try {
            const reporterUser = await interaction.client.users.fetch(report.reporter.discordId);
            const reporterEmbed = new EmbedBuilder()
                .setColor(Colors.Green)
                .setTitle('✅ Ваша жалоба рассмотрена')
                .setDescription(`Ваша жалоба #${report.id} на пользователя ${report.reported.username} была принята модератором.`)
                .addFields(
                    { name: 'Причина', value: report.reason },
                    { name: 'Модератор', value: interaction.user.tag }
                )
                .setTimestamp();

            await reporterUser.send({ embeds: [reporterEmbed] });
            logger.info(`Уведомление отправлено жалобщику ${reporterUser.tag}`);
        } catch (error) {
            logger.warn(`Не удалось отправить уведомление жалобщику ${report.reporter.username}:`, error);
        }

    } catch (error) {
        logger.error(`Ошибка при принятии жалобы #${report.id}:`, error);
        await interaction.followUp({
            embeds: [
                new EmbedBuilder()
                    .setColor(Colors.Red)
                    .setTitle('❌ Ошибка')
                    .setDescription('Произошла ошибка при принятии жалобы')
            ],
            ephemeral: true
        });
    }
}

async function handleRejectReport(interaction: StringSelectMenuInteraction, report: ReportWithRelations) {
    try {
        const moderator = await prisma.user.upsert({
            where: { discordId: interaction.user.id },
            create: {
                discordId: interaction.user.id,
                username: interaction.user.username
            },
            update: {
                username: interaction.user.username
            }
        });

        await prisma.report.update({
            where: { id: report.id },
            data: {
                verdict: 'Отклонено',
                closedAt: new Date(),
                moderatorId: moderator.id
            }
        });

        logger.info(`Жалоба #${report.id} отклонена модератором ${interaction.user.tag}`);

        const successEmbed = new EmbedBuilder()
            .setColor(Colors.Orange)
            .setTitle('❌ Жалоба отклонена')
            .setDescription(`Жалоба #${report.id} на пользователя ${report.reported.username} была отклонена.`)
            .addFields(
                { name: 'Модератор', value: interaction.user.tag, inline: true },
                { name: 'Время закрытия', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
            )
            .setFooter({ text: `ID жалобы: ${report.id}` })
            .setTimestamp();

        await interaction.followUp({ embeds: [successEmbed] });

        // Уведомление жалобщика
        try {
            const reporterUser = await interaction.client.users.fetch(report.reporter.discordId);
            const reporterEmbed = new EmbedBuilder()
                .setColor(Colors.Orange)
                .setTitle('❌ Ваша жалоба отклонена')
                .setDescription(`Ваша жалоба #${report.id} на пользователя ${report.reported.username} была отклонена модератором.`)
                .addFields(
                    { name: 'Причина жалобы', value: report.reason },
                    { name: 'Модератор', value: interaction.user.tag },
                    { name: 'Комментарий', value: 'Если вы не согласны с решением, обратитесь к старшему модератору.' }
                )
                .setTimestamp();

            await reporterUser.send({ embeds: [reporterEmbed] });
            logger.info(`Уведомление об отклонении отправлено жалобщику ${reporterUser.tag}`);
        } catch (error) {
            logger.warn(`Не удалось отправить уведомление жалобщику ${report.reporter.username}:`, error);
        }

    } catch (error) {
        logger.error(`Ошибка при отклонении жалобы #${report.id}:`, error);
        await interaction.followUp({
            embeds: [
                new EmbedBuilder()
                    .setColor(Colors.Red)
                    .setTitle('❌ Ошибка')
                    .setDescription('Произошла ошибка при отклонении жалобы')
            ],
            ephemeral: true
        });
    }
}

async function handleRequestInfo(interaction: StringSelectMenuInteraction, report: ReportWithRelations) {
    try {
        const reporter = await interaction.client.users.fetch(report.reporter.discordId);
        if (!reporter) {
            logger.warn(`Жалобщик ${report.reporter.discordId} не найден`);
            await interaction.followUp({
                embeds: [
                    new EmbedBuilder()
                        .setColor(Colors.Red)
                        .setTitle('❌ Ошибка')
                        .setDescription('Жалобщик не найден!')
                ],
                ephemeral: true
            });
            return;
        }

        const requestEmbed = new EmbedBuilder()
            .setColor(Colors.Blue)
            .setTitle('❔ Запрос информации')
            .setDescription(`Модератор ${interaction.user.tag} запросил дополнительную информацию по вашей жалобе #${report.id}.`)
            .addFields(
                { name: 'Причина жалобы', value: report.reason },
                { name: 'На кого', value: report.reported.username },
                { name: 'Как ответить', value: 'Ответьте на это сообщение, и модератор получит ваши дополнительные сведения.' }
            )
            .setFooter({ text: `ID жалобы: ${report.id}` })
            .setTimestamp();

        const dmChannel = await reporter.createDM();
        await dmChannel.send({ embeds: [requestEmbed] })
            .then(() => {
                logger.info(`Запрос информации отправлен жалобщику ${reporter.tag}`);
            })
            .catch(err => {
                logger.error('Ошибка отправки сообщения жалобщику:', err);
                throw new Error('Не удалось отправить сообщение жалобщику');
            });

        const successEmbed = new EmbedBuilder()
            .setColor(Colors.Blue)
            .setTitle('📨 Запрос отправлен')
            .setDescription(`Запрос на дополнительную информацию отправлен жалобщику ${reporter.tag}.`)
            .setFooter({ text: `ID жалобы: ${report.id}` })
            .setTimestamp();

        await interaction.followUp({ embeds: [successEmbed] });

        // Обработка ответа жалобщика
        const filter = (msg: Message) => msg.author.id === reporter.id && msg.channel.id === dmChannel.id;
        const collector = dmChannel.createMessageCollector({ filter, time: 86400_000 }); // 24 часа

        collector.on('collect', async (msg) => {
            logger.info(`Получен ответ от жалобщика ${reporter.tag} по жалобе #${report.id}`);

            const responseEmbed = new EmbedBuilder()
                .setColor(Colors.Blue)
                .setTitle(`📩 Ответ по жалобе #${report.id}`)
                .setDescription(msg.content)
                .addFields(
                    { name: 'Жалобщик', value: reporter.tag },
                    { name: 'Оригинальная жалоба', value: report.reason }
                )
                .setFooter({ text: `ID жалобы: ${report.id}` })
                .setTimestamp();

            await interaction.user.send({ embeds: [responseEmbed] })
                .then(() => {
                    logger.info(`Ответ жалобщика переслан модератору ${interaction.user.tag}`);
                })
                .catch(err => {
                    logger.error('Ошибка отправки ответа модератору:', err);
                });

            // Подтверждение жалобщику
            const confirmationEmbed = new EmbedBuilder()
                .setColor(Colors.Green)
                .setTitle('✅ Ответ получен')
                .setDescription('Ваш ответ был передан модератору. Спасибо!')
                .setFooter({ text: `ID жалобы: ${report.id}` })
                .setTimestamp();

            await msg.reply({ embeds: [confirmationEmbed] });
            collector.stop();
        });

        collector.on('end', (collected, reason) => {
            logger.info(`Сбор ответов для жалобы #${report.id} завершен. Причина: ${reason}. Собрано сообщений: ${collected.size}`);
        });

    } catch (error) {
        logger.error(`Ошибка при запросе информации по жалобе #${report.id}:`, error);
        await interaction.followUp({
            embeds: [
                new EmbedBuilder()
                    .setColor(Colors.Red)
                    .setTitle('❌ Ошибка')
                    .setDescription('Произошла ошибка при запросе информации')
                    .addFields(
                        { name: 'Подробности', value: error instanceof Error ? error.message : 'Неизвестная ошибка' }
                    )
            ],
            ephemeral: true
        });
    }
}