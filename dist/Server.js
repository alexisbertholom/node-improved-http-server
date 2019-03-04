"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) if (e.indexOf(p[i]) < 0)
            t[p[i]] = s[p[i]];
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
const http = require("http");
const net = require("net");
const fs = require("fs");
const util = require("util");
const chmod = util.promisify(fs.chmod);
;
;
;
class Server {
    constructor(requestHandler) {
        this._server = http.createServer(requestHandler);
    }
    static getServerOpts(endpoint) {
        if (typeof (endpoint) === 'number')
            return { port: endpoint };
        if (typeof (endpoint) === 'string')
            return { path: endpoint };
        return endpoint;
    }
    static isTCPServerOpts(opts) {
        return (opts.port !== undefined);
    }
    listen(endpoint, opts = {}) {
        const serverOpts = Server.getServerOpts(endpoint);
        return (Server.isTCPServerOpts(serverOpts)) ? (this._listenTCP(serverOpts, opts)) : (this._listenIPC(serverOpts, opts));
    }
    get instance() {
        return this._server;
    }
    _listenTCP(serverOpts, opts) {
        return this._listen(Object.assign({}, serverOpts, opts));
    }
    _isSocketAvailable(endpoint) {
        return new Promise((resolve, reject) => {
            const client = new net.Socket();
            client.on('error', e => resolve(e['code'] === 'ECONNREFUSED'));
            client.connect(endpoint, () => resolve(false));
        }).catch(() => false);
    }
    async _tryUnlinkExistingSocket(path, force) {
        let stats = null;
        try {
            stats = fs.statSync(path);
        }
        catch (err) {
        }
        if (stats) {
            if (force || !stats.isSocket() || await this._isSocketAvailable(path))
                fs.unlinkSync(path);
        }
    }
    static node_compat__setSocketMode(serverOpts) {
        const { path, readableAll, writableAll } = serverOpts;
        let mode = 0o660;
        if (readableAll)
            mode |= 0o004;
        if (writableAll)
            mode |= 0o002;
        return chmod(path, mode);
    }
    async _listenIPC(serverOpts, opts) {
        const { unlinkExistingFile, forceReplaceSocket } = serverOpts, rest = __rest(serverOpts, ["unlinkExistingFile", "forceReplaceSocket"]);
        if (unlinkExistingFile || (unlinkExistingFile !== false && forceReplaceSocket))
            await this._tryUnlinkExistingSocket(serverOpts.path, forceReplaceSocket);
        await this._listen(Object.assign({}, rest, opts));
        await Server.node_compat__setSocketMode(serverOpts);
    }
    _listen(opts) {
        return new Promise((resolve, reject) => {
            const ServerListenErrorListener = (err) => {
                reject(err);
                this._server.removeListener('error', ServerListenErrorListener);
            };
            this._server.prependListener('error', ServerListenErrorListener);
            this._server.listen(opts, () => {
                this._server.removeListener('error', ServerListenErrorListener);
                resolve();
            });
        });
    }
}
exports.default = Server;
;
//# sourceMappingURL=Server.js.map