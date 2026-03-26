import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';

interface HasuraEnvironmentConfig {
  readonly environment: 'dev' | 'prod';
  readonly domainName: string;
  readonly dbSecretArn: string;
  readonly adminSecretArn: string;
}

export interface HasuraEc2InfrastructureStackProps extends cdk.StackProps {
  readonly hostedZoneDomain: string;
  readonly letsEncryptEmail: string;
  readonly sshCidr?: string;
  readonly instanceType?: string;
  readonly hasuraImage?: string;
  readonly dev: Omit<HasuraEnvironmentConfig, 'environment'>;
  readonly prod: Omit<HasuraEnvironmentConfig, 'environment'>;
}

export class HasuraEc2InfrastructureStack extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    props: HasuraEc2InfrastructureStackProps
  ) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'HasuraVpc', {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
      ],
    });
    const zone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: props.hostedZoneDomain,
    });

    this.createEnvironmentResources(vpc, zone, props, {
      environment: 'dev',
      ...props.dev,
    });
    this.createEnvironmentResources(vpc, zone, props, {
      environment: 'prod',
      ...props.prod,
    });
  }

  private createEnvironmentResources(
    vpc: ec2.IVpc,
    zone: route53.IHostedZone,
    props: HasuraEc2InfrastructureStackProps,
    envConfig: HasuraEnvironmentConfig
  ): void {
    const namePrefix = `Hasura${envConfig.environment === 'prod' ? 'Prod' : 'Dev'}`;
    const securityGroup = this.createSecurityGroup(vpc, props, namePrefix);
    const role = this.createEc2Role(namePrefix, envConfig);
    const eip = new ec2.CfnEIP(this, `${namePrefix}Eip`, {
      domain: 'vpc',
      tags: [{ key: 'Name', value: `hasura-${envConfig.environment}-eip` }],
    });

    const instance = new ec2.Instance(this, `${namePrefix}Instance`, {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: new ec2.InstanceType(props.instanceType ?? 't4g.micro'),
      machineImage: this.ubuntuArm64Image(),
      role,
      securityGroup,
      blockDevices: [
        {
          deviceName: '/dev/sda1',
          volume: ec2.BlockDeviceVolume.ebs(12, {
            volumeType: ec2.EbsDeviceVolumeType.GP3,
            encrypted: true,
          }),
        },
      ],
    });

    instance.addUserData(
      ...this.renderUserData(props, envConfig, props.hasuraImage ?? 'hasura/graphql-engine:v2.48.3')
    );

    new ec2.CfnEIPAssociation(this, `${namePrefix}EipAssociation`, {
      allocationId: eip.attrAllocationId,
      instanceId: instance.instanceId,
    });

    new route53.ARecord(this, `${namePrefix}DnsRecord`, {
      zone,
      recordName: this.recordNameForZone(envConfig.domainName, zone.zoneName),
      target: route53.RecordTarget.fromIpAddresses(eip.ref),
      ttl: cdk.Duration.minutes(5),
    });

    new cdk.CfnOutput(this, `${namePrefix}PublicDomain`, {
      value: `https://${envConfig.domainName}`,
      description: `Hasura ${envConfig.environment} public URL`,
    });
    new cdk.CfnOutput(this, `${namePrefix}PublicIp`, {
      value: eip.ref,
      description: `Hasura ${envConfig.environment} Elastic IP`,
    });
    new cdk.CfnOutput(this, `${namePrefix}InstanceId`, {
      value: instance.instanceId,
      description: `Hasura ${envConfig.environment} EC2 instance ID`,
    });
  }

  private createSecurityGroup(
    vpc: ec2.IVpc,
    props: HasuraEc2InfrastructureStackProps,
    namePrefix: string
  ): ec2.SecurityGroup {
    const securityGroup = new ec2.SecurityGroup(this, `${namePrefix}Sg`, {
      vpc,
      description: `Security group for ${namePrefix} Hasura host`,
      allowAllOutbound: true,
    });
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'HTTP');
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'HTTPS');
    if (props.sshCidr) {
      securityGroup.addIngressRule(
        ec2.Peer.ipv4(props.sshCidr),
        ec2.Port.tcp(22),
        'Restricted SSH'
      );
    }
    return securityGroup;
  }

  private createEc2Role(
    namePrefix: string,
    envConfig: HasuraEnvironmentConfig
  ): iam.Role {
    const role = new iam.Role(this, `${namePrefix}Role`, {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'AmazonSSMManagedInstanceCore'
        ),
      ],
    });

    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue', 'secretsmanager:DescribeSecret'],
        resources: [envConfig.dbSecretArn, envConfig.adminSecretArn],
      })
    );
    return role;
  }

  private renderUserData(
    props: HasuraEc2InfrastructureStackProps,
    envConfig: HasuraEnvironmentConfig,
    hasuraImage: string
  ): string[] {
    const isProd = envConfig.environment === 'prod';
    return [
      '#!/bin/bash',
      'set -euxo pipefail',
      'apt-get update -y',
      'apt-get install -y docker.io nginx certbot python3-certbot-nginx awscli',
      'systemctl enable docker',
      'systemctl start docker',
      'mkdir -p /opt/hasura',
      `DB_URL="$(aws secretsmanager get-secret-value --secret-id '${envConfig.dbSecretArn}' --query SecretString --output text --region '${this.region}')"`,
      `ADMIN_SECRET="$(aws secretsmanager get-secret-value --secret-id '${envConfig.adminSecretArn}' --query SecretString --output text --region '${this.region}')"`,
      'cat > /opt/hasura/.env <<EOF',
      'HASURA_GRAPHQL_DATABASE_URL=${DB_URL}',
      'HASURA_GRAPHQL_ADMIN_SECRET=${ADMIN_SECRET}',
      `HASURA_GRAPHQL_ENABLE_CONSOLE=${isProd ? 'false' : 'true'}`,
      `HASURA_GRAPHQL_ENABLE_TELEMETRY=${isProd ? 'false' : 'true'}`,
      `HASURA_GRAPHQL_ENABLE_INTROSPECTION=${isProd ? 'false' : 'true'}`,
      'HASURA_GRAPHQL_LOG_LEVEL=info',
      'EOF',
      `docker pull ${hasuraImage}`,
      'docker rm -f hasura || true',
      'docker run -d --name hasura --restart unless-stopped --env-file /opt/hasura/.env -p 127.0.0.1:8080:8080 ' +
        hasuraImage,
      'cat > /etc/nginx/sites-available/hasura <<EOF',
      'server {',
      '  listen 80;',
      `  server_name ${envConfig.domainName};`,
      '  location / {',
      '    proxy_pass http://127.0.0.1:8080;',
      '    proxy_set_header Host $host;',
      '    proxy_set_header X-Real-IP $remote_addr;',
      '    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
      '    proxy_set_header X-Forwarded-Proto $scheme;',
      '  }',
      '}',
      'EOF',
      'ln -sf /etc/nginx/sites-available/hasura /etc/nginx/sites-enabled/hasura',
      'rm -f /etc/nginx/sites-enabled/default',
      'nginx -t',
      'systemctl restart nginx',
      `certbot --nginx --non-interactive --agree-tos --email '${props.letsEncryptEmail}' -d '${envConfig.domainName}' --redirect || true`,
      'systemctl enable certbot.timer || true',
      'systemctl restart certbot.timer || true',
    ];
  }

  private ubuntuArm64Image(): ec2.IMachineImage {
    return ec2.MachineImage.fromSsmParameter(
      '/aws/service/canonical/ubuntu/server/24.04/stable/current/arm64/hvm/ebs-gp3/ami-id',
      {
        os: ec2.OperatingSystemType.LINUX,
      }
    );
  }

  private recordNameForZone(fullDomain: string, zoneName: string): string {
    const normalizedDomain = fullDomain.replace(/\.$/, '');
    const normalizedZone = zoneName.replace(/\.$/, '');
    if (normalizedDomain === normalizedZone) {
      return '';
    }
    const suffix = `.${normalizedZone}`;
    if (normalizedDomain.endsWith(suffix)) {
      return normalizedDomain.slice(0, -suffix.length);
    }
    return normalizedDomain;
  }
}
