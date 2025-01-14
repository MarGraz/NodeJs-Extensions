/**
 * @summary A script to copy files around; expects configuration in assets-to-copy.json or package.json (assetsToCopy).
 * @description This script is a wrapper around the npm package "copyfiles". It reads its configuration from a file in
 *              the consuming project named "assets-to-copy.json" or the "assetsToCopy" node in package.json.
 */
const { access } = require('fs').promises;
const path = require('path');
const util = require('util');
/* eslint-disable-next-line import/no-unresolved -- ESLint does not know where to find external modules. */
const copyfiles = util.promisify(require('copyfiles'));
const getConfig = require('./get-config');
const { handleErrorObject } = require('./handle-error');

const verbose = false;

function logLine(message) {
    if (verbose) process.stdout.write(message + '\n');
}

logLine('Started executing copy-assets.js.');

// Change to consuming project's directory.
process.chdir('../..');

async function copyFilesFromConfig(config) {
    return Promise.all(config
        .map((assetsGroup) => assetsGroup.sources.map((assetSource) => {
            // Normalize the relative path to the directory to remove trailing slashes and straighten out any anomalies.
            const directoryToCopy = path.normalize(assetSource);
            const pattern = assetsGroup.pattern;

            logLine(`Copy assets from "${directoryToCopy}" using pattern "${pattern}"...`);

            return access(directoryToCopy)
                .then(
                    () => {
                        const pathPattern = path.join(directoryToCopy, pattern);
                        const sourceAndTargetPaths = [pathPattern, assetsGroup.target];

                        // We want to copy all files matched by the given pattern into the target folder mirroring the
                        // source folder structure. This is done by removing the source folder path from the beginning
                        // which "copyfiles" does using the "up" option.
                        const depth = directoryToCopy.split(/[\\/]/).length;

                        // See https://github.com/calvinmetcalf/copyfiles#programic-api for more details.
                        return copyfiles(sourceAndTargetPaths, { verbose: verbose, up: depth }, () => {});
                    },
                    () => handleErrorObject({
                        code: 'NE0031',
                        path: 'AssetCopy',
                        message: `The directory "${directoryToCopy}" cannot be accessed to copy files from.`,
                    }));
        }))
        .reduce((previousArray, currentArray) => [...previousArray, ...currentArray], []));
}

(async function main() {
    try {
        const assetsConfig = getConfig({ directory: process.cwd(), verbose: verbose }).assetsToCopy;
        if (assetsConfig) await copyFilesFromConfig(assetsConfig);
    }
    catch (error) {
        handleErrorObject(error);
    }

    logLine('Finished executing copy-assets.js.');
})();
