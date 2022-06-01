import { Config, AppConfig } from "./config"
import { Chainmon, Report, ExtrinsicItem, EventItem, ReportHTML } from "./chainmon";
import { Healthprobe } from "./healthprobes";
import { MatrixReporter } from "./matrixreporter";

import { Header } from "@polkadot/types/interfaces/runtime";
import "@polkadot/api-augment";
import "@polkadot/types-augment";


async function main() {
    //Prepare readiness probe, defaults to false.
    const readiness = new Healthprobe();
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
    // Here is the main application logic that determines if a report is created
    // and which extrinsics/events are included
    //
    const Handler = async (blockheader: Header, chain: Chainmon) => {
        // Retrieve the data from the block
        const data = await chain.getBlockData(blockheader);

        // For each extrinsic
        const extrinsicItems: ExtrinsicItem[] = [];
        data.extrinsics.forEach((extrinsic, index) => {
            if (extrinsic.isSigned === true) {
                // if accounts is not empty,  and extrinsic.signer.value) is not found in the accounts addresses, skip this one
                if (config.accounts.length !== 0 &&
                    (config.accounts.some((obj) => { return obj.address == extrinsic.signer; }) === false)
                ) return;
                console.log(extrinsic);
                // Grab the label for the account
                const label = config.accounts.find(t => t.address == extrinsic.signer)?.label;
                // Populate item
                const item: ExtrinsicItem = {
                    index: index,
                    section: extrinsic.method.section.toString(),
                    method: extrinsic.method.method.toString(),
                    account: {
                        address: extrinsic.signer,
                        label: label ?? "unlabeled"
                    },

                };
                // Log to stdout and add to report
                console.log(JSON.stringify(item));
                extrinsicItems.push(item);
            }
        });

        // For each Event
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

            // Log to stdout and add to report
            console.log(JSON.stringify(item));
            eventItems.push(item);
        }

        // Create a report if there is anything to.. report.
        if (extrinsicItems.length !== 0 || eventItems.length !== 0) {
            const report: Report = {
                chain: chain.chain,
                blocknumber: data.number,
                hash: data.hash,
                timestamp: data.timestamp,
                extrinsics: extrinsicItems,
                events: eventItems,
            }
            // Make a pretty html and send it to the matrix channel
            const message = ReportHTML(report);
            matrix.sendHTML(message);
        }
    };

    await Promise.all(
        //For each endpoint, create a mon and assign a blockhandler
        config.endpoints.map(
            async function(endpoint) {
                // Create a chainmon and initialize it.
                const chain = new Chainmon(endpoint);
                await chain.init();

                //Here we use that blockhandler function we made earlier
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
