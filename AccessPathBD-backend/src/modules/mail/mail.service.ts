import { Global, Injectable, Logger, Module } from "@nestjs/common";
import * as nodemailer from "nodemailer";
import { appConfig } from "@/config/app.config";

/**
 * Sends email through SMTP when MAILER_* is configured.
 * Without SMTP (typical in development) the message is printed to the server
 * console instead, so you can click the reset / verification link yourself.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger("Mail");
  private readonly transport = appConfig.env.MAILER_HOST
    ? nodemailer.createTransport({
        host: appConfig.env.MAILER_HOST,
        port: appConfig.env.MAILER_PORT ?? 587,
        secure: appConfig.env.MAILER_PORT === 465,
        auth: appConfig.env.MAILER_USER
          ? {
              user: appConfig.env.MAILER_USER,
              pass: appConfig.env.MAILER_PASSWORD,
            }
          : undefined,
      })
    : null;

  async send(to: string, subject: string, text: string) {
    if (!this.transport) {
      if (appConfig.env.NODE_ENV === "production")
        this.logger.warn(
          `SMTP is not configured; email "${subject}" was not sent`,
        );
      else this.logger.log(`[DEV MAIL] to=${to}\nsubject: ${subject}\n${text}`);
      return;
    }
    try {
      await this.transport.sendMail({
        from:
          appConfig.env.MAILER_FROM ??
          "AccessPath BD <no-reply@accesspath.local>",
        to,
        subject,
        text,
      });
    } catch (e) {
      // Never fail the request because email is down
      this.logger.error(`Could not send "${subject}": ${(e as Error).message}`);
    }
  }
}

@Global()
@Module({ providers: [MailService], exports: [MailService] })
export class MailModule {}
