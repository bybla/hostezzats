// Project: Hostezza Discord Bot
// Created by: bybla
// Created on: 2025-04-11
// Descripton: Команда ping для проверки бота


// commands/ping.ts
import { Command } from '../utils/commands/command';
import { Message } from 'discord.js';

export default new Command({
    name: 'ping',
    aliases: ['p'],
    description: 'Проверка бота',
    execute: async (message: Message) => {
        await message.reply('Pong!');
    }
});