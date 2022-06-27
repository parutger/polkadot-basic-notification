import { Report, Reporter } from "./index"

export class ConsoleReporter implements Reporter {
    async sendReport(report: Report): Promise<void> {
        report.extrinsics?.map((e) => {
            const ex = {
                chain: report.chain,
                block: report.blocknumber,
                data: JSON.parse(e.data),
            };
            console.log(JSON.stringify(ex));
        });
        report.events?.map((e) => {
            const ev = {
                chain: report.chain,
                block: report.blocknumber,
                data: JSON.parse(e.data),
            }
            console.log(JSON.stringify(ev));
        });
    }
}
