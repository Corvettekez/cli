'use strict';

const { post } = require('../../tool');
const fs = require('fs');
const print = require('../../print');
const axios = require('axios');
const axiosRetry = require('axios-retry');
const {
  getFileVerificationStream
} = require('../../api');

exports.command = 'add-version <toolId>';
exports.desc = 'Add a version to a tool <toolId>';
exports.builder = (yargs) => {
  yargs
    .positional('toolId', {
      describe: 'The tool ID.',
      type: 'string'
    })
    .option('tool-version', {
      describe: 'The new version to add',
      alias: 's',
      type: 'string',
      demandOption: true
    })
    .option('tool-file', {
      describe: 'The tool file',
      alias: 'f',
      type: 'string',
      demandOption: true
    })
    .option('is-default', {
      describe: 'Set this version as the default',
      alias: 'd',
      type: 'boolean',
      default: false,
      demandOption: false
    });
};

exports.handler = async (argv) => {
  const payload = {
    version: argv.toolVersion,
    isDefault: argv.isDefault
  };

  const response = await post(argv, `/trs/v2/tools/${argv.toolId}/versions`, payload);
  const uploadPayload = {
    fileName: argv.toolFile.split('/').pop(),
    toolId: response.data.id,
    version: response.data.meta_version
  };

  const uploadRequest = await post(argv, '/trs/files', uploadPayload);
  const stats = fs.statSync(argv.toolFile);
  const fileSize = stats['size'];
  const verifyStream = await getFileVerificationStream(argv.toolFile, fileSize);
  await axios({
    method: 'put',
    url: uploadRequest.data.uploadUrl,
    data: verifyStream.data,
    'axios-retry': {
      retryCondition: err =>
        (axiosRetry.isNetworkOrIdempotentRequestError(err) ||
          (err.response.status >= 400 && err.response.status < 500))
    }
  });

  print(response.data, argv);
};
