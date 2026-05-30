import { prisma } from '../lib/prisma.js';

export async function logActivity(
  type: string,
  message: string,
  details?: Record<string, unknown>,
  jobId?: string
): Promise<void> {
  await prisma.activityLog.create({
    data: {
      type,
      message,
      details: details ? JSON.stringify(details) : null,
      jobId,
    },
  });
}

export async function notify(
  title: string,
  message: string,
  type: 'info' | 'success' | 'warning' | 'error' = 'info',
  jobId?: string
): Promise<void> {
  await prisma.notification.create({
    data: { title, message, type, jobId },
  });
}
