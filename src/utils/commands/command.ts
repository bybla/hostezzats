// Project: Hostezza Discord Bot
// Created by: bybla
// Created on: 2025-04-11
// Descripton: Обработка текстовых команд Discord бота. Зачем? Потому что это удобно и позволяет легко добавлять новые команды без изменения основного кода бота.


// utils/commands/command.ts
import { Client, Message, PermissionFlagsBits, User, GuildMember } from 'discord.js';

interface CommandOptions {
    name: string;
    aliases?: string[];
    description?: string;
    cooldown?: number;
    permissions?: bigint[];
    subCommands?: SubCommand[];
    execute?: (message: Message, args: string[]) => Promise<void> | void;
}

interface SubCommand {
    name: string;
    aliases?: string[];
    description?: string;
    execute: (message: Message, args: string[]) => Promise<void> | void;
}

export class Command {
    public name: string;
    public aliases: string[];
    public description: string;
    public cooldown: number;
    public permissions: bigint[];
    public subCommands: Map<string, SubCommand>;
    private cooldowns: Map<string, number> = new Map();
    private executeFn?: (message: Message, args: string[]) => Promise<void> | void; // Сохраняем функцию execute

    constructor(options: CommandOptions) {
        this.name = options.name;
        this.aliases = options.aliases || [];
        this.description = options.description || 'Описание не указано';
        this.cooldown = options.cooldown || 0;
        this.permissions = options.permissions || [];
        this.subCommands = new Map();
        this.executeFn = options.execute; // Сохраняем переданный execute

        if (options.subCommands) {
            options.subCommands.forEach(subCmd => {
                this.subCommands.set(subCmd.name.toLowerCase(), subCmd);
                if (subCmd.aliases) {
                    subCmd.aliases.forEach(alias => {
                        this.subCommands.set(alias.toLowerCase(), subCmd);
                    });
                }
            });
        }
    }

    public async execute(message: Message, args: string[]): Promise<void> {

        console.log('[DEBUG] Вызов execute для команды', this.name);

        // Проверка кулдауна
        if (this.cooldown > 0) {
            console.log('[DEBUG] Проверка кулдауна...');
            const cooldownKey = `${message.author.id}-${this.name}`;
            const now = Date.now();
            const cooldownEnd = this.cooldowns.get(cooldownKey) || 0;

            if (now < cooldownEnd) {
                const remaining = Math.ceil((cooldownEnd - now) / 1000);
                await message.reply(`Подождите ${remaining} секунд перед повторным использованием команды.`);
                return;
            }

            this.cooldowns.set(cooldownKey, now + this.cooldown * 1000);
            setTimeout(() => this.cooldowns.delete(cooldownKey), this.cooldown * 1000);
        }

        // Проверка прав
        if (this.permissions.length > 0 && message.member) {
            console.log('[DEBUG] Проверка прав...');
            const missingPerms = this.permissions.filter(
                perm => !message.member!.permissions.has(perm)
            );
            
            if (missingPerms.length > 0) {
                const permNames = missingPerms.map(p => 
                    Object.keys(PermissionFlagsBits).find(k => PermissionFlagsBits[k as keyof typeof PermissionFlagsBits] === p)
                ).filter(Boolean);
                
                await message.reply(
                    `Недостаточно прав. Требуется: ${permNames.join(', ')}`
                );
                return;
            }
        }

        // Обработка подкоманд
        if (this.subCommands.size > 0 && args.length > 0) {
            console.log('[DEBUG] Проверка подкоманд...');
            const subCmdName = args[0].toLowerCase();
            const subCmd = this.subCommands.get(subCmdName);
            
            if (subCmd) {
                await subCmd.execute(message, args.slice(1));
                return;
            }
            // Если подкоманда не найдена, продолжаем как обычную команду
        }

        if (this.executeFn) {
            console.log(`[DEBUG] Вызов executeFn для команды ${this.name}`);
            await this.executeFn(message, args);
        } else {
            console.log(`[DEBUG] У команды ${this.name} нет реализации execute`);
            // Можно добавить стандартный ответ, например:
            await message.reply('Команда не имеет реализации.');
        }
    }
}