import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { Queue, Worker } from "bullmq";
import type { ConnectionOptions } from "bullmq";
type EmailMessage = { to: string; subject: string; text: string };
interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}
class ResendProvider implements EmailProvider {
  async send(message: EmailMessage) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM,
        to: [message.to],
        subject: message.subject,
        text: message.text,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      throw new Error(`Email delivery failed with status ${response.status}`);
  }
}
@Injectable()
export class NotificationService implements OnModuleInit, OnModuleDestroy {
  private queue?: Queue<EmailMessage>;
  private worker?: Worker<EmailMessage>;
  private readonly provider: EmailProvider = new ResendProvider();
  onModuleInit() {
    if (process.env.DATABASE_MODE !== "postgres") return;
    if (
      !process.env.REDIS_URL ||
      !process.env.RESEND_API_KEY ||
      !process.env.MAIL_FROM
    )
      return;
    const url = new URL(process.env.REDIS_URL);
    const connection: ConnectionOptions = {
      host: url.hostname,
      port: Number(url.port || 6379),
      password: url.password || undefined,
      username: url.username || undefined,
      maxRetriesPerRequest: null,
      ...(url.protocol === "rediss:" ? { tls: {} } : {}),
    };
    this.queue = new Queue<EmailMessage>("aroundly-email", { connection });
    this.worker = new Worker<EmailMessage>(
      "aroundly-email",
      (job) => this.provider.send(job.data),
      { connection, concurrency: 3 },
    );
    this.worker.on("failed", (_job, error) =>
      console.error(
        JSON.stringify({
          level: "error",
          service: "email-worker",
          message: error.message,
        }),
      ),
    );
  }
  async recovery(to: string, token: string, kind: "reset" | "verify") {
    if (!this.queue) throw new Error("Email delivery is not configured.");
    const path = kind === "reset" ? "reset-password" : "verify-email";
    const subject =
      kind === "reset"
        ? "Reset your Aroundly password"
        : "Verify your Aroundly email";
    await this.queue.add(
      kind,
      {
        to,
        subject,
        text: `${subject}\n\nOpen this link within one hour:\n${process.env.WEB_URL || "http://localhost:3000"}/${path}?token=${encodeURIComponent(token)}\n\nIf you did not request this, you can ignore this message.`,
      },
      {
        attempts: 4,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: true,
        removeOnFail: 20,
      },
    );
  }
  async ready() {
    if (this.queue) await this.queue.getJobCounts();
    return { email: this.queue ? "configured" : "demo-or-unconfigured" };
  }
  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }
}
