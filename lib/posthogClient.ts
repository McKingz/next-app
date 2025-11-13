import PostHog from 'posthog-react-native';

let client: PostHog | null = null;

export function initPostHog(key: string, options: ConstructorParameters<typeof PostHog>[1]) {
  if (!client) {
    client = new PostHog(key, options);
  }
  return client;
}

export function getPostHog() {
  return client;
}
