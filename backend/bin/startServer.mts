import { App } from '../src/index.mts';
import { execFile } from 'node:child_process';
import * as https from 'node:https';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { writeFile, unlink } from 'node:fs/promises';
import { promisify } from 'node:util';
import * as os from 'node:os';
import * as path from 'node:path';

const execFileAsync = promisify(execFile);

// Creating object of key and certificate
// for SSL
const createSSLKeyCert = async (): Promise<{
    key: https.ServerOptions['key'],
    cert: https.ServerOptions['cert'],
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
const server = https.createServer(options, App);

server.listen(3400, 'localhost', () => console.log('Listening on port 3400 ...'));
