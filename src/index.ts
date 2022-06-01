import { Config, AppConfig } from "./config"
import { Chainmon, Report, ExtrinsicItem, EventItem, ReportHTML } from "./chainmon";
import { Endpoint } from "./endpoints";
import { MatrixReporter } from "./matrixreporter";

import { Header } from "@polkadot/types/interfaces/runtime";
import "@polkadot/api-augment";
import "@polkadot/types-augment";


async function main() {
    //Prepare readiness probe, defaults to false.
    const readiness = new Endpoint();
    readiness.listen();

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

        const extrinsicItems: ExtrinsicItem[] = [];
        for (const extrinsic of data.extrinsics) {
            if (extrinsic.isSigned === true) {
                // if accounts is not empty,  and extrinsic.signer.value) is not found in the accounts addresses, skip this one
                if (config.accounts.length !== 0 &&
                    (config.accounts.some((obj) => { return obj.address == extrinsic.signer; }) === false)
                ) continue;

                const label = config.accounts.find(t => t.address == extrinsic.signer)?.label;
                const item: ExtrinsicItem = {
                    section: extrinsic.method.section.toString(),
                    method: extrinsic.method.method.toString(),
                    account: {
                        address: extrinsic.signer,
                        label: label ?? "unlabeled"
                    },
                };

                console.log(JSON.stringify(item));
                extrinsicItems.push(item);
            }
        }

        const eventItems: EventItem[] = [];
        for (const event of data.events) {
            // if eventFilter is NOT "all" and the event is not in eventFilter: Skip
            if (config.eventFilter !== "all" &&
                (config.eventFilter.some((obj) => { return obj === event.event.section + "." + event.event.method; }) === false)
            ) continue;

            const item: EventItem = {
                section: event.event.section.toString(),
                method: event.event.method.toString(),
                data: event.event.data.toJSON(),
            };

            console.log(JSON.stringify(item));
            eventItems.push(item);
        }

        if (extrinsicItems.length !== 0 || eventItems.length !== 0) {
            const report: Report = {
                chain: chain.chain,
                blocknumber: data.number,
                hash: data.hash,
                timestamp: data.timestamp,
                extrinsics: extrinsicItems,
                events: eventItems,
            }

            const message = ReportHTML(report);
            matrix.sendHTML(message);
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
    // Light up the readiness probe
    readiness.ready = true;
}

main().catch(console.error);
