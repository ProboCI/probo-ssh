'use strict';
var through2 = require('through2');

class Session {

  /**
   * @param {object} options - An object containing server configuration.
   * @param {number} options.columns - The number of columns in the current session.
   * @param {number} options.rows - The number of columns in the current session.
   * @param {number} options.rows - The number of rows in the current session.
   * @param {object} docker - The dockerode library client object.
   */
  constructor(options) {
    options = options || {}
    this.rows = options.rows || 10;
    this.columns = options.columns || 30;
    this.docker = options.docker;
    this.containerId = null;
    this.connectionHandler = this.connectionHandler.bind(this);
    this.authenticationHandler = this.authenticationHandler.bind(this);
    this.ptyHandler = this.ptyHandler.bind(this);
    this.shellHandler = this.shellHandler.bind(this);
  }

  authenticationHandler(context) {
    // We map the username of the incomming request to the container id.
    this.containerId = context.username;
    return context.accept();
  }

  connectionHandler(accept, reject) {
    this.session = accept();
    this.session.on('pty', this.ptyHandler);
    this.session.on('shell', this.shellHandler);
    this.session.on('exec', this.execHandler);
  }

  execHandler(accept, reject, info) {
    console.log('Client wants to execute: ' + inspect(info.command));
    var stream = accept();
    stream.stderr.write('Oh no, the dreaded errors!\n');
    stream.write('Just kidding about the errors!\n');
    stream.exit(0);
    stream.end();
  }

  shellHandler(accept, reject) {
    var self = this;
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

    var container = this.docker.getContainer(this.containerId);
    function getResizeOpts() {
      return {
        h: self.rows,
        w: self.columns,
      };
    }
    this.runExec(container, stream, function(error, exec) {
      console.log('stream established');
      exec.resize(getResizeOpts(), noop)

      self.session.on('window-change', function(accept, reject, info) {
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
  }

  ptyHandler(accept, reject, info) {
    console.log('pty established');
    this.columns = info.cols;
    this.rows = info.rows;
    if (accept) {
      accept();
    }
  }

  runExec(container, terminalStream, done) {
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

}

module.exports = Session;
