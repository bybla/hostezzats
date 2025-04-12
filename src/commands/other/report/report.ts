// Project: Hostezza Discord Bot
// Created by: bybla
// Created on: 2025-04-11
// Descripton: Команда для подачи жалобы на пользователя в Discord


// commands/other/report/report.ts
import { Command } from '../../../utils/commands/command';
import { 
    ActionRowBuilder, 
    Message, 
    UserSelectMenuBuilder, 
    UserSelectMenuInteraction,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageActionRowComponentBuilder,
    EmbedBuilder,
    Colors
} from 'discord.js';
import prisma from '../../../db';
import { logger } from '../../../utils/logger/logger';

export default new Command({
    name: 'report',
    aliases: ['rprt', 'rep'],
    description: 'Подать жалобу на пользователя',
    execute: async (message: Message) => {
        try {
            logger.info(`Команда report вызвана пользователем ${message.author.tag}`);

            // Шаг 1: Создаем меню выбора пользователя
            const selectMenu = new UserSelectMenuBuilder()
                .setCustomId('report_user')
                .setPlaceholder('Выберите пользователя для жалобы')
                .setMaxValues(1);

            const row = new ActionRowBuilder<MessageActionRowComponentBuilder>()
                .addComponents(selectMenu);

            const selectEmbed = new EmbedBuilder()
                .setColor(Colors.Blue)
                .setTitle('🛡️ Подача жалобы')
                .setDescription('Пожалуйста, выберите пользователя, на которого хотите пожаловаться')
                .setFooter({ 
                    text: `Инициатор: ${message.author.tag}`, 
                    iconURL: message.author.displayAvatarURL() 
                })
                .setTimestamp();

            const sentMessage = await message.reply({
                embeds: [selectEmbed],
                components: [row],
            });

            logger.debug(`Меню выбора пользователя отправлено для ${message.author.tag}`);

            // Коллектор для обработки выбора
            const collector = sentMessage.createMessageComponentCollector({
                filter: (interaction) => {
                    if (!interaction.isUserSelectMenu()) return false;
                    if (interaction.customId !== 'report_user') return false;
                    if (interaction.user.id !== message.author.id) {
                        interaction.reply({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor(Colors.Red)
                                    .setDescription('❌ Только автор команды может использовать это меню!')
                            ],
                            ephemeral: true
                        }).catch(err => logger.error('Ошибка при ответе на взаимодействие:', err));
                        return false;
                    }
                    return true;
                },
                time: 60_000
            });

            collector.on('collect', async (interaction: UserSelectMenuInteraction) => {
                try {
                    const selectedUser = interaction.users.first();
                    
                    if (!selectedUser) {
                        logger.warn('Выбранный пользователь не найден');
                        await interaction.reply({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor(Colors.Red)
                                    .setDescription('❌ Пользователь не найден')
                            ],
                            ephemeral: true
                        });
                        return;
                    }

                    logger.info(`Пользователь ${message.author.tag} выбрал ${selectedUser.tag} для жалобы`);

                    // Шаг 2: Создаем модальное окно для причины
                    const modal = new ModalBuilder()
                        .setCustomId(`report_modal_${selectedUser.id}`)
                        .setTitle(`Жалоба на ${selectedUser.username}`);

                    const reasonInput = new TextInputBuilder()
                        .setCustomId('reason_input')
                        .setLabel("Опишите причину жалобы")
                        .setPlaceholder("Подробно опишите ситуацию...")
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(true)
                        .setMinLength(10)
                        .setMaxLength(1000);

                    modal.addComponents(
                        new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput)
                    );

                    await interaction.showModal(modal);
                    logger.debug(`Модальное окно показано для ${message.author.tag}`);

                    // Шаг 3: Обработка модального окна
                    try {
                        const modalSubmit = await interaction.awaitModalSubmit({
                            time: 120_000,
                            filter: i => i.customId === `report_modal_${selectedUser.id}` && 
                                       i.user.id === interaction.user.id
                        });

                        const reason = modalSubmit.fields.getTextInputValue('reason_input');
                        logger.debug(`Получена причина жалобы от ${message.author.tag}`);

                        // Шаг 4: Сохранение в базу данных
                        const report = await prisma.report.create({
                            data: {
                                reason,
                                reporter: {
                                    connectOrCreate: {
                                        where: { discordId: interaction.user.id },
                                        create: {
                                            discordId: interaction.user.id,
                                            username: interaction.user.username
                                        }
                                    }
                                },
                                reported: {
                                    connectOrCreate: {
                                        where: { discordId: selectedUser.id },
                                        create: {
                                            discordId: selectedUser.id,
                                            username: selectedUser.username
                                        }
                                    }
                                }
                            },
                            include: {
                                reported: true,
                                reporter: true
                            }
                        });

                        logger.info(`Жалоба #${report.id} сохранена в базу данных`);

                        // Эмбед подтверждения для жалобщика
                        const successEmbed = new EmbedBuilder()
                            .setColor(Colors.Green)
                            .setTitle('✅ Жалоба успешно отправлена')
                            .setDescription(`Ваша жалоба на ${selectedUser.tag} была зарегистрирована`)
                            .addFields(
                                { name: 'ID жалобы', value: report.id, inline: true },
                                { name: 'Дата', value: `<t:${Math.floor(Date.now()/1000)}:R>`, inline: true },
                                { name: 'Причина', value: reason.slice(0, 1000) }
                            )
                            .setFooter({ 
                                text: 'Спасибо за вашу бдительность!', 
                                iconURL: message.guild?.iconURL() || undefined 
                            });

                        await modalSubmit.reply({
                            embeds: [successEmbed],
                            ephemeral: true
                        });

                        // Логирование в канал модераторов (если нужно)
                        // Здесь можно добавить отправку жалобы в канал модераторов

                    } catch (error) {
                        logger.error('Ошибка при обработке модального окна:', error);
                        await interaction.followUp({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor(Colors.Red)
                                    .setTitle('❌ Ошибка')
                                    .setDescription('Произошла ошибка при обработке вашей жалобы')
                            ],
                            ephemeral: true
                        }).catch(err => logger.error('Ошибка при отправке сообщения об ошибке:', err));
                    }
                } catch (error) {
                    logger.error('Ошибка в обработчике выбора пользователя:', error);
                }
            });

            collector.on('end', (collected, reason) => {
                logger.debug(`Коллектор жалоб завершил работу. Причина: ${reason}. Собрано: ${collected.size}`);
                sentMessage.edit({ 
                    embeds: [
                        new EmbedBuilder()
                            .setColor(Colors.Grey)
                            .setDescription('⏳ Время для выбора пользователя истекло')
                    ],
                    components: [] 
                }).catch(err => logger.error('Ошибка при редактировании сообщения:', err));
            });

        } catch (error) {
            logger.error('Ошибка выполнения команды report:', error);
            await message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(Colors.Red)
                        .setTitle('❌ Ошибка')
                        .setDescription('Произошла ошибка при обработке команды')
                ]
            }).catch(err => logger.error('Ошибка при отправке сообщения об ошибке:', err));
        }
    }
});