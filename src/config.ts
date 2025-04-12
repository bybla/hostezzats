// Project: Hostezza Discord Bot
// Created by: bybla
// Created on: 2025-04-11
// Descripton: Конфигурация бота, включая токен и ID клиента

import dotenv from "dotenv";

dotenv.config();

const { DISCORD_TOKEN, DISCORD_CLIENT_ID } = process.env;

if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID) {
  throw new Error("Missing environment variables");
}

export const config = {
  DISCORD_TOKEN,
  DISCORD_CLIENT_ID,
};
