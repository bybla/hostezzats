// Project: Hostezza Discord Bot
// Created by: bybla
// Created on: 2025-04-11
// Descripton: Основной файл бота, который запускает его и обрабатывает события

import prisma from './db';
import { Client, GatewayIntentBits } from "discord.js";

import { config } from "./config";

import { StatusManager } from './utils/bot/statusManager';
import { CommandHandler } from "./utils/commands/commandHandler";


import pingCommand from "./commands/ping";
import reportCommand from "./commands/other/report/report";
import moderatorReportCommand from "./commands/other/report/moder_report";

const client = new Client({
    intents: [GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.DirectMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildMessageReactions,
                GatewayIntentBits.GuildMembers],
});

const commandHandler = new CommandHandler('?');

commandHandler.registerCommand(pingCommand);
commandHandler.registerCommand(reportCommand);
commandHandler.registerCommand(moderatorReportCommand);

client.once("ready", async () => {
    console.log("Discord bot is ready! 🤖");

    const statusManager = new StatusManager(client);
    await statusManager.start();

    prisma.$connect()
    .then(() => console.log('✅ Подключено к БД'))
    .catch((err) => console.error('❌ Ошибка БД:', err));

    // При завершении (Ctrl+C)
    process.on('SIGINT', async () => {
        await prisma.$disconnect();
        process.exit();
    });

});

client.on('messageCreate', (message) => {
    commandHandler.handleMessage(message).catch(console.error);
});

client.login(config.DISCORD_TOKEN);