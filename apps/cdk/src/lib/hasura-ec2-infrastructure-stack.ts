import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';

export interface HasuraEc2EnvironmentStackProps extends cdk.StackProps {
  readonly environment: 'dev' | 'prod';
  readonly domainName: string;
  readonly hostedZoneDomain: string;
  readonly dbSecretArn: string;
  readonly adminSecretArn: string;
  readonly jwtSecretArn: string;
  readonly letsEncryptEmail: string;
  readonly sshCidr?: string;
  readonly instanceType?: string;
  readonly hasuraImage?: string;
}

export class HasuraEc2EnvironmentStack extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    props: HasuraEc2EnvironmentStackProps
  ) {
    super(scope, id, props);

    const namePrefix = `Hasura${props.environment === 'prod' ? 'Prod' : 'Dev'}`;
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

    const securityGroup = this.createSecurityGroup(vpc, props, namePrefix);
    const role = this.createEc2Role(namePrefix, props);
    const eip = new ec2.CfnEIP(this, `${namePrefix}Eip`, {
      domain: 'vpc',
      tags: [{ key: 'Name', value: `hasura-${props.environment}-eip` }],
    });

    // Logical ID change forces new EC2 so user data re-runs (fixes not applied on in-place updates).
    const instance = new ec2.Instance(this, `${namePrefix}InstanceHasuraEC2`, {
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
      ...this.renderUserData(props, props.hasuraImage ?? 'hasura/graphql-engine:v2.48.3')
    );

    new ec2.CfnEIPAssociation(this, `${namePrefix}EipAssociation`, {
      allocationId: eip.attrAllocationId,
      instanceId: instance.instanceId,
    });

    new route53.ARecord(this, `${namePrefix}DnsRecord`, {
      zone,
      recordName: this.recordNameForZone(props.domainName, zone.zoneName),
      target: route53.RecordTarget.fromIpAddresses(eip.ref),
      ttl: cdk.Duration.minutes(5),
    });

    new cdk.CfnOutput(this, `${namePrefix}PublicDomain`, {
      value: `https://${props.domainName}`,
      description: `Hasura ${props.environment} public URL`,
    });
    new cdk.CfnOutput(this, `${namePrefix}PublicIp`, {
      value: eip.ref,
      description: `Hasura ${props.environment} Elastic IP`,
    });
    new cdk.CfnOutput(this, `${namePrefix}InstanceId`, {
      value: instance.instanceId,
      description: `Hasura ${props.environment} EC2 instance ID`,
    });
  }

  private createSecurityGroup(
    vpc: ec2.IVpc,
    props: HasuraEc2EnvironmentStackProps,
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
    props: HasuraEc2EnvironmentStackProps
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
        resources: [
          props.dbSecretArn,
          props.adminSecretArn,
          props.jwtSecretArn,
        ],
      })
    );
    return role;
  }

  private renderUserData(
    props: HasuraEc2EnvironmentStackProps,
    hasuraImage: string
  ): string[] {
    const isProd = props.environment === 'prod';
    return [
      '#!/bin/bash',
      'set -euxo pipefail',
      'apt-get update -y',
      'apt-get install -y docker.io nginx certbot python3-certbot-nginx curl unzip',
      'if ! command -v aws >/dev/null 2>&1; then curl "https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip" -o "/tmp/awscliv2.zip"; unzip -q /tmp/awscliv2.zip -d /tmp; /tmp/aws/install --update; fi',
      'systemctl enable docker',
      'systemctl start docker',
      'mkdir -p /opt/hasura',
      `DB_URL="$(aws secretsmanager get-secret-value --secret-id '${props.dbSecretArn}' --query SecretString --output text --region '${this.region}')"`,
      `ADMIN_SECRET="$(aws secretsmanager get-secret-value --secret-id '${props.adminSecretArn}' --query SecretString --output text --region '${this.region}')"`,
      `JWT_SECRET="$(aws secretsmanager get-secret-value --secret-id '${props.jwtSecretArn}' --query SecretString --output text --region '${this.region}')"`,
      // Docker --env-file requires one line per KEY=value; pretty-printed JSON breaks parsing.
      `JWT_ONE_LINE="$(printf '%s' "$JWT_SECRET" | python3 -c 'import json,sys; print(json.dumps(json.loads(sys.stdin.read())))')"`,
      'cat > /opt/hasura/.env <<EOF',
      'PG_DATABASE_URL=${DB_URL}',
      'HASURA_GRAPHQL_DATABASE_URL=${DB_URL}',
      'HASURA_GRAPHQL_METADATA_DATABASE_URL=${DB_URL}',
      'HASURA_GRAPHQL_ADMIN_SECRET=${ADMIN_SECRET}',
      'HASURA_GRAPHQL_UNAUTHORIZED_ROLE=anonymous',
      'HASURA_GRAPHQL_JWT_SECRET=${JWT_ONE_LINE}',
      // Console + introspection enabled in prod (restrict access via admin secret, network, or nginx auth).
      'HASURA_GRAPHQL_ENABLE_CONSOLE=true',
      `HASURA_GRAPHQL_ENABLE_TELEMETRY=${isProd ? 'false' : 'true'}`,
      'HASURA_GRAPHQL_ENABLE_INTROSPECTION=true',
      'HASURA_GRAPHQL_LOG_LEVEL=info',
      'EOF',
      `docker pull ${hasuraImage}`,
      'docker rm -f hasura || true',
      'docker run -d --name hasura --restart unless-stopped --env-file /opt/hasura/.env -p 127.0.0.1:8080:8080 ' +
        hasuraImage,
      'cat > /etc/nginx/sites-available/hasura <<EOF',
      'server {',
      '  listen 80;',
      `  server_name ${props.domainName};`,
      '  location / {',
      '    proxy_pass http://127.0.0.1:8080;',
      // set -u treats $host etc. as shell vars; escape so nginx receives literal $host.
      '    proxy_set_header Host \\$host;',
      '    proxy_set_header X-Real-IP \\$remote_addr;',
      '    proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;',
      '    proxy_set_header X-Forwarded-Proto \\$scheme;',
      '  }',
      '}',
      'EOF',
      'ln -sf /etc/nginx/sites-available/hasura /etc/nginx/sites-enabled/hasura',
      'rm -f /etc/nginx/sites-enabled/default',
      'nginx -t',
      'systemctl restart nginx',
      `certbot --nginx --non-interactive --agree-tos --email '${props.letsEncryptEmail}' -d '${props.domainName}' --redirect || true`,
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
