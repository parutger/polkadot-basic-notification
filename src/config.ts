import yargs from "yargs";
import { readFileSync } from 'fs';
import { Address } from "@polkadot/types/interfaces/runtime";

// my best effort at creating rust-style enums, as per explained here:
//  https://www.jmcelwa.in/posts/rust-like-enums/
interface Only {
    only: string[],
}
interface Ignore {
    ignore: string[]
}
type FilterSubscription = "all" | Only | Ignore;


export interface ExtendedAccount {
    address: Address,
    nickname: string
}

export interface MatrixConfig {
    userId: string,
    accessToken: string,
    roomId: string,
    server: string,
}

export interface AppConfig {
    endpoints: string[],
    accounts: [string, string][],
    filter_subscription: FilterSubscription,
    matrix: MatrixConfig,
}

export class Config {

    config: AppConfig;

    constructor() {
        const argv = yargs(process.argv.slice(2))
            .option('c', {
                type: 'string',
                description: 'path to a JSON file with your config in it.',
                default: process.env.APP_CONFIG_FILE,
            }).parseSync();

        if (!argv.c) {
            console.error('-c or APP_CONFIG_FILE env variable must specify a config file');
            process.exit(1);
        }

        this.config = JSON.parse(readFileSync(argv.c).toString());

    }

}

