#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import 'source-map-support/register';
import { HasuraEc2EnvironmentStack } from './lib/hasura-ec2-infrastructure-stack';
import { RendasuaInfrastructureStack } from './lib/rendasua-infrastructure-stack';

const app = new cdk.App();

// Get environment from context or default to 'dev'
const environment = app.node.tryGetContext('environment') || 'dev';

new RendasuaInfrastructureStack(app, `RendasuaInfrastructure-${environment}`, {
  environment,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
});

const hasuraEc2Enabled = app.node.tryGetContext('hasuraEc2Enabled') === 'true';

if (hasuraEc2Enabled) {
  const required = (key: string): string => {
    const value = app.node.tryGetContext(key);
    if (!value) {
      throw new Error(`Missing required CDK context value: ${key}`);
    }
    return String(value);
  };

  const targetHasuraEnvironment = String(
    app.node.tryGetContext('hasuraEnvironment') || environment
  ).toLowerCase();
  const deployHasuraDev = targetHasuraEnvironment === 'dev' || targetHasuraEnvironment === 'development';
  const deployHasuraProd = targetHasuraEnvironment === 'prod' || targetHasuraEnvironment === 'production';

  const commonProps = {
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
    },
    hostedZoneDomain: String(
      app.node.tryGetContext('hasuraHostedZoneDomain') || 'rendasua.com'
    ),
    letsEncryptEmail: required('hasuraLetsEncryptEmail'),
    sshCidr: app.node.tryGetContext('hasuraSshCidr')
      ? String(app.node.tryGetContext('hasuraSshCidr'))
      : undefined,
    instanceType: String(app.node.tryGetContext('hasuraInstanceType') || 't4g.micro'),
    hasuraImage: String(
      app.node.tryGetContext('hasuraImage') || 'hasura/graphql-engine:v2.48.3'
    ),
  };

  if (deployHasuraDev) {
    const hasuraDevDomain = String(
      app.node.tryGetContext('hasuraDevDomain') || 'hasura-dev.rendasua.com'
    );
    const hasuraDevCorsDefault = [
      'https://dev.rendasua.com',
      'http://localhost:4200',
      'http://127.0.0.1:4200',
      `https://${hasuraDevDomain}`,
    ].join(',');
    new HasuraEc2EnvironmentStack(app, 'HasuraEc2InfrastructureDev', {
      ...commonProps,
      environment: 'dev',
      domainName: hasuraDevDomain,
      graphqlCorsDomain: String(
        app.node.tryGetContext('hasuraDevGraphqlCorsDomain') || hasuraDevCorsDefault
      ),
      dbSecretArn: required('hasuraDevDbSecretArn'),
      adminSecretArn: required('hasuraDevAdminSecretArn'),
      jwtSecretArn: required('hasuraDevJwtSecretArn'),
    });
  }

  if (deployHasuraProd) {
    const hasuraProdDomain = String(
      app.node.tryGetContext('hasuraProdDomain') || 'hasura.rendasua.com'
    );
    const hasuraProdCorsDefault = [
      'https://rendasua.com',
      'https://www.rendasua.com',
      `https://${hasuraProdDomain}`,
    ].join(',');
    new HasuraEc2EnvironmentStack(app, 'HasuraEc2InfrastructureProd', {
      ...commonProps,
      environment: 'prod',
      instanceType: String(
        app.node.tryGetContext('hasuraProdInstanceType') ||
          app.node.tryGetContext('hasuraInstanceType') ||
          't4g.small'
      ),
      domainName: hasuraProdDomain,
      graphqlCorsDomain: String(
        app.node.tryGetContext('hasuraProdGraphqlCorsDomain') ||
          hasuraProdCorsDefault
      ),
      dbSecretArn: required('hasuraProdDbSecretArn'),
      adminSecretArn: required('hasuraProdAdminSecretArn'),
      jwtSecretArn: required('hasuraProdJwtSecretArn'),
    });
  }
}
