import { Config, AppConfig } from "./config"
import { Chainmon } from "./chainmon";
import { MatrixReporter } from "./reporters/index"

import { Header } from "@polkadot/types/interfaces/runtime";
import "@polkadot/api-augment";
import "@polkadot/types-augment";


async function main() {

    let config: AppConfig;
    try {
        config = new Config().config;
    } catch (error) {
        console.error("Unable to parse config: ", error);
        process.exit(1);
    }

    let matrix: MatrixReporter;
    try {
        matrix = new MatrixReporter(config.matrix);
        matrix.send("Reporting in!");
    } catch (error) {
        console.error("Unable to connect to Matrix: ", error);
        process.exit(1);
    }

    // This function is passed to the blockhandler and is called every block.
    const Handler = async (blockheader: Header, chain: Chainmon) => {
        const data = await chain.getBlockData(blockheader);


        let extrinsics = [];
        for (const extrinsic of data.extrinsics) {
            if (extrinsic.isSigned === true) {
                // if accounts is not empty,  and extrinsic.signer.value) is not found in the accounts addresses, skip this one
                if (config.accounts.length !== 0 &&
                    (config.accounts.some((obj) => { return obj.address === extrinsic.signer.value; }) === false)
                ) continue;

                const extrobj = {
                    "chain": chain.chain,
                    "block": data.number,
                    "type": "extrinsic",
                    "section": extrinsic.method.section,
                    "method": extrinsic.method.method,
                    "signer": extrinsic.signer.value.toString(),
                };
                console.log(extrobj);
                extrinsics.push(extrobj);
            }
        }

        let events = [];
        for (const event of data.events) {
            // if eventFilter is NOT "all" and the event is not in eventFilter: Skip
            if (config.eventFilter !== "all" &&
                (config.eventFilter.some((obj) => { return obj === event.event.section + "." + event.event.method; }) === false)
            ) continue;


            const eventobj = {
                "chain": chain.chain,
                "block": data.number,
                "type": "event",
                "section": event.event.section,
                "method": event.event.method,
                "data": event.event.data.toString()
            };
            console.log(eventobj);
            events.push(eventobj);
        }

        if ((extrinsics.length !== 0) || (events.length !== 0)) {
            // This will be a small report of the interesting events in this block
            matrix.send(`Block https://${chain.chain}.subscan.io/block/${data.number} chain ${chain.chain} matches on ${extrinsics.length} extrinsics and ${events.length} events `);
        }
    };

    await Promise.all(
        //For each endpoint
        config.endpoints.map(
            async function(endpoint) {
                const chain = new Chainmon(endpoint);
                await chain.init();

                //Here we use that blockhandler we made earlier
                chain.subscribeHandler(async (blockheader: Header) => {
                    Handler(blockheader, chain);
                });
            }
        )
    );

}

main().catch(console.error);
