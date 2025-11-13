// React Native environment DOM shims (compile-time only)
// Purpose: Allow RN projects with lib: ["esnext"] (no DOM) to reference common browser globals
// without pulling in the full DOM lib. All are typed as any to avoid leaking DOM types.
// Scope: Keep minimal to suppress TS errors where web-only code has guards.

// Global objects
declare const window: any;
declare const document: any;
declare const navigator: any;

// Observers and events
declare const MutationObserver: any;
declare const PageTransitionEvent: any;

declare type Event = any;
declare type KeyboardEvent = any;
declare type MouseEvent = any;

// Media APIs
declare const MediaRecorder: any;

// Fetch/Headers types used in non-DOM env
declare type HeadersInit = any;
declare type RequestInit = any;

// Streams & blobs (used only for typing in some utilities)
declare class ReadableStream<T = any> {
  getReader?: any;
}

declare type Blob = any;

declare class URLSearchParams {
  constructor(init?: any);
  append(name: string, value: string): void;
  set(name: string, value: string): void;
  get(name: string): string | null;
  getAll(name: string): string[];
  has(name: string): boolean;
  delete(name: string): void;
  entries(): IterableIterator<[string, string]>;
  keys(): IterableIterator<string>;
  values(): IterableIterator<string>;
  forEach(callback: (value: string, name: string) => void, thisArg?: any): void;
  toString(): string;
}

// Blob as a value and type
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
declare var Blob: {
  new (...args: any[]): any;
};

declare type Blob = any;

// MediaRecorder as value and type
declare class MediaRecorder {
  constructor(stream?: any, options?: any);
  start?: (...args: any[]) => void;
  stop?: (...args: any[]) => void;
  ondataavailable?: any;
}

// Keep simple type alias for places using it as a type
declare type MediaRecorderType = any;

// HTMLElement and friends (lightweight aliases)
declare type HTMLElement = any;
declare type HTMLDivElement = any;
declare type HTMLSpanElement = any;
declare type HTMLButtonElement = any;
