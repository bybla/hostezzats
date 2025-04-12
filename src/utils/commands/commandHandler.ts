// Project: Hostezza Discord Bot
// Created by: bybla
// Created on: 2025-04-11
// Descripton: Обработка текстовых команд Discord бота. Зачем? Потому что это удобно и позволяет легко добавлять новые команды без изменения основного кода бота.

// utils/commands/commandHandler.ts
import { Message } from 'discord.js';
import { Command } from './command'
import * as fs from 'fs';
import path from 'path';

export class CommandHandler {
    private commands: Map<string, Command> = new Map();
    private prefix: string;

    constructor(prefix: string) {
        this.prefix = prefix;
    }

    public registerCommand(command: Command): void {
        this.commands.set(command.name.toLowerCase(), command);
        command.aliases.forEach(alias => {
            this.commands.set(alias.toLowerCase(), command);
        });
    }

    public async handleMessage(message: Message): Promise<void> {
        if (message.author.bot || !message.content.startsWith(this.prefix)) return;

        const args = message.content.slice(this.prefix.length).trim().split(/ +/);
        const commandName = args.shift()?.toLowerCase();

        console.log(`[Commands Handler] Обработка команды: ${commandName} от ${message.author.tag}`);

        if (!commandName) return;

        const command = this.commands.get(commandName);
        if (!command) {
            await message.reply(`Неизвестная команда. Напишите \`${this.prefix}help\` для списка команд.`);
            return;
        }

        try {
            await command.execute(message, args);
        } catch (error) {
            console.error(`Ошибка выполнения команды ${commandName}:`, error);
            await message.reply('Произошла ошибка при выполнении команды.');
        }
    }

    public getCommands(): Command[] {
        return Array.from(new Set(this.commands.values())); // Убираем дубли
    }

    public unregisterCommand(commandName: string): boolean {
        const command = this.commands.get(commandName.toLowerCase());
        if (!command) return false;

        // Удаляем основное имя команды
        this.commands.delete(command.name.toLowerCase());

        // Удаляем алиасы
        command.aliases.forEach(alias => {
            this.commands.delete(alias.toLowerCase());
        });

        return true;
    }

    public async loadCommands(commandsDir: string): Promise<void> {
        const commandFiles = fs.readdirSync(commandsDir)
            .filter(file => file.endsWith('.ts') || file.endsWith('.js'));

        for (const file of commandFiles) {
            const filePath = path.join(commandsDir, file);
            const commandModule = await import(filePath);
            const command = commandModule.default || commandModule.command;

            if (command instanceof Command) {
                this.registerCommand(command);
                console.log(`[Commands Handler] Команда ${command.name} загружена.`);
            } else {
                console.error(`[Commands Handler] Файл ${file} не экспортирует команду.`);
            }
        }
    }
}