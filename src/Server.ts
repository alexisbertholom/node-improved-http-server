import * as http from 'http';
import * as net from 'net';
import * as fs from 'fs';
import * as util from 'util';

const chmod = util.promisify(fs.chmod);

type RequestHandler = (req: http.IncomingMessage, res: http.ServerResponse) => any | Promise<any>;

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
  private _activeRequestsCount = 0;
  private _closeCallback: (() => void) | null = null;

  constructor(requestHandler: RequestHandler)
  {
    this._server = http.createServer((req, res) => {
      this._activeRequestsCount += 1;
      try
      {
        const result = requestHandler(req, res);
        if (('then' in result) && typeof result.then === 'function' && ('catch' in result) && typeof result.catch === 'function')
        {
          return result.then(() => {
            this._activeRequestsCount -= 1;
            if (this._closeCallback && this._activeRequestsCount === 0)
              this._closeCallback();
          }).catch((error) => {
            this._activeRequestsCount -= 1;
            if (this._closeCallback && this._activeRequestsCount === 0)
              this._closeCallback();
            throw error;
          });
        }
        else
        {
          this._activeRequestsCount -= 1;
          if (this._closeCallback && this._activeRequestsCount === 0)
            this._closeCallback();
        }
        return result;
      }
      catch (error)
      {
        this._activeRequestsCount -= 1;
        if (this._closeCallback && this._activeRequestsCount === 0)
          this._closeCallback();
        throw error;
      }
    });
  }

  public get activeRequestsCount()
  {
    return this._activeRequestsCount;
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

  public close()
  {
    this._server.close();
    return new Promise((resolve) => {
      if (this._activeRequestsCount === 0)
        resolve();
      else
        this._closeCallback = () => {
          this._closeCallback = null;
          resolve();
        };
    });
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

  private static node_compat__setSocketMode(serverOpts: IPCServerOpts)
  {
    const { path, readableAll, writableAll } = serverOpts;
    let mode = 0o660;
    if (readableAll)
      mode |= 0o004;
    if (writableAll)
      mode |= 0o002;
    return chmod(path, mode);
  }

  private async _listenIPC(serverOpts: IPCServerOpts, opts: ListenOpts): Promise<void>
  {
    const { unlinkExistingFile, forceReplaceSocket, ...rest } = serverOpts;
    if (unlinkExistingFile || (unlinkExistingFile !== false && forceReplaceSocket))
      await this._tryUnlinkExistingSocket(serverOpts.path, forceReplaceSocket);
    await this._listen({ ...rest, ...opts });
    await Server.node_compat__setSocketMode(serverOpts);
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
