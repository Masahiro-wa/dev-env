# Welcome to your CDK TypeScript project

This is a blank project for CDK development with TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template

# AWS CDK Project Setup Guide

This guide provides instructions for setting up and deploying an AWS environment using this AWS CDK project. Follow the steps below to clone the repository, install dependencies, and deploy the project to your AWS account.

## Prerequisites

Before you begin, ensure you have the following installed:

- [Node.js](https://nodejs.org/) (v14.x or later)
- [AWS CLI](https://aws.amazon.com/cli/) (v2.x or later)
- [AWS CDK](https://docs.aws.amazon.com/cdk/latest/guide/cli.html) (v2.x or later)
- A configured AWS account with appropriate permissions

## 1. Clone the Repository

First, clone the repository to your local machine:

```bash
git clone https://github.com/Masahiro-wa/dev-env.git
cd dev-env
```

## 2. Install Dependencies
Navigate to the project directory and install the required dependencies:

If you're using npm:
```
npm install
```

## 3. Set Up AWS CLI
Configure the AWS CLI with your credentials:

```
aws configure
```
You will need to provide:

- AWS Access Key ID
- AWS Secret Access Key
- Default region name (e.g., us-west-2)
- Default output format (e.g., json)

## 4. Bootstrap the AWS CDK (If Required)
## 4. Bootstrap the AWS CDK (If Required)

Before bootstrapping, **make sure to edit the environment file (`environment.yml`) with the correct values for your deployment**. 
This is crucial to ensure that your deployment uses the appropriate configurations for your environment.

If this is your first time deploying an AWS CDK app in this account and region, you need to bootstrap the environment:

```bash
cdk bootstrap
```

## 5. Deploy the CDK Stack
Deploy the stack to your AWS account:
```
cdk deploy
```

## 6. (Optional) Synthesize the CloudFormation Template
If you want to review the CloudFormation template before deploying, you can synthesize the template with the following command:

```
cdk synth
```

## 7. Clean Up
If you need to remove the deployed stack, use the following command:

```bash
cdk destroy
```
This command will delete all the resources that were created by this stack.

Enjoy!!
