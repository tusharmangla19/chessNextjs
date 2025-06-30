declare module 'simple-peer-light' {
  import { EventEmitter } from 'events';

  interface SimplePeerOptions {
    initiator?: boolean;
    stream?: MediaStream;
    trickle?: boolean;
    config?: {
      iceServers?: RTCIceServer[];
    };
  }

  class SimplePeer extends EventEmitter {
    constructor(options?: SimplePeerOptions);
    
    signal(data: any): void;
    destroy(): void;
    
    on(event: 'signal', listener: (data: any) => void): this;
    on(event: 'stream', listener: (stream: MediaStream) => void): this;
    on(event: 'connect', listener: () => void): this;
    on(event: 'close', listener: () => void): this;
    on(event: 'error', listener: (error: Error) => void): this;
  }

  export = SimplePeer;
} 