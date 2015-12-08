'use strict';
var path = require('path');
var through2 = require('through2');
var split2 = require('split2');

var dockerode = require('dockerode');
var raw = require('docker-raw-stream');

var fs = require('fs');
var crypto = require('crypto');
var inspect = require('util').inspect;
var buffersEqual = require('buffer-equal-constant-time');
var ssh2 = require('ssh2');
var utils = ssh2.utils;

var username = null;

var authenticate = function(ctx) {
  username = ctx.username;
  if (ctx.method === 'password' && ctx.username === 'foo' && ctx.password === 'bar') {
    ctx.accept();
  }
  else if (ctx.method === 'publickey') {
    ctx.accept();
  }
  else {
    ctx.reject();
  }
};

var handler = function(client) {
  console.log('Client connected!');

  client.on('authentication', authenticate).on('ready', function() {
    console.log('Client authenticated!');

    var columns = 80;
    var rows = 24;

    client.on('close', function(accept, reject, info) {
      console.log(arguments);
    });
    client.on('session', function(accept, reject) {
      var session = accept();
      session.once('pty', function(accept, reject, info) {
        console.log('pty established', arguments);
        columns = info.cols;
        rows = info.rows;
        if (accept) {
          accept();
        }
      });
      session.once('shell', function(accept, reject) {
        var stream = accept();
        var noop = function() {};

        // This event fires when someone closes the terminal.
        stream.on('end', function() {
          stream.close();
        });

        stream
          .pipe(through2(function(data, enc, cb) {
            console.log(data.toString());
          }));

        stream.isTTY = true;
        stream.setRawMode = noop;
        stream.on('error', noop);
        var container = docker.getContainer(username);
        function getResizeOpts() {
          return {
            h: rows,
            w: columns,
          };
        }
        runExec(container, stream, function(error, exec) {
          console.log('stream established');
          exec.resize(getResizeOpts(), noop)

          session.on('window-change', function(accept, reject, info) {
            rows = info.rows;
            columns = info.cols;
            exec.resize(getResizeOpts(), noop)
            if (accept) {
              accept();
            }
          });
        });
        if (accept) {
          accept();
        }
      });
      session.once('exec', function(accept, reject, info) {
        console.log('Client wants to execute: ' + inspect(info.command));
        var stream = accept();
        stream.stderr.write('Oh no, the dreaded errors!\n');
        stream.write('Just kidding about the errors!\n');
        stream.exit(0);
        stream.end();
      });
    });
  }).on('end', function() {
    console.log('Client disconnected');
  });
};



var Docker = require('dockerode');

var docker = new Docker({
  socketPath: '/var/run/docker.sock'
});

/**
 * Get env list from running container
 * @param container
 */
function runExec(container, terminalStream, done) {
  var options = {
    AttachStdin: true,
    AttachStdout: true,
    AttachStderr: true,
    Tty: true,
    Cmd: ['bash']
  };
  container.exec(options, function(err, exec) {
    if (err) return done(error);

    exec.start({stdin: true, hijack: true}, function(err, rawStream) {
      if (err) return done(error);
      var stdout = through2();
      var stderr = through2();
      // TODO: Stderr still seems to be coming out stdout...
      container.modem.demuxStream(rawStream, stdout, stderr);
      stdout.pipe(terminalStream)
      terminalStream.pipe(rawStream);
      //stderr.pipe(terminalStream.stderr);
      done(null, exec);
    });
  });
}

var serverOptions = {
  privateKey: fs.readFileSync(path.resolve(__dirname, '..', 'test', 'fixtures', 'host')),
  banner: 'Welcome to Probo.CI',
};
var server = new ssh2.Server(serverOptions, handler);

class Server {
  start(done) {
    server.listen(2222, '127.0.0.1', function() {
      console.log('Listening on port ' + this.address().port);
      if (done) {
        done();
      }
    });
  }
}
module.exports = Server;
