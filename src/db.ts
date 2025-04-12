// Project: Hostezza Discord Bot
// Created by: bybla
// Created on: 2025-04-12
// Descripton: Файл для работы с базой данных, используя Prisma


// src/db.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
export default prisma;