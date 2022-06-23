import * as sdk from "matrix-js-sdk";
import { Report, Reporter, ReportHTML } from "./index"

// To shut up the console.info log that matrix defaults with.
import { logger } from 'matrix-js-sdk/lib/logger';
import log from "loglevel";

export interface MatrixConfig {
    userId: string,
    accessToken: string,
    roomId: string,
    server: string,
}

export class MatrixReporter implements Reporter {
    private client: sdk.MatrixClient;
    roomId: string;
    constructor(config: MatrixConfig) {
        this.client = sdk.createClient({
            baseUrl: config.server,
            accessToken: config.accessToken,
            userId: config.userId,
        });
        this.roomId = config.roomId;

        logger.setLevel(log.levels.INFO, false);
    }

    async sendReport(report: Report): Promise<void> {
        const html = ReportHTML(report);
        const content = {
            "formatted_body": html,
            "body": html,
            "msgtype": "m.text",
            "format": "org.matrix.custom.html",
        };
        await this.client.sendEvent(this.roomId, "m.room.message", content, "");
    }

    async sendText(message: string): Promise<void> {
        const content = {
            "body": message,
            "msgtype": "m.notice"
        };
        await this.client.sendEvent(this.roomId, "m.room.message", content);
    }
}

