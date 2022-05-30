import { createServer, Server } from 'http';

export class Endpoint {

    private port = 3000;
    private server: Server;

    ready = false;

    constructor() {
        this.server = createServer();

        this.server.on('request', async (req, res) => {
            if (this.ready) {
                res.writeHead(200);
                res.end('OK');
            } else {
                res.writeHead(500);
                res.end('NOT READY');
            }
        });
    }

    async listen() {
        this.server.listen(this.port);
    };
}
