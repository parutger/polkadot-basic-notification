import { Hash } from "@polkadot/types/interfaces/runtime";
import { GenericExtrinsic, GenericEvent } from "@polkadot/types/";
import { Codec } from "@polkadot/types-codec/types";
import { logger } from "../logger";
import * as sdk from "matrix-js-sdk";
import { ExtendedAccount, MatrixConfig, ReportType } from "..";
import { ApiPromise } from "@polkadot/api";

const MAX_FORMATTED_MSG_LEN = 256;

enum COLOR {
	Primary = "#a3e4d7",
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
	api: ApiPromise,
}

export interface Reporter {
	report(report: Report): Promise<void>;

}

export class GenericReporter  {
	meta: Report;

	constructor(meta: Report) {
		this.meta = meta;
	}

	trimStr(str: string): string {
		return str.length < MAX_FORMATTED_MSG_LEN ? str : `${str.substring(0, MAX_FORMATTED_MSG_LEN / 2)}..${str.substring(str.length - MAX_FORMATTED_MSG_LEN / 2, str.length)}`
	}

	formatData(data: Codec): string {
		const r = data.toRawType().toLowerCase();
		if (r == "u128" || r.toLowerCase() == "balance") {
			return this.meta.api.createType('Balance', data).toHuman()
		} else {
			return this.trimStr(data.toString())
		}
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
		const { api, inputs, ...withoutApi } = this.meta;
		const trimmedInputs = inputs.map(({ account, type, inner }) => { return { account, type, inner: this.trimStr(inner.toString())}});
		// @ts-ignore
		withoutApi.inputs = trimmedInputs;
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
	<code>${JSON.stringify(withoutApi)}</code>
</details>
`
	}

	rawTemplate(): string {
		return `🎤 Events at #${this.meta.number}:  ${this.meta.inputs.map((i) => `[🧾 ${i.type} for ${i.account.nickname} | 💻 method:${this.method(i)} | 💽 data: ${this.data(i)}]`)} (${this.subscan()})`
	}
}

export class ConsoleReporter implements Reporter {
	constructor() {
		logger.info(`✅ registering console reporter`)
	}

	report(meta: Report): Promise<void> {
		console.log(new GenericReporter(meta).rawTemplate())
		return Promise.resolve()
	}
}

export class MatrixReporter implements Reporter {
	client: sdk.MatrixClient;
	roomId: string;
	constructor(config: MatrixConfig) {
		this.client = sdk.createClient({
			baseUrl: config.server,
			accessToken: config.accessToken,
			userId: config.userId,
		});
		this.roomId = config.roomId;
		logger.info(`✅ registering matrix reporter from ${config.userId} to ${this.roomId}@${config.server}.`)
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
}

