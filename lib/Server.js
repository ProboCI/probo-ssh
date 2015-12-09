'use strict';
var through2 = require('through2');
var split2 = require('split2');

var dockerode = require('dockerode');
var raw = require('docker-raw-stream');

var ssh2 = require('ssh2');

var Session = require('./Session');

var username = null;

var Docker = require('dockerode');

var docker = new Docker({
  socketPath: '/var/run/docker.sock'
});

class Server {

  /**
   * @param {object} options - An object containing server configuration.
   * @param {number} options.port - The port to listen on, defaults to 2222.
   * @param {number} options.host - The host to listen on, defaults to 0.0.0.0.
   * @param {number} options.banner - The banner to display upon authentication.
   */
  constructor(options) {
    options = options || {};
    this.port = options.port || 2222;
    this.bind = options.bind || '0.0.0.0';
    if (!options.hostKey) {
      throw new Error('Host key is required');
    }
    var serverOptions = {
      privateKey: options.hostKey,
      banner: options.banner || 'Welcome to Probo.CI',
    };
    this.server = new ssh2.Server(serverOptions, this.handler.bind(this));
  }

  start(done) {
    this.server.listen(this.port, this.bind, function() {
      console.log('Listening on port ' + this.address().port);
      if (done) {
        done();
      }
    });
  }

  stop(done) {
    this.server.close(done);
  }

  

  handler(client) {
    console.log('Client connected!');
    var self = this;

    var session = new Session({docker});
    client.on('authentication', session.authenticationHandler).on('ready', function() {

      console.log('Client authenticated!');
      client.on('session', session.connectionHandler);
    });
    client.on('end', function() {
      console.log('Client disconnected');
    });
  };

}
module.exports = Server;
