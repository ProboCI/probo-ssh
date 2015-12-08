# Probo SSH

This is an incomplete project and not yet functional project but a working
proof of concept for creating an SSH server that performs custom
authentication logic and then creates an interactive session with a docker
bash environment.

## TODOs:

  - Restructure Server.js into a coherent class
  - Abstract the details of an individual session
  - Perform SSH authentication and authorization
    - Receive the build id as the username (the POC currently receives container id)
    - Resolve the user using the public key fingerprint
    - Make a call to a webservice to verify the user has access to the container
  - Figure out the best way to detect someone closing the session such that SSH can be quit in the normal ways (this works if we don't enable the PTY but then we do not get the size of the wondow to set the initial value in the docker exec)
  - Add proper support for exec
  - Connect to a [container manager](https://github.com/ProboCI/probo/blob/master/lib/ContainerManager.js) service over
    TCP rather than invoking docker directly

## Current POC functionality

You can install and start the server wtih:

```` bash
npm install
npm start
````

Then you can ssh to a container running in docker (it has to already be started)
by sshing to `ssh [YOUR CONTAINER ID]@localhost -p 2222` on the same host.
