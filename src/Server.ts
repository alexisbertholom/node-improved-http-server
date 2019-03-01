import * as http from 'http';
import * as net from 'net';
import * as fs from 'fs';

type RequestHandler = (req: http.IncomingMessage, res: http.ServerResponse) => void;

export interface TCPServerOpts
{
  port: number,
  host?: string,
  ipv6Only?: boolean,
};

export interface IPCServerOpts
{
  path: string,
  readableAll?: boolean,
  writableAll?: boolean,
  unlinkExistingFile?: boolean,
  forceReplaceSocket?: boolean,
};

export interface ListenOpts
{
  backlog?: number,
  exclusive?: boolean,
};

type EndpointT = (number | TCPServerOpts) | (string | IPCServerOpts);

export default class Server
{
  private _server: http.Server;

  constructor(requestHandler: RequestHandler)
  {
    this._server = http.createServer(requestHandler);
  }

  private static getServerOpts(endpoint: EndpointT): TCPServerOpts | IPCServerOpts
  {
    if (typeof(endpoint) === 'number')
      return { port: endpoint };
    if (typeof(endpoint) === 'string')
      return { path: endpoint };
    return endpoint;
  }

  private static isTCPServerOpts(opts: TCPServerOpts | IPCServerOpts): opts is TCPServerOpts
  {
    return ((opts as TCPServerOpts).port !== undefined);
  }

  public listen(endpoint: EndpointT, opts: ListenOpts = {}): Promise<void>
  {
    const serverOpts = Server.getServerOpts(endpoint);
    return (Server.isTCPServerOpts(serverOpts)) ? (
      this._listenTCP(serverOpts, opts)
    ) : (
      this._listenIPC(serverOpts, opts)
    );
  }

  public get instance(): http.Server
  {
    return this._server;
  }

  private _listenTCP(serverOpts: TCPServerOpts, opts: ListenOpts): Promise<void>
  {
    return this._listen({ ...serverOpts, ...opts });
  }

  private _isSocketAvailable(endpoint: string): Promise<boolean>
  {
    return new Promise<boolean>((resolve, reject) => {
      const client = new net.Socket();
      client.on('error', e => resolve(e['code'] === 'ECONNREFUSED'));
      client.connect(endpoint, () => resolve(false));
    }).catch(() => false);
  }

  private async _tryUnlinkExistingSocket(path: string, force?: boolean)
  {
    let stats: any/*TODO: statSync return type*/ = null;
    try
    {
      stats = fs.statSync(path);
    }
    catch (err)
    {
    }
    if (stats)
    {
      if (force || !stats.isSocket() || await this._isSocketAvailable(path))
        fs.unlinkSync(path);
    }
  }

  private async _listenIPC(serverOpts: IPCServerOpts, opts: ListenOpts): Promise<void>
  {
    const { unlinkExistingFile, forceReplaceSocket, ...rest } = serverOpts;
    if (unlinkExistingFile || (unlinkExistingFile !== false && forceReplaceSocket))
      await this._tryUnlinkExistingSocket(serverOpts.path, forceReplaceSocket);
    return this._listen({ ...rest, ...opts });
  }

  private _listen(opts/*: TODO: server.listen options type*/): Promise<void>
  {
    return new Promise<void>((resolve, reject) => {
      const ServerListenErrorListener = (err) => {
        reject(err);
        this._server.removeListener('error', ServerListenErrorListener);
      };
      this._server.prependListener('error', ServerListenErrorListener);
      this._server.listen(opts, () => {
        this._server.removeListener('error', ServerListenErrorListener);
        resolve();
      })
    });
  }
};
