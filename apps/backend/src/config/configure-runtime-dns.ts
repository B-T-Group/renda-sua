import dns from 'node:dns';

const DEFAULT_PUBLIC_RESOLVERS = ['8.8.8.8', '8.8.4.4', '1.1.1.1'];

/**
 * Lightsail containers sometimes fail to resolve Route53 hostnames via the default resolver.
 * Call once at process startup before any outbound HTTP/GraphQL requests.
 */
export function configureRuntimeDns(): void {
  if (process.env.DISABLE_PUBLIC_DNS === 'true') {
    return;
  }
  const custom = process.env.DNS_SERVERS?.split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  const servers = custom?.length ? custom : DEFAULT_PUBLIC_RESOLVERS;
  dns.setServers(servers);
  dns.setDefaultResultOrder('ipv4first');
  console.log(`Runtime DNS resolvers: ${servers.join(', ')}`);
}
