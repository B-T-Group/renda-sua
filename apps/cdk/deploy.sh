#!/bin/bash

# Rendasua CDK Deployment Script
# Usage: ./deploy.sh [environment] [action]

set -e

# Default values
ENVIRONMENT=${1:-dev}
ACTION=${2:-deploy}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|production)$ ]]; then
    print_error "Invalid environment: $ENVIRONMENT"
    print_error "Valid environments: dev, staging, production"
    exit 1
fi

# Validate action
if [[ ! "$ACTION" =~ ^(deploy|destroy|diff|synth)$ ]]; then
    print_error "Invalid action: $ACTION"
    print_error "Valid actions: deploy, destroy, diff, synth"
    exit 1
fi

print_status "Starting CDK $ACTION for environment: $ENVIRONMENT"

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    print_error "AWS CLI is not configured or credentials are invalid"
    print_error "Please run 'aws configure' first"
    exit 1
fi

# Get AWS account and region
AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=$(aws configure get region)

print_status "AWS Account: $AWS_ACCOUNT"
print_status "AWS Region: $AWS_REGION"

# Check if CDK is installed
if ! command -v cdk &> /dev/null; then
    print_error "AWS CDK CLI is not installed"
    print_error "Please install it with: npm install -g aws-cdk"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    print_status "Installing dependencies..."
    npm install
fi

# Build the project
print_status "Building CDK project..."
npm run build

# Execute CDK command
case $ACTION in
    "deploy")
        print_status "Deploying infrastructure..."
        cdk deploy --context environment=$ENVIRONMENT --require-approval never
        print_success "Deployment completed successfully!"
        ;;
    "destroy")
        print_warning "This will destroy all infrastructure for environment: $ENVIRONMENT"
        read -p "Are you sure? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_status "Destroying infrastructure..."
            cdk destroy --context environment=$ENVIRONMENT
            print_success "Infrastructure destroyed successfully!"
        else
            print_status "Destroy cancelled"
        fi
        ;;
    "diff")
        print_status "Showing differences..."
        cdk diff --context environment=$ENVIRONMENT
        ;;
    "synth")
        print_status "Synthesizing CloudFormation template..."
        cdk synth --context environment=$ENVIRONMENT
        print_success "CloudFormation template generated!"
        ;;
esac

print_success "CDK $ACTION completed for environment: $ENVIRONMENT"
