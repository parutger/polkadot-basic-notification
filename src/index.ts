import { Config, AppConfig } from "./config"
import { Chainmon } from "./chainmon";
import { Header } from "@polkadot/types/interfaces/runtime";
import { MatrixReporter } from "./reporters/index"

import "@polkadot/api-augment";
import "@polkadot/types-augment";


async function main() {

    const config: AppConfig = new Config().config;

    const matrix = new MatrixReporter(config.matrix);
    matrix.send("Reporting in!");


    const Handler = async (blockheader: Header, chain: Chainmon) => {
        // Filter
        //
        // Generate Report
        //
        // Send it

        const data = await chain.getBlockData(blockheader);
        console.log(`Block ${data.number} has hash ${data.hash} on ${data.chain}, has ${data.events.length} events`);
        matrix.send(`Block ${data.number} has hash ${data.hash} on ${data.chain}, has ${data.events.length} events`);

    };

    await Promise.all(
        config.endpoints.map(
            async function(endpoint) {
                const chain = new Chainmon(endpoint);
                await chain.init();
                chain.subscribeHandler(async (blockheader: Header) => {
                    Handler(blockheader, chain);
                });
            }
        )
    );

}

main().catch(console.error);
