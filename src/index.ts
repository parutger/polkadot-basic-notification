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

        // For each extrinsic
        const extrinsicItems: ExtrinsicItem[] = [];
        data.extrinsics.forEach((extrinsic, index) => {
            if (extrinsic.isSigned === true) {
                // IF accounts array is not empty,
                // AND extrinsic.signer is not found in the accounts addresses,
                // AND extrinsic plaintext does not contain monitored addresses
                // THEN skip this one
                if (config.accounts.length !== 0 &&
                    (config.accounts.some((obj) => { return obj.address == extrinsic.signer; }) === false) &&
                    (config.accounts.find((e) => extrinsic.toString().includes(e.address.toString())) === undefined)
                ) return;
                // If the extrinsic is NOT signed, check if account is anywhere in the extrinsic plaintext
            } else if (config.accounts.find((e) => extrinsic.toString().includes(e.address.toString())) === undefined) {
                return;
            }

            // Grab the label for the account
            const label = config.accounts.find(t => t.address == extrinsic.signer)?.label;
            // Populate item
            const item: ExtrinsicItem = {
                index: index,
                section: extrinsic.method.section.toString(),
                method: extrinsic.method.method.toString(),
                account: {
                    address: extrinsic.signer,
                    label: label ?? "Monitored Account is Recipient"
                },
                data: JSON.stringify(extrinsic.toHuman()),
            };

            // Add to report
            extrinsicItems.push(item);
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
                    console.error("Listener broke: %s", error)
                }
            }
        )
    );
    // Light up the readiness probe
    readiness.ready = true;
}

main().catch(console.error);
