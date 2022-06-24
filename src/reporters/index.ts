import { Report } from "../chain_monitor";

export { MatrixReporter } from "./matrix";
export { EmailReporter } from "./email";
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
        listExtrinsics = report.extrinsics.map((item) => `
            <li>
               Extrinsic <a href='https://${report.chain}.subscan.io/extrinsic/${report.blocknumber}-${item.index}'>#${report.blocknumber}-${item.index}</a></br>
               | <b style='background-color: #a3e4d7'> ${item.account.address.toString()} </b> ${item.account.label}
               | method: <b style="background-color: #a3e4d7" > ${item.section}.${item.method} </b>
            </li>`);
    }

    let listEvents: string[] = [];
    if (typeof report.events !== 'undefined') {
        listEvents = report.events.map((item) => `
            <li>
               Event | method: <b style="background-color: #a3e4d7" > ${item.section}.${item.method} </b></br>
               Data | ${JSON.stringify(item.data)}
            </li>`);
    }

    const footer = `
        </ul>
        <details>
        <summary>Raw details </summary>
        <code> ${JSON.stringify(report.extrinsics)} ${JSON.stringify(report.events)} </code>
        </details>`;

    return header + listExtrinsics + listEvents + footer;
}
