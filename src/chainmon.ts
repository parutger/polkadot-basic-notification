import { ApiPromise, WsProvider } from "@polkadot/api";
import { Header } from "@polkadot/types/interfaces/runtime";

export class Chainmon {
    private provider!: WsProvider;
    private api!: ApiPromise;
    chain!: string;


    constructor(
        private rpcEndpoint: string
    ) {
        this.provider = new WsProvider(this.rpcEndpoint);
        this.api = new ApiPromise({ provider: this.provider });
    }

    async init() {
        await this.api.isReady;
        this.chain = (await this.api.rpc.system.chain()).toString()
    }

    // todo: define function interface
    async subscribeHandler(handler: (h: Header) => void) {
        this.api.rpc.chain.subscribeFinalizedHeads((header) => {
            handler(header);
        });
    }

    async getBlockData(blockheader: Header) {
        const blockApi = await this.api.at(blockheader.hash);
        const timestamp = (await blockApi.query.timestamp.now()).toBn().toNumber()
        const events = await blockApi.query.system.events();
        //const signedBlock = await this.api.rpc.chain.getBlock(blockheader.hash);
        //const extrinsics = signedBlock.block.extrinsics;

        // downstream functions need these values.
        // TODO: define interface for this
        return {
            chain: this.chain,
            number: blockheader.number.toNumber(),
            hash: blockheader.hash,
            timestamp: timestamp,
            events: events
        };
    }
}

//async function test() {
//    try {
//        const myx = new Chainmon('wss://rpc.polkadot.io');
//        await myx.init();
//        myx.subscribeHandler(async (blockheader: Header) => {
//            const data = await myx.getBlockData(blockheader);
//            console.log(`Block ${data.number} has hash ${data.hash} on ${data.chain}, has ${data.events.length} events`);
//        });
//    } catch (err) {
//        console.error(err);
//    }
//}
//
//test().catch(console.error)
