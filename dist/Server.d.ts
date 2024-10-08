/// <reference types="node" />
import * as http from 'http';
declare type RequestHandler = (req: http.IncomingMessage, res: http.ServerResponse) => any | Promise<any>;
export interface TCPServerOpts {
    port: number;
    host?: string;
    ipv6Only?: boolean;
}
export interface IPCServerOpts {
    path: string;
    readableAll?: boolean;
    writableAll?: boolean;
    unlinkExistingFile?: boolean;
    forceReplaceSocket?: boolean;
}
export interface ListenOpts {
    backlog?: number;
    exclusive?: boolean;
}
declare type EndpointT = (number | TCPServerOpts) | (string | IPCServerOpts);
export default class Server {
    private _server;
    private _activeRequestsCount;
    private _closeCallback;
    constructor(requestHandler: RequestHandler);
    readonly activeRequestsCount: number;
    private static getServerOpts;
    private static isTCPServerOpts;
    listen(endpoint: EndpointT, opts?: ListenOpts): Promise<void>;
    close(): Promise<{}>;
    readonly instance: http.Server;
    private _listenTCP;
    private _isSocketAvailable;
    private _tryUnlinkExistingSocket;
    private static node_compat__setSocketMode;
    private _listenIPC;
    private _listen;
}
export {};
