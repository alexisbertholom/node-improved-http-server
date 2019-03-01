/// <reference types="node" />
import * as http from 'http';
declare type RequestHandler = (req: http.IncomingMessage, res: http.ServerResponse) => void;
interface TCPServerOpts {
    port: number;
    host?: string;
    ipv6Only?: boolean;
}
interface IPCServerOpts {
    path: string;
    readableAll?: boolean;
    writableAll?: boolean;
    unlinkExistingFile?: boolean;
    forceReplaceSocket?: boolean;
}
interface ListenOpts {
    backlog?: number;
    exclusive?: boolean;
}
declare type EndpointT = (number | TCPServerOpts) | (string | IPCServerOpts);
export default class Server {
    private _server;
    constructor(requestHandler: RequestHandler);
    private static getServerOpts;
    private static isTCPServerOpts;
    listen(endpoint: EndpointT, opts?: ListenOpts): Promise<void>;
    readonly instance: http.Server;
    private _listenTCP;
    private _isSocketAvailable;
    private _tryUnlinkExistingSocket;
    private _listenIPC;
    private _listen;
}
export {};
