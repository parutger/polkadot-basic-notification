import { readFileSync } from 'fs'

import * as nodemailer from "nodemailer";
import * as openpgp from 'openpgp';

import { ReportHTML, Report, Reporter } from "./index"

export interface EmailConfig {
    from: string,
    to: string[],
    gpgpubkey?: string,
    transporter: any
}

export class EmailReporter implements Reporter {
    maybePubkey: openpgp.Key | undefined;
    transporter: nodemailer.Transporter;
    from: string;
    to: string[];

    constructor(config: EmailConfig) {
        if (config.transporter["dkim"]) {
            config.transporter["dkim"]["privateKey"] = readFileSync(config.transporter["dkim"]["privateKey"]).toString()
        }
        const transporter = nodemailer.createTransport(config.transporter);

        if (config.gpgpubkey) {
            openpgp.readKey({ armoredKey: readFileSync(config.gpgpubkey).toString() })
                .then((p) => this.maybePubkey = p);
        }

        this.transporter = transporter;
        this.from = config.from;
        this.to = config.to;
    }

    async maybeEncrypt(message: string): Promise<string> {
        if (this.maybePubkey) {
            const enc = await openpgp.encrypt({
                message: await openpgp.createMessage({ text: message }),
                encryptionKeys: this.maybePubkey,
            })
            return enc as string;
        } else {
            return message
        }
    }

    async verify(): Promise<boolean> {
        const outcome = await this.transporter.verify();
        return outcome;
    }

    async sendReport(report: Report): Promise<void> {
        const html = ReportHTML(report)
        const subject = `${report.chain} notification at ${report.blocknumber}`;

        await Promise.all(this.to.map(async (to) =>
            this.transporter.sendMail({
                from: this.from,
                to,
                subject,
                html: await this.maybeEncrypt(html),
            })
        ));
    }
}
