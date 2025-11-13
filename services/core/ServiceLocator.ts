/**
 * Service Locator for Dependency Injection
 * 
 * Provides a simple registry for managing singleton instances across the app.
 * This helps break circular dependencies by allowing lazy resolution of services.
 */

export class ServiceLocator {
  private registry = new Map<string, any>();

  /**
   * Register a service instance
   */
  register(name: string, instance: any): void {
    this.registry.set(name, instance);
  }

  /**
   * Get a service instance by name
   */
  get<T = any>(name: string): T | undefined {
    return this.registry.get(name);
  }

  /**
   * Check if a service is registered
   */
  has(name: string): boolean {
    return this.registry.has(name);
  }

  /**
   * Unregister a service (useful for cleanup/testing)
   */
  unregister(name: string): boolean {
    return this.registry.delete(name);
  }

  /**
   * Clear all registered services
   */
  clear(): void {
    this.registry.clear();
  }
}

// Global singleton instance
export const serviceLocator = new ServiceLocator();
