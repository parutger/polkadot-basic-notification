import { Report } from "../chain_monitor";

export { MatrixReporter } from "./matrix";
export { EmailReporter } from "./email";
export { ConsoleReporter } from "./console";
export type { Report } from "../chain_monitor";

export interface Reporter {
    sendReport(report: Report): Promise<void>;
}

export function ReportHTML(report: Report) {
    const header = `<p>
        <p>📣 <b> Notification</b> at ${report.chain}
            <a href='https://${report.chain}.subscan.io/block/${report.blocknumber}'>#${report.blocknumber}</a>
            on ${new Date(report.timestamp).toTimeString()}</p>
        <ul>`;

    let listExtrinsics: string[] = [];
    if (typeof report.extrinsics !== 'undefined') {
        listExtrinsics = report.extrinsics.map((item) => {
            // Populate item, but remove the args due to maximum message size.
            const truncatedData = JSON.parse(item.data);
            delete truncatedData.method?.args;
            return `<li>
               Extrinsic <a href='https://${report.chain}.subscan.io/extrinsic/${report.blocknumber}-${item.index}'>#${report.blocknumber}-${item.index}</a></br>
               ${item.account?.address ? item.account?.address?.toString() : ''} ${item.account?.label || ''}
               | method: <b>${item.section}.${item.method}</b></br>
               <details>
               <summary>Details</summary>
               <code> ${JSON.stringify(truncatedData)} </code>
               </details>
            </li>`});
    }

    let listEvents: string[] = [];
    if (typeof report.events !== 'undefined') {
        listEvents = report.events.map((item) => `
            <li>
               Event | method: <b>${item.section}.${item.method}</b></br>
               <details>
               <summary>Details</summary>
               <code> ${item.data} </code>
               </details>
            </li>`);
    }

    const footer = `
        </ul>`;

    return header + listExtrinsics + listEvents + footer;
}
