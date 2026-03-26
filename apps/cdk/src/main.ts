#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import 'source-map-support/register';
import { HasuraEc2InfrastructureStack } from './lib/hasura-ec2-infrastructure-stack';
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

  new HasuraEc2InfrastructureStack(app, 'HasuraEc2Infrastructure', {
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
    dev: {
      domainName: String(
        app.node.tryGetContext('hasuraDevDomain') || 'hasura-dev.rendasua.com'
      ),
      dbSecretArn: required('hasuraDevDbSecretArn'),
      adminSecretArn: required('hasuraDevAdminSecretArn'),
    },
    prod: {
      domainName: String(
        app.node.tryGetContext('hasuraProdDomain') || 'hasura.rendasua.com'
      ),
      dbSecretArn: required('hasuraProdDbSecretArn'),
      adminSecretArn: required('hasuraProdAdminSecretArn'),
    },
  });
}
