import { App } from './app.mts';
import { configure } from '@codegenie/serverless-express';
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

type ServerlessApp = ReturnType<typeof configure<APIGatewayProxyEvent, APIGatewayProxyResult>>;
let serverlessApp: ServerlessApp;

async function setup(event: APIGatewayProxyEvent, context: Context) {
    serverlessApp = configure({ app: App, logSettings: { level: 'info'} });
    return serverlessApp(event, context, () => {});
}

export function handleRequest(event: APIGatewayProxyEvent, context: Context) {
    if (serverlessApp) {
        return serverlessApp(event, context, () => {});
    }
    return setup(event, context);
}
