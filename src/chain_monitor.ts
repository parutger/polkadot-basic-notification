import { ExtendedAccount } from "./config"
import { ApiPromise, WsProvider } from "@polkadot/api";
import { Hash, Header } from "@polkadot/types/interfaces/runtime";
import { GenericExtrinsic } from "@polkadot/types/"

import "@polkadot/api-augment";
import "@polkadot/types-augment";

const DEBUG = true;

export interface ExtrinsicItem {
    index: number,
    section: string,
    method: string,
    account: ExtendedAccount,
}

export interface EventItem {
    section: string,
    method: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any, // any is correct for now because it's a mutable type
}

// This holds the raw blockdata,
// the blockhandler extracts relevant data into a "Report" item.
export interface blockData {
    chain: string,
    number: number,
    hash: Hash,
    timestamp: number,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    events: any[], //any is correct for now because it's a mutable type
    extrinsics: GenericExtrinsic[]
}

export interface Report {
    chain: string,
    blocknumber: number,
    hash: Hash,
    timestamp: number,
    extrinsics?: ExtrinsicItem[],
    events?: EventItem[],
}


export class ChainMonitor {
    private provider!: WsProvider;
    private api!: ApiPromise;
    chain!: string;


    constructor(
        private rpcEndpoint: string
    ) {
        this.provider = new WsProvider(this.rpcEndpoint);
        this.api = new ApiPromise({ provider: this.provider });
    }

    // This allows us to await for the chain initialization
    // You can not await a constructor. It also gets the chain name from the api
    async init() {
        await this.api.isReady;
        this.chain = (await this.api.rpc.system.chain()).toString()
    }

    // todo: define function interface
    async subscribeHandler(handler: (h: Header) => void) {
        let prevblock: number | undefined = undefined;

        this.api.rpc.chain.subscribeFinalizedHeads((header) => {

            // GrandPa can finalize a few block at once, leading to skipped block in the finalization head.
            if (prevblock !== undefined && (header.number.toNumber() - prevblock) != 1) {

                const amountSkipped = (header.number.toNumber() - 1) - prevblock;

                // creates an array of all blocknumbers between the previous blocknumber and the current blocknumber
                const listOfSkippedBlocks = Array.from(Array(amountSkipped).keys()).map(x => x + 1 + (prevblock || 0));
                if (DEBUG) console.log(`${this.chain}: skipped blocks: ${listOfSkippedBlocks}`);

                listOfSkippedBlocks.map(
                    async (blockNumber) => {
                        const blockHash = await this.api.rpc.chain.getBlockHash(blockNumber);
                        const header: Header = await this.api.rpc.chain.getHeader(blockHash);

                        if (DEBUG) console.log(`${this.chain}: handling skipped ${header.number.toNumber()}`);
                        // Run the handler we got as an argument, on the blockheader
                        handler(header);
                    })
            }

            console.log(`${this.chain}: handling ${header.number.toNumber()}`);
            // Run the handler we got as an argument, on the blockheader
            handler(header);

            // Sets handled block for next cycle
            prevblock = header.number.toNumber();
        });
    }

    async getBlockData(blockheader: Header) {
        const blockApi = await this.api.at(blockheader.hash);
        const timestamp = (await blockApi.query.timestamp.now()).toBn().toNumber()
        const events = await blockApi.query.system.events();

        const signedBlock = await this.api.rpc.chain.getBlock(blockheader.hash);
        const extrinsics = signedBlock.block.extrinsics;

        // downstream functions need these values.
        const block: blockData = {
            chain: this.chain,
            number: blockheader.number.toNumber(),
            hash: blockheader.hash,
            timestamp: timestamp,
            events: events,
            extrinsics: extrinsics
        };
        return block;
    }
}


