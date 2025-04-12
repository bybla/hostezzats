// Project: Hostezza Discord Bot
// Created by: bybla
// Created on: 2025-04-13
// Descripton: Менеджер статусов бота, который обновляет статус каждые 60 секунд и кеширует участников сервера каждые 5 минут


// util/statusManager.ts
import { Client, User, ActivityType, Guild } from 'discord.js';
import { logger } from '../logger/logger';

export class StatusManager {
    private members: User[] = [];
    private updateInterval: NodeJS.Timeout | null = null;
    private cacheInterval: NodeJS.Timeout | null = null;

    constructor(private client: Client) {}

    public async start() {
        await this.refreshMemberCache();
        this.setupIntervals();
        logger.info('Менеджер статусов запущен');
    }

    public stop() {
        if (this.updateInterval) clearInterval(this.updateInterval);
        if (this.cacheInterval) clearInterval(this.cacheInterval);
        logger.info('Менеджер статусов остановлен');
    }

    private setupIntervals() {
        // Обновляем кеш каждые 5 минут
        this.cacheInterval = setInterval(() => {
            this.refreshMemberCache().catch(error => {
                logger.error('Ошибка при обновлении кеша пользователей:', error);
            });
        }, 300_000);

        // Обновляем статус каждую минуту
        this.updateInterval = setInterval(() => {
            this.updateRandomStatus();
        }, 60_000);
    }

    private async refreshMemberCache() {
        try {
            this.members = [];
            
            // Используем Promise.all для параллельного получения участников
            await Promise.all(
                this.client.guilds.cache.map(async guild => {
                    try {
                        const members = await guild.members.fetch();
                        members.forEach(member => {
                            if (!member.user.bot && member.user.username.length < 15) {
                                this.members.push(member.user);
                            }
                        });
                    } catch (error) {
                        logger.error(`Ошибка при получении участников сервера ${guild.name}:`, error);
                    }
                })
            );

            logger.info(`Обновлен кеш пользователей: ${this.members.length} участников`);
        } catch (error) {
            logger.error('Критическая ошибка при обновлении кеша:', error);
        }
    }

    private updateRandomStatus() {
        if (!this.client.isReady() || this.members.length === 0) {
            logger.warn('Не удалось обновить статус: клиент не готов или кеш пуст');
            return;
        }

        try {
            const randomUser = this.members[Math.floor(Math.random() * this.members.length)];
            const status = this.generateRandomStatus(randomUser);
            
            this.client.user.setActivity({
                name: status.text,
                type: status.type
            });

            logger.info(`Обновлен статус: ${ActivityType[status.type]} ${status.text}`);
        } catch (error) {
            logger.error('Ошибка при обновлении статуса:', error);
        }
    }

    private generateRandomStatus(user: User) {
        const activities = [
            { type: ActivityType.Watching, text: `на ${user.username}` },
            { type: ActivityType.Watching, text: `профиль ${user.username}` },
            { type: ActivityType.Listening, text: `сладкий голос ${user.username}` },
            { type: ActivityType.Listening, text: `мурчание ${user.username}` },
            { type: ActivityType.Playing, text: `с ${user.username}` },
            { type: ActivityType.Competing, text: `против ${user.username}` }
        ];

        return activities[Math.floor(Math.random() * activities.length)];
    }
}