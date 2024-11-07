import { handler } from '../src/index.mts';

import { execFile } from 'node:child_process';
import * as https from 'node:https';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { writeFile, unlink } from 'node:fs/promises';
import { promisify } from 'node:util';
import * as os from 'node:os';
import * as path from 'node:path';

const execFileAsync = promisify(execFile);

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import * as http from 'node:http';
import { type ServerOptions } from 'node:https';

const datetimeStringFromTimestamp = (timestamp: number) => {
    const fmt = Intl.DateTimeFormat('en-US', {
        month: 'short',
        year: 'numeric',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'longOffset',
        hourCycle: 'h24',
    });

    const dateParts = Object.fromEntries(
        fmt.formatToParts(timestamp)
            .filter(({ type: partType }) => partType !== 'literal' )
            .map((item) =>
                item.type !== 'timeZoneName' ? [item.type, item.value] : [item.type, item.value.substring(item.value.indexOf('+'))])
    );

    return `${dateParts.day}/${dateParts.month}/${dateParts.year}:${dateParts.hour}:${dateParts.minute}:${dateParts.second} ${dateParts.timeZoneName}`;
};

const createRemainingTimeFunc = (
    curr: number, timeoutSecs: number
) => {
    return function() {
        const start = curr;
        const timeoutMs = timeoutSecs * 1000;
        return (start + timeoutMs) - Date.now();
    }
};

const createEvent = (req: http.IncomingMessage, timestamp: number): APIGatewayProxyEvent => {
    const path = req.url ?? '/';
    const method = req.method ?? 'GET';
    const filteredHeaders = Object.entries(req.headers ?? {})
        .filter(([, v]) => typeof v !== 'undefined');
    const mvHeaders = Object.fromEntries(
        filteredHeaders.map(
            ([k, v]) => [k.toLowerCase(), Array.isArray(v) ? v : v?.split(', ')]
        )
    );
    const headers = Object.fromEntries(
        filteredHeaders.map(([k, v]) => [k.toLowerCase(), Array.isArray(v) ? v[0] : v])
    );
    return {
        resource: path,
        path: path,
        httpMethod: method,
        requestContext: {
            accountId: '123456789012',
            apiId: 'id',
            authorizer: {
                "claims": null,
                "scopes": null
            },
            identity: {
                accountId: null,
                caller: null,
                apiKey: null,
                apiKeyId: null,
                accessKey: null,
                user: null,
                userArn: null,
                userAgent: 'Test-agent',
                clientCert: null,
                sourceIp: req.socket.remoteAddress ?? '',
                cognitoAuthenticationProvider: null,
                cognitoAuthenticationType: null,
                cognitoIdentityId: null,
                cognitoIdentityPoolId: null,
                principalOrgId: null,
            },
            resourcePath: path,
            path: path,
            httpMethod: method,
            protocol: 'HTTP/1.1',
            requestId: '1234-5678',
            stage: '$default',
            requestTime: datetimeStringFromTimestamp(timestamp),
            requestTimeEpoch: timestamp,
            resourceId: 'id',
        },
        headers: headers,
        multiValueHeaders: mvHeaders,
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        body: null,
        isBase64Encoded: false
    };
};

const createContext = (timestamp: number) => {
    return {
        awsRequestId: 'test-1234',
        functionName: 'test-function',
        functionVersion: '$LATEST',
        getRemainingTimeInMillis: createRemainingTimeFunc(timestamp, 60),
        invokedFunctionArn: 'test-function:12345678012',
        memoryLimitInMB: '1024',
        logGroupName: '/aws/lambda/test-function',
        logStreamName: 'test-stream',
        callbackWaitsForEmptyEventLoop: false,
        done: () => {},
        succeed: () => {},
        fail: () => {},
    };
}

const writeResponse = (res: http.ServerResponse, event: APIGatewayProxyResult) => {
     const headers = Object.fromEntries(
        Object.entries(
            event.multiValueHeaders ?? {}
        ).map(([key, value]) => {
            const keyCase = key.split('-')
                .map((word) => word.slice(0, 1).toUpperCase() + word.slice(1))
                .join('-');
            const coercedValues = value.map((v) => typeof v === 'boolean' ? v.toString() : v);
            const formattedValue =
                coercedValues.length > 1 ? coercedValues.map(v => v.toString()) : coercedValues?.[0];
            return [keyCase, formattedValue];
        })
    );

    res.writeHead(res.statusCode, headers);
    res.end(event.body);
};

// Creating object of key and certificate
// for SSL
const createSSLKeyCert = async (): Promise<{
    key: ServerOptions['key'],
    cert: ServerOptions['cert'],
}> => {
    const { privateKey: pko } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
    });

    const privateKey = pko.export({ type: 'pkcs8', format: 'pem' });
    const tmpKeyFile = path.join(os.tmpdir(), `${randomUUID()}.key`);
    let cert;

    try {
        await writeFile(tmpKeyFile, privateKey, 'utf8');

        ({ stdout: cert } = await execFileAsync(
            'openssl', [
                'req', '-x509', '-new', '-days', '365', '-noenc',
                '-key', tmpKeyFile,
                '-subj', '/CN=localhost.backend/O=Development/C=AU',
            ]
        ));
    } finally {
        await unlink(tmpKeyFile);
    }

    return { key: privateKey, cert };
};

const options = {
    ...(await createSSLKeyCert()),
};

// Creating https server by passing
// options and app object
const server = https.createServer(
    options,
    async (req, res) => {
        const now = Date.now();
        const event = createEvent(req, now);
        const context = createContext(now);

        const eventRes = await (handler(event, context) as Promise<APIGatewayProxyResult>);
        writeResponse(res, eventRes);
    }
);

server.listen(3401, 'localhost', () =>
    console.log('Listening on port 3401 ...')
);

