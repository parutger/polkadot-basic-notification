import yargs from "yargs";
import { readFileSync } from 'fs';
import * as yaml from 'js-yaml';

import { ExtendedAccount } from "./chain_monitor"
import { EmailConfig } from './reporters/email';
import { MatrixConfig } from './reporters/matrix';

import { Reporter, ConsoleReporter, EmailReporter, MatrixReporter } from "./reporters";

export interface AppConfig {
    endpoints: string[],
    accounts: ExtendedAccount[],
    eventFilter: string[],
    extrinsicFilter: string[],
    reporters: ReportersConfig;
}

interface ReportersConfig {
    email?: EmailConfig,
    matrix?: MatrixConfig,
    console?: boolean,
}

export class Config {

    config: AppConfig;
    reporters: Reporter[] = [];

    constructor() {
        try {
            const argv = yargs(process.argv.slice(2))
                .option('c', {
                    type: 'string',
                    description: 'path to a JSON or YAML config file.',
                    default: process.env.APP_CONFIG_FILE,
                }).parseSync();

            if (!argv.c) {
                console.error('-c or APP_CONFIG_FILE env variable must specify a config file');
                process.exit(1);
            }

            // Read configuration from either JSON or YAML file
            this.config = yaml.load(readFileSync(argv.c, 'utf8')) as AppConfig;

            // Accounts Filter
            if (this.config.accounts == undefined) {
                console.warn("No 'accounts' section found in config, defaulting to '[]'");
                this.config.accounts = []
            }

            // EventFilter
            if (this.config.eventFilter == undefined) {
                console.warn("No 'eventFilter' section found in config, defaulting to '[]'");
                this.config.eventFilter = []
            }

            // ExtrinsicFilter
            if (this.config.extrinsicFilter == undefined) {
                console.warn("No 'extrinsicFilter' section found in config, defaulting to '[]'");
                this.config.extrinsicFilter = []
            }

            // Matrix
            if (this.config.reporters.matrix !== undefined) {
                try {
                    if (typeof process.env.MATRIX_TOKEN !== undefined) {
                        this.config.reporters.matrix.accessToken = process.env.MATRIX_TOKEN || this.config.reporters.matrix.accessToken;
                    }
                    this.reporters.push(new MatrixReporter(this.config.reporters.matrix));
                } catch (error) {
                    console.error("Unable to connect to Matrix: ", error);
                    process.exit(1);
                }
            }

            // Email
            if (this.config.reporters.email !== undefined) {
                try {
                    this.reporters.push(new EmailReporter(this.config.reporters.email));
                } catch (error) {
                    console.error("Error while setting up Email: ", error);
                    process.exit(1);
                }
            }

            // Console
            if (this.config.reporters.console !== undefined && this.config.reporters.console === true) {
                this.reporters.push(new ConsoleReporter());
            }

        } catch (error) {
            console.error(`Unable to process config: \n %s`, error);
            process.exit(1);
        }
    }
}
