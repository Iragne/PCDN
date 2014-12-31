PCDN
====


PCDN is an Peer to peer/P2P CDN for video based on an hybride solution

It's work with **Peerjs** , **Videojs** and **WebRTC**.

It's a prof of concept so don't focus on the code quality.

I hope you found it interresting and feel free to contact me 

An example here [http://pcdn.jairagne.ovh](http://pcdn.jairagne.ovh)

Riquirement 
==========

 - Videojs video player
 - Compatible Browsers
 - HLS video



Client
=====

Copy past on your video page this code

    
    <script src="/js/apiCDNP2P.js"></script>
    <script>
        apiCDNP2P({host:"peerjs.jairagne.ovh",port:"9000",key: 'peerjs',debug:3});
    </script>
    
Configuration:

 - host: host of the server
 - port: port of the peerjs server
 - key: api key of my peerjs server
 - debug: Level of debug 0-3 see peerjs configuration 
 - more: [Peerjs API configuration](http://peerjs.com/)

Server
=====

**PCDN server**

My PCDN server is free to use. feel free to make your test on it.
For production mode, my advice is to do it by yourself.

host: pcdn.jairagne.ovh
port:9000
key:peerjs

**Your own PCDN server**

    $ cd server/peerjs-server
    $ npm install
    $ cd bin
    $ node peerjs --help


Contact
======
Twitter : [@adelskott](https://twitter.com/adelskott)

TODO
====

 - Landing page for inactive users
 - Expose client API
 - Refactor code
 - Limit the client share to 5 
 - Replace Peejs to use a proper server with faye
 - Use a redis or Elasticsearch instead of memory storage
 - Create a server dashboard for stats

