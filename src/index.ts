import { Config, AppConfig } from "./config"
import { ChainMonitor, Report, ExtrinsicItem, EventItem } from "./chain_monitor";
import { Healthprobe } from "./health_probes";

import { Header } from "@polkadot/types/interfaces/runtime";
import "@polkadot/api-augment";
import "@polkadot/types-augment";

async function main() {
    // Prepare readiness probe, defaults to false.
    const readiness = new Healthprobe();
    readiness.listen();

    const configurator = new Config()
    const config: AppConfig = configurator.config;

    // This function is passed to chainMonitor.subscribeHandler and is called every block.
    // Here is the main application logic that determines if a report is created
    // and which extrinsics/events are included
    async function BlockHandler(blockHeader: Header, chainMonitor: ChainMonitor): Promise<void> {
        // Retrieve the data from the block
        const data = await chainMonitor.getBlockData(blockHeader);

        // Prepare empty list for report
        const extrinsicItems: ExtrinsicItem[] = [];

        // For each extrinsic
        data.extrinsics.forEach((extrinsic, index) => {

            // extrinsicName is "section.Method"
            const extrinsicFound = config.extrinsicFilter.some((obj) => {
                return obj === extrinsic.method.section.toString() + "." + extrinsic.method.method.toString();
            })
            if (config.extrinsicFilter.length !== 0 && extrinsicFound == false) {
                return;
            }

            // Check if the extrinsic plaintexts holds any of the monitored addresses
            const extrinsicPlaintext = extrinsic.toString();
            const relatedAccount = config.accounts.find((e) => {
                if (e.address !== undefined) return extrinsicPlaintext.includes(e.address.toString());
            });

            // If config accounts is empty, we want to process each extrinsic
            if (config.accounts.length !== 0 && relatedAccount == undefined) {
                return;
            }

            const item: ExtrinsicItem = {
                index: index,
                section: extrinsic.method.section.toString(),
                method: extrinsic.method.method.toString(),
                account: relatedAccount,
                data: JSON.stringify(extrinsic.toHuman()),
            };

            // Add to report
            extrinsicItems.push(item);
        });

        // For each Event
        const eventItems: EventItem[] = [];
        for (const event of data.events) {
            // if eventFilter is NOT empty and the event is not in eventFilter: Skip
            if (config.eventFilter !== [] &&
                (config.eventFilter.some((obj) => { return obj === event.event.section + "." + event.event.method; }) === false)
            ) continue;

            const item: EventItem = {
                section: event.event.section.toString(),
                method: event.event.method.toString(),
                data: JSON.stringify(event.event.toHuman()),
            };

            // Add to report
            eventItems.push(item);
        }

        // Create a report if there is anything to.. report.
        if (extrinsicItems.length !== 0 || eventItems.length !== 0) {
            const report: Report = {
                chain: chainMonitor.chain,
                blocknumber: data.number,
                hash: data.hash,
                timestamp: data.timestamp,
                extrinsics: extrinsicItems,
                events: eventItems,
            }
            // For each reporter, call sendReport
            await Promise.all(configurator.reporters.map((reporter) => reporter.sendReport(report)))
        }
    } // End of BlockHandler

    await Promise.all(
        // For each endpoint, create a ChainMonitor instance and assign the blockhandler
        config.endpoints.map(
            async function(endpoint) {
                try {
                    // Create a ChainMonitor and initialize it.
                    const chainMonitor = new ChainMonitor(endpoint);
                    await chainMonitor.init();

                    // Here we use that blockhandler function we made earlier
                    chainMonitor.subscribeHandler(async (blockHeader: Header) => {
                        await BlockHandler(blockHeader, chainMonitor);
                    });
                } catch (error) {
                    // There is an edge-case where the listener does not reconnect.
                    // For now, just exit and let the OS restart the app/container.
                    console.error("Critical Error: ChainMonitor Crashed! \n %s", error)
                    process.exit(1);
                }
            }
        )
    );
    // Light up the readiness probe
    readiness.ready = true;
}

main().catch(console.error);
