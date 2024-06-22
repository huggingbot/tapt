import { Request, Response } from 'express';
import log from 'loglevel';
import { Telegraf } from 'telegraf';

import { getUserByUserId } from '@/database/queries/user';

if (!process.env.TELEGRAM_BOT_TOKEN) {
  throw new Error('Telegram bot token is missing');
}
const app = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

interface SendNotificationRequestBody {
  userId: number;
  message: string;
}

export async function sendNotificationHandler(req: Request, res: Response) {
  try {
    const { userId, message } = req.body as SendNotificationRequestBody;

    const user = await getUserByUserId(userId);
    if (!user) {
      return res.status(400).json({ success: false, message: `User not found with id, ${userId}` });
    }

    const msg = await app.telegram.sendMessage(user.telegramId, message);
    return res.status(200).json({ success: true, data: msg });
  } catch (e: unknown) {
    const errMsg = (e as Error).message || 'Unexpected error';
    log.error(`error during sending notifications: ${errMsg}`);
    return res.status(500).json({ success: false, message: errMsg });
  }
}
