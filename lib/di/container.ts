// Lightweight DI container

import type { Token } from './types';

export type Factory<T> = (c: Container) => T;

type Registration<T> = { type: 'value'; value: T } | { type: 'factory'; factory: Factory<T>; singleton: boolean; instance?: T };

export class Container {
  private registry = new Map<symbol, Registration<any>>();

  registerValue<T>(token: Token<T>, value: T): this {
    this.registry.set(token as unknown as symbol, { type: 'value', value });
    return this;
  }

  registerFactory<T>(token: Token<T>, factory: Factory<T>, opts: { singleton?: boolean } = {}): this {
    this.registry.set(token as unknown as symbol, { type: 'factory', factory, singleton: !!opts.singleton });
    return this;
  }

  resolve<T>(token: Token<T>): T {
    const reg = this.registry.get(token as unknown as symbol);
    if (!reg) throw new Error(`DI: No registration for token`);

    if (reg.type === 'value') return reg.value as T;

    if (reg.singleton) {
      if (reg.instance === undefined) {
        reg.instance = reg.factory(this);
        this.registry.set(token as unknown as symbol, reg);
      }
      return reg.instance as T;
    }

    return reg.factory(this) as T;
  }
}

export const container = new Container();
