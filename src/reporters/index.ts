import { Hash, Address } from "@polkadot/types/interfaces/runtime";
import { GenericExtrinsic, GenericEvent } from "@polkadot/types/";
import { Codec } from "@polkadot/types-codec/types";

import * as sdk from "matrix-js-sdk";

// To shut up the console.info log that matrix defaults with.
import { logger } from 'matrix-js-sdk/lib/logger';
import log from "loglevel";


const MAX_FORMATTED_MSG_LEN = 256;

enum COLOR {
    Primary = "#a3e4d7",
}

export interface MatrixConfig {
    userId: string,
    accessToken: string,
    roomId: string,
    server: string,
}

export enum ReportType {
    Event = "Event",
    Extrinsic = "Extrinsic",
}

export interface ExtendedAccount {
    address: Address,
    nickname: string
}

export function methodOf(input: ReportInput): string {
    if (input.type === ReportType.Event) {
        return input.inner.method.toString()
    } else {
        return (input.inner as GenericExtrinsic).meta.name.toString()
    }
}

interface ReportInput {
    account: ExtendedAccount,
    type: ReportType,
    inner: GenericEvent | GenericExtrinsic;
}

export interface Report {
    hash: Hash,
    number: number,
    chain: string,
    timestamp: number,
    inputs: ReportInput[]
}

export interface Reporter {
    report(report: Report): Promise<void>;

}

export class GenericReporter {
    meta: Report;

    constructor(meta: Report) {
        this.meta = meta;
    }

    trimStr(str: string): string {
        return str.length < MAX_FORMATTED_MSG_LEN ? str : `${str.substring(0, MAX_FORMATTED_MSG_LEN / 2)}..${str.substring(str.length - MAX_FORMATTED_MSG_LEN / 2, str.length)}`
    }

    formatData(data: Codec): string {
        return this.trimStr(data.toString())
    }

    subscan(): string {
        return `https://${this.meta.chain.toLowerCase()}.subscan.io/block/${this.meta.number}`
    }

    chain(): string {
        return `<b style="background-color: ${COLOR.Primary}">${this.meta.chain}</b>`
    }

    method(input: ReportInput): string {
        return methodOf(input)
    }

    data(input: ReportInput): string {
        if (input.type === ReportType.Event) {
            return `[${(input.inner as GenericEvent).data.map((d) => this.formatData(d)).join(', ')}]`
        } else {
            return `[${(input.inner as GenericExtrinsic).method.args.map((d) => this.formatData(d)).join(', ')}]`
        }
    }

    HTMLTemplate(): string {
        const { inputs } = this.meta;
        const trimmedInputs = inputs.map(({ account, type, inner }) => { return { account, type, inner: this.trimStr(inner.toString()) } });
        return `
<p>
	<p>📣 <b> Notification</b> at ${this.chain()} #<a href='${this.subscan()}'>${this.meta.number}</a> aka ${new Date(this.meta.timestamp).toTimeString()}</p>
	<ul>
		${this.meta.inputs.map((i) => `
		<li>
			💻 type: ${i.type} |
			for <b style="background-color: ${COLOR.Primary}">${i.account.nickname}</b> (${i.account.address}) |
			method: <b style="background-color: ${COLOR.Primary}">${this.method(i)}</b> |
			data: ${this.data(i)}
		</li>`
        )}
	</ul>
</p>
<details>
	<summary>Raw details</summary>
	<code>${JSON.stringify(trimmedInputs)}</code>
</details>
`
    }

    rawTemplate(): string {
        return `🎤 Events at #${this.meta.number}:  ${this.meta.inputs.map((i) => `[🧾 ${i.type} for ${i.account.nickname} | 💻 method:${this.method(i)} | 💽 data: ${this.data(i)}]`)} (${this.subscan()})`
    }
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
        console.info(`registering matrix reporter from ${config.userId} to ${this.roomId}@${config.server}.`)
    }

    async report(meta: Report): Promise<void> {
        const innerContent = new GenericReporter(meta).HTMLTemplate();
        const content = {
            "formatted_body": innerContent,
            "body": innerContent,
            "msgtype": "m.text",
            "format": "org.matrix.custom.html",

        };
        await this.client.sendEvent(this.roomId, "m.room.message", content, "");
    }

    async send(msg: string): Promise<void> {
        const content = {
            "body": msg,
            "msgtype": "m.notice"
        };
        await this.client.sendEvent(this.roomId, "m.room.message", content);
    }
}

